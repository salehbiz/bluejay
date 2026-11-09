/**
 * Blue Jay hero — scroll-scrubbed canvas frame sequence.
 *
 * A vanilla port of Vaultfy's FrameScrub (src/components/FrameScrub.jsx in
 * vaultfy-vite-react), with the same engine:
 *
 *   tiers      hero_desktop2x 2560x1440 (dpr >= 1.25 on a fast link, falls back
 *              to hero_desktop on any fetch error), hero_desktop 1920x1080,
 *              hero_mobile 720x1280, plus 640x360 / 360x640 preview tiers.
 *   load order preview frames around the playhead, preview stride passes 8 and
 *              4, then (after window load + idle) full frames around the
 *              playhead, remaining preview passes, then full-tier bulk.
 *              Max 6 fetches in flight. CacheStorage for repeat visits.
 *   decode     sliding window (30 desktop / 15 mobile) of ImageBitmaps around
 *              the playhead, 4 full + 6 preview decodes per frame. Everything
 *              outside the window is .close()d. Blobs and bitmaps live in
 *              separate maps.
 *   render     playhead eases toward the scroll target with LERP 0.06 (x3 in
 *              the end hold). Draws only when the frame changes or a preview
 *              on screen gets its full-res bitmap. DPR capped 1.5 / 2.
 *   paint      poster is preview frame 1, pre-seeded as the first bitmap, and
 *              crossfades to the canvas when the first frame is drawn.
 *
 * One deliberate difference: the section is held with CSS position: sticky
 * inside a track whose height is the scroll length, instead of a GSAP pin.
 * The progress maths is identical, and the page is the right height from the
 * first paint, so nothing below the hero jumps when the scripts arrive.
 */
(function () {
  'use strict';

  var LERP = 0.06;          // slow, heavy scrub (Vaultfy feel)
  var CONCURRENCY = 6;      // max parallel frame fetches
  var CACHE_NAME = 'bluejay-hero-frames-v1';
  var HOLD_START = 0.02;    // fraction of travel parked on the first frame
  var HOLD_END = 0.06;      // fraction of travel parked on the last frame

  // Frame counts come from scripts/encode-hero-vaultfy-tiers.sh.
  var DESKTOP_FRAMES = 345;
  var MOBILE_FRAMES = 301;

  // Mirrors the media queries on the poster <source>, the preloads and the
  // --hero-length rules in hero-scrub.css. Keep all four in step.
  function isMobileLayout() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    return w < 768 || (w < 1024 && h >= w);
  }

  function getFrameTier() {
    var dpr = window.devicePixelRatio || 1;
    var conn = navigator.connection;
    var slowConn = !!conn && (
      conn.saveData ||
      conn.effectiveType === '2g' ||
      conn.effectiveType === '3g' ||
      (typeof conn.downlink === 'number' && conn.downlink < 3)
    );
    if (isMobileLayout()) {
      return { key: 'hero_mobile', dir: 'hero_mobile', preview: 'hero_preview_mobile', frames: MOBILE_FRAMES, mobile: true };
    }
    if (dpr >= 1.25 && !slowConn) {
      return { key: 'hero_desktop2x', dir: 'hero_desktop2x', fallback: 'hero_desktop', preview: 'hero_preview_desktop', frames: DESKTOP_FRAMES, mobile: false };
    }
    return { key: 'hero_desktop', dir: 'hero_desktop', preview: 'hero_preview_desktop', frames: DESKTOP_FRAMES, mobile: false };
  }

  function framePath(dir, i) {
    return '/frames/' + dir + '/frame_' + String(i).padStart(4, '0') + '.webp';
  }

  // ---- Stable viewport height -------------------------------------------
  // Ignores the on-screen keyboard and the mobile URL bar: measured once and
  // re-measured only when the width changes. Published as --stable-vh.
  var stableHeight = window.innerHeight;
  var stableWidth = window.innerWidth;
  function publishStableVh() {
    document.documentElement.style.setProperty('--stable-vh', (stableHeight / 100) + 'px');
  }
  publishStableVh();
  (function () {
    var timer = 0;
    var remeasure = function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (window.innerWidth === stableWidth) return;
        stableWidth = window.innerWidth;
        stableHeight = window.innerHeight;
        publishStableVh();
      }, 150);
    };
    window.addEventListener('resize', remeasure);
    window.addEventListener('orientationchange', remeasure);
  })();

  // ---- Persistent CacheStorage fetch -------------------------------------
  function fetchFrameBlob(url, priority) {
    var cachePromise = ('caches' in window)
      ? caches.open(CACHE_NAME).catch(function () { return null; })
      : Promise.resolve(null);
    return cachePromise.then(function (cache) {
      var hit = cache ? cache.match(url).catch(function () { return null; }) : Promise.resolve(null);
      return hit.then(function (matched) {
        if (matched) return matched.blob();
        return fetch(url, { priority: priority || 'auto' }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          if (cache) {
            try { cache.put(url, res.clone()).catch(function () {}); } catch (e) { /* quota / security */ }
          }
          return res.blob();
        });
      });
    });
  }

  // Frames beyond the poster wait for the window load event plus an idle
  // slot, so bulk fetches never compete with CSS, fonts and the poster.
  var bulkAllowed = document.readyState === 'complete';
  var bulkListeners = [];
  if (!bulkAllowed) {
    window.addEventListener('load', function () {
      var go = function () {
        bulkAllowed = true;
        bulkListeners.forEach(function (fn) { fn(); });
      };
      if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 1000 });
      else setTimeout(go, 200);
    }, { once: true });
  }

  // ---- Grain ------------------------------------------------------------
  function makeGrain() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var ctx = c.getContext('2d');
    if (!ctx) return '';
    var img = ctx.createImageData(128, 128);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = Math.floor(Math.random() * 255);
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // ---- Scrub instance ---------------------------------------------------
  function HeroScrub(opts) {
    this.track = opts.track;
    this.canvas = opts.canvas;
    this.poster = opts.poster;
    this.grain = opts.grain;
    this.tier = opts.tier;
    this.onProgress = opts.onProgress;
    this.frameCount = this.tier.frames;
    this.isMobile = this.tier.mobile;

    this.blobs = new Map();          // full tier, compressed
    this.bitmaps = new Map();        // full tier, decoded
    this.fetched = new Set();        // full tier, fetched or in flight
    this.decoding = new Set();
    this.pBlobs = new Map();         // preview tier
    this.pBitmaps = new Map();
    this.pFetched = new Set();
    this.pDecoding = new Set();

    this.playhead = 1;
    this.target = 1;
    this.inHold = false;
    this.ready = false;
    this.firstFrameDrawn = false;
    this.fallenBack = false;
    this.onScreen = true;
    this.destroyed = false;
    this.raf = 0;
    this.lastDrawn = -1;
    this.lastDrawnTier = '';
    this.pump = null;
    this.cancelLoader = null;

    var self = this;
    this._onBulk = function () { if (self.pump) self.pump(); };
    bulkListeners.push(this._onBulk);

    this._observe();
    this._scroll();
    this._waitForPoster();
    this._grain();
  }

  HeroScrub.prototype._grain = function () {
    if (this.isMobile || !this.grain) { if (this.grain) this.grain.style.backgroundImage = ''; return; }
    if (!HeroScrub.grainUrl) HeroScrub.grainUrl = makeGrain();
    this.grain.style.backgroundImage = 'url(' + HeroScrub.grainUrl + ')';
  };

  HeroScrub.prototype._observe = function () {
    var self = this;
    // Skip drawing, decoding and fetching while the hero is well offscreen.
    this.io = new IntersectionObserver(function (entries) {
      self.onScreen = entries[0].isIntersecting;
    }, { rootMargin: '200px 0px' });
    this.io.observe(this.track);
    // Pause the grain animation when the hero is not visible at all.
    this.ioGrain = new IntersectionObserver(function (entries) {
      if (self.grain) self.grain.style.animationPlayState = entries[0].isIntersecting ? 'running' : 'paused';
    }, { threshold: 0 });
    this.ioGrain.observe(this.track);
  };

  HeroScrub.prototype._scroll = function () {
    var self = this;
    var frameCount = this.frameCount;
    this.st = window.ScrollTrigger.create({
      trigger: this.track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0,
      invalidateOnRefresh: true,
      onUpdate: function (st) {
        var progress = st.progress;
        // Map raw progress onto the frame range, parked on the first and
        // last frame inside the hold zones.
        var span = Math.max(0.01, 1 - HOLD_START - HOLD_END);
        var eff = Math.min(1, Math.max(0, (progress - HOLD_START) / span));
        self.target = 1 + eff * (frameCount - 1);
        self.inHold = HOLD_END > 0 && progress >= 1 - HOLD_END;
        window.__bjScrub = { tier: self.tier.key, progress: progress, target: self.target, playhead: self.playhead, inHold: self.inHold,
          full: self.bitmaps.size, preview: self.pBitmaps.size, fetched: self.fetched.size, pFetched: self.pFetched.size };
        if (self.onProgress) self.onProgress(progress);
      }
    });
    if (this.onProgress) this.onProgress(this.st.progress || 0);
  };

  HeroScrub.prototype._waitForPoster = function () {
    var self = this;
    var img = this.poster;
    var started = false;
    var start = function () {
      if (started || self.destroyed) return;
      started = true;
      self._startLoader();
    };
    var seed = function () {
      if (!img.naturalWidth || self.destroyed) return;
      // The poster is preview frame 1 of this tier: seed it as the first
      // bitmap so the canvas can take over at once.
      createImageBitmap(img).then(function (bmp) {
        if (self.destroyed || self.pBitmaps.has(1) || self.bitmaps.has(1)) { bmp.close(); return; }
        self.pBitmaps.set(1, bmp);
        self._setReady();
      }).catch(function () {});
    };
    var posterMatchesTier = function () {
      var src = img.currentSrc || img.src || '';
      return src.indexOf('/' + self.tier.preview + '/') !== -1;
    };
    if (img.complete && img.naturalWidth > 0) {
      start();
      if (posterMatchesTier()) seed();
      return;
    }
    this._posterTimer = setTimeout(start, 300);
    this._onPosterLoad = function () {
      clearTimeout(self._posterTimer);
      start();
      if (posterMatchesTier()) seed();
    };
    img.addEventListener('load', this._onPosterLoad, { once: true });
  };

  HeroScrub.prototype._setReady = function () {
    if (this.ready || this.destroyed) return;
    this.ready = true;
    this._startRender();
  };

  HeroScrub.prototype._resetCaches = function () {
    this.blobs.clear();
    this.bitmaps.forEach(function (b) { b.close(); });
    this.bitmaps.clear();
    this.fetched.clear();
    this.decoding.clear();
    this.pBlobs.clear();
    this.pBitmaps.forEach(function (b) { b.close(); });
    this.pBitmaps.clear();
    this.pFetched.clear();
    this.pDecoding.clear();
  };

  HeroScrub.prototype._startLoader = function () {
    var self = this;
    if (this.cancelLoader) this.cancelLoader();
    var cancelled = false;
    var frameCount = this.frameCount;
    var tier = this.tier;
    var loadedCount = 0;
    var fetchCount = 0;
    var requiredForReady = 1; // preview tier: first ~15KB frame is enough

    // Stride order: spread out first, then fill the gaps. Phones load every
    // second frame in the stride passes, as on Vaultfy.
    var order = [];
    var seen = new Set();
    var step = this.isMobile ? 2 : 1;
    [8, 4, 2, 1].forEach(function (stride) {
      var s = stride * step;
      for (var i = 1; i <= frameCount; i += s) {
        if (!seen.has(i)) { seen.add(i); order.push(i); }
      }
    });
    var previewHeadCount = Math.ceil(order.length / 4);
    var idx = 0;
    var pIdx = 0;
    var inFlight = 0;

    var findPriorityFrame = function (center, fetched, maxDistance) {
      for (var dist = 0; dist <= maxDistance; dist++) {
        var plus = center + dist;
        if (plus >= 1 && plus <= frameCount && !fetched.has(plus)) return plus;
        if (dist > 0) {
          var minus = center - dist;
          if (minus >= 1 && minus <= frameCount && !fetched.has(minus)) return minus;
        }
      }
      return null;
    };

    var nextPreview = function () {
      while (pIdx < order.length) {
        var c = order[pIdx++];
        if (!self.pFetched.has(c)) return c;
      }
      return null;
    };
    var nextFull = function () {
      while (idx < order.length) {
        var c = order[idx++];
        if (!self.fetched.has(c)) return c;
      }
      return null;
    };

    var pickNext = function () {
      var center = Math.round(self.playhead);
      var f = findPriorityFrame(center, self.pFetched, 15);
      if (f !== null) return { frame: f, preview: true };
      if (pIdx < previewHeadCount) {
        f = nextPreview();
        if (f !== null && pIdx <= previewHeadCount) return { frame: f, preview: true };
      }
      if (bulkAllowed) {
        f = findPriorityFrame(center, self.fetched, self.isMobile ? 6 : 12);
        if (f !== null) return { frame: f, preview: false };
      }
      f = nextPreview();
      if (f !== null) return { frame: f, preview: true };
      if (!bulkAllowed) return null;
      f = nextFull();
      return f !== null ? { frame: f, preview: false } : null;
    };

    var pump = function () {
      if (cancelled || self.destroyed) return;
      while (inFlight < CONCURRENCY) {
        var next = pickNext();
        if (next === null) break;
        (function (frame, isPreview) {
          (isPreview ? self.pFetched : self.fetched).add(frame);
          inFlight++;
          var dir = isPreview ? tier.preview : (self.fallenBack && tier.fallback ? tier.fallback : tier.dir);
          var priority = isPreview ? (fetchCount < 24 ? 'high' : 'auto') : 'low';
          fetchCount++;
          fetchFrameBlob(framePath(dir, frame), priority).then(function (blob) {
            if (cancelled) return;
            (isPreview ? self.pBlobs : self.blobs).set(frame, blob);
            loadedCount++;
            if (loadedCount === requiredForReady) self._setReady();
            inFlight--;
            pump();
          }).catch(function () {
            if (cancelled) return;
            if (!isPreview && !self.fallenBack && tier.fallback) {
              // 2x tier unavailable: restart on the 1x desktop tier.
              cancelled = true;
              self.fallenBack = true;
              self._resetCaches();
              self._startLoader();
            } else {
              inFlight--;
              pump();
            }
          });
        })(next.frame, next.preview);
      }
    };

    this.pump = pump;
    this.cancelLoader = function () { cancelled = true; };
    pump();
  };

  HeroScrub.prototype._bitmapFor = function (frame) {
    var full = this.bitmaps.get(frame);
    if (full) return { bmp: full, tier: 'full' };
    var prev = this.pBitmaps.get(frame);
    if (prev) return { bmp: prev, tier: 'preview' };
    return null;
  };

  HeroScrub.prototype._nearest = function (ideal) {
    if (this._bitmapFor(ideal)) return ideal;
    var nearest = null;
    var min = Infinity;
    this.bitmaps.forEach(function (_, k) { var d = Math.abs(k - ideal); if (d < min) { min = d; nearest = k; } });
    this.pBitmaps.forEach(function (_, k) { var d = Math.abs(k - ideal); if (d < min) { min = d; nearest = k; } });
    return nearest;
  };

  HeroScrub.prototype._decodeTier = function (blobs, bitmaps, decoding, order, budget, win, skipIfFull) {
    var self = this;
    var count = 0;
    for (var n = 0; n < order.length; n++) {
      if (count >= budget) break;
      var i = order[n];
      if (skipIfFull && this.bitmaps.has(i)) continue;
      if (bitmaps.has(i) || decoding.has(i) || !blobs.has(i)) continue;
      count++;
      decoding.add(i);
      (function (frame) {
        createImageBitmap(blobs.get(frame)).then(function (bmp) {
          decoding.delete(frame);
          if (self.destroyed) { bmp.close(); return; }
          var c = Math.round(self.playhead);
          if (frame >= Math.max(1, c - win) && frame <= Math.min(self.frameCount, c + win)) {
            bitmaps.set(frame, bmp);
            // A full bitmap supersedes the preview for the same frame.
            if (bitmaps === self.bitmaps) {
              var p = self.pBitmaps.get(frame);
              if (p) { p.close(); self.pBitmaps.delete(frame); }
            }
          } else {
            bmp.close();
          }
        }).catch(function () { decoding.delete(frame); });
      })(i);
    }
  };

  HeroScrub.prototype._decode = function (center) {
    var win = this.isMobile ? 15 : 30;
    var lo = Math.max(1, center - win);
    var hi = Math.min(this.frameCount, center + win);
    var maps = [this.bitmaps, this.pBitmaps];
    for (var m = 0; m < maps.length; m++) {
      var map = maps[m];
      map.forEach(function (bmp, key) {
        if (key < lo || key > hi) { bmp.close(); map.delete(key); }
      });
    }
    var order = [];
    for (var dist = 0; dist <= win; dist++) {
      var p = center + dist;
      if (p >= lo && p <= hi) order.push(p);
      if (dist > 0) {
        var q = center - dist;
        if (q >= lo && q <= hi) order.push(q);
      }
    }
    this._decodeTier(this.blobs, this.bitmaps, this.decoding, order, 4, win, false);
    this._decodeTier(this.pBlobs, this.pBitmaps, this.pDecoding, order, 6, win, true);
  };

  HeroScrub.prototype._draw = function (frame) {
    var canvas = this.canvas;
    var found = this._bitmapFor(frame);
    if (!found) return;
    var bmp = found.bmp;
    this.lastDrawnTier = found.tier;
    var ctx = this.ctx || (this.ctx = canvas.getContext('2d', { alpha: false }));
    if (!ctx) return;
    var cr = canvas.width / canvas.height;
    var ir = bmp.width / bmp.height;
    var dw, dh, dx, dy;
    if (ir > cr) {
      dh = canvas.height; dw = dh * ir; dx = (canvas.width - dw) * 0.5; dy = 0;
    } else {
      dw = canvas.width; dh = dw / ir; dx = 0; dy = (canvas.height - dh) * 0.5;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, dx, dy, dw, dh);

    if (!this.firstFrameDrawn) {
      this.firstFrameDrawn = true;
      this.track.classList.add('is-drawn');
      var lqip = document.getElementById('hero-lqip');
      if (lqip) {
        lqip.style.opacity = '0';
        setTimeout(function () { if (lqip.parentNode) lqip.parentNode.removeChild(lqip); }, 400);
      }
      window.ScrollTrigger.refresh();
    }
  };

  HeroScrub.prototype._resizeCanvas = function () {
    var c = this.canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2);
    var r = c.getBoundingClientRect();
    var w = Math.round(r.width * dpr);
    var h = Math.round(r.height * dpr);
    if (!w || !h || (c.width === w && c.height === h)) return;
    c.width = w; c.height = h;
    this.lastDrawn = -1;
  };

  HeroScrub.prototype._startRender = function () {
    var self = this;
    this._resizeCanvas();
    this._onResize = function () { self._resizeCanvas(); };
    window.addEventListener('resize', this._onResize);
    var loop = function () {
      if (self.destroyed) return;
      if (!self.onScreen) { self.raf = requestAnimationFrame(loop); return; }
      // Inside the end hold, close the gap three times faster so the last
      // frame is on screen before the section scrolls away.
      var k = self.inHold ? Math.min(1, LERP * 3) : LERP;
      self.playhead += (self.target - self.playhead) * k;
      var ideal = Math.round(self.playhead);
      var frame = self._nearest(ideal);
      if (frame !== null) {
        var upgraded = frame === self.lastDrawn && self.lastDrawnTier === 'preview' && self.bitmaps.has(frame);
        if (frame !== self.lastDrawn || upgraded) {
          self._draw(frame);
          self.lastDrawn = frame;
        }
      }
      self._decode(ideal);
      if (self.pump) self.pump();
      self.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };

  HeroScrub.prototype.destroy = function () {
    this.destroyed = true;
    if (this.cancelLoader) this.cancelLoader();
    cancelAnimationFrame(this.raf);
    clearTimeout(this._posterTimer);
    if (this._onPosterLoad) this.poster.removeEventListener('load', this._onPosterLoad);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this.st) this.st.kill();
    if (this.io) this.io.disconnect();
    if (this.ioGrain) this.ioGrain.disconnect();
    var i = bulkListeners.indexOf(this._onBulk);
    if (i !== -1) bulkListeners.splice(i, 1);
    this._resetCaches();
    this.pump = null;
    this.track.classList.remove('is-drawn');
  };

  // ---- Overlay (beats, scroll cue, skip intro) --------------------------
  function bindOverlay(root) {
    var beats = Array.prototype.slice.call(root.querySelectorAll('[data-beat]')).map(function (el) {
      return { el: el, min: parseFloat(el.dataset.min), max: parseFloat(el.dataset.max), on: null };
    });
    var cue = root.querySelector('.hero-scroll-cue');
    var skip = root.querySelector('.hero-skip-intro');
    var cueOn = null;
    var skipOn = null;

    if (cue) cue.addEventListener('click', function () {
      window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
    });
    if (skip) skip.addEventListener('click', function () {
      var next = document.getElementById(skip.dataset.target || '');
      if (next) next.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: root.offsetTop + root.offsetHeight, behavior: 'smooth' });
    });

    return function (progress) {
      for (var i = 0; i < beats.length; i++) {
        var b = beats[i];
        var on = progress >= b.min && progress <= b.max;
        if (on !== b.on) {
          b.on = on;
          b.el.classList.toggle('is-active', on);
          b.el.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
      }
      var c = progress < 0.05;
      if (cue && c !== cueOn) { cueOn = c; cue.classList.toggle('is-hidden', !c); cue.tabIndex = c ? 0 : -1; }
      var s = progress <= 0.88;
      if (skip && s !== skipOn) { skipOn = s; skip.classList.toggle('is-hidden', !s); skip.tabIndex = s ? 0 : -1; }
    };
  }

  // ---- Boot -------------------------------------------------------------
  function init() {
    var track = document.getElementById('hero-journey');
    if (!track) return;
    var canvas = track.querySelector('.hero-scrub__canvas');
    var poster = track.querySelector('.hero-scrub__poster');
    var grain = track.querySelector('.hero-scrub__grain');
    var onProgress = bindOverlay(track);

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !window.ScrollTrigger || !('createImageBitmap' in window)) {
      // Still image: the full-resolution first frame of the right tier.
      track.classList.add('is-static');
      var t = getFrameTier();
      poster.src = framePath(t.fallback || t.dir, 1);
      if (window.ScrollTrigger) {
        window.ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom', onUpdate: function (st) { onProgress(st.progress); } });
      } else {
        onProgress(0);
      }
      return;
    }

    window.gsap.registerPlugin(window.ScrollTrigger);
    var tier = getFrameTier();
    var scrub = new HeroScrub({ track: track, canvas: canvas, poster: poster, grain: grain, tier: tier, onProgress: onProgress });

    // Rebuild only when the tier changes (rotation, window crossing the
    // breakpoint). Keyboard and URL-bar resizes keep the same instance.
    var lastW = window.innerWidth;
    var debounce = 0;
    var onResize = function (e) {
      if (e.type === 'resize' && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        var next = getFrameTier();
        if (next.key !== tier.key) {
          scrub.destroy();
          tier = next;
          scrub = new HeroScrub({ track: track, canvas: canvas, poster: poster, grain: grain, tier: tier, onProgress: onProgress });
        }
        window.ScrollTrigger.refresh();
      }, 250);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
