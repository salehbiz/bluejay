/**
 * 60 fps hero sequence with a two-tier progressive loader.
 * 1. The poster paints first (preloaded from <head> and the Link header).
 * 2. A small preview tier streams in stride-pyramid order (8 -> 4 -> 2 -> 1),
 *    so the whole scroll range is scrubbable within a second or two.
 * 3. Sharp frames are fetched only ahead of / around the playhead and replace
 *    the preview as they arrive.
 * Decoded bitmaps live in a small sliding window to keep memory bounded.
 */

(function () {
  'use strict';

  const FRAME_COUNT = 895;
  const SCROLL_LENGTH_VH = 1100;
  const FOLLOW_TIME_MS = 95;
  const BASE = '/frames/hero60';

  function initResilientHeroScrub() {
    const heroSection = document.querySelector('.section.mod--hero');
    const canvas = document.getElementById('hero-scrub-canvas');
    const posterImg = document.getElementById('hero-scrub-poster');

    if (!heroSection || !canvas) return;

    // Session-locked tier resolution
    const isMobile = window.innerWidth < 768;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = navigator.connection || {};
    const slow = conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || '');

    const padFrame = (i) => String(i).padStart(4, '0');
    const posterUrl = `${BASE}/${isMobile ? 'mobile-poster' : 'poster'}.webp`;

    // Older builds copied every frame into Cache Storage; free that space.
    try { if ('caches' in window) caches.delete('frame-cache-hq-v2'); } catch (e) {}

    if (reduced) {
      const lqip = document.getElementById('hero-lqip');
      if (lqip) lqip.style.display = 'none';
      if (posterImg) posterImg.style.opacity = '1';
      return;
    }

    function makeTier(dir, opts) {
      return Object.assign({
        url: (i) => `${BASE}/${dir}/${padFrame(i)}.webp`,
        blobs: new Map(),
        inFlight: new Set(),
        bitmaps: new Map(),
        decoding: new Set(),
        pending: 0
      }, opts);
    }

    // behind/ahead: decoded-bitmap window around the playhead (in scroll direction).
    // fetchAhead/fetchBehind: how far the sharp tier prefetches.
    const preview = makeTier(isMobile ? 'preview-mobile' : 'preview-desktop', {
      behind: 30, ahead: 50, maxInFlight: 8
    });
    const full = makeTier(isMobile ? 'mobile' : 'desktop', {
      behind: isMobile ? 8 : 6,
      ahead: isMobile ? 16 : 14,
      maxInFlight: isMobile ? 6 : 8,
      fetchBehind: 20,
      fetchAhead: slow ? 30 : (isMobile ? 90 : 150),
      keepBlobs: 320
    });

    let updateHeroUI = () => {};
    let playhead = 1;
    let target = 1;
    let ready = false;
    let posterLoaded = false;
    let hasDrawnFirst = false;
    let lastRenderKey = '';

    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    let lastOrientation = lastWidth > lastHeight ? 'landscape' : 'portrait';

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round((rect.width || window.innerWidth) * dpr));
      const h = Math.max(1, Math.round((rect.height || window.innerHeight) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lastRenderKey = '';
      }
    }

    resizeCanvas();
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const o = w > h ? 'landscape' : 'portrait';
      if (Math.abs(w - lastWidth) > 10 || Math.abs(h - lastHeight) > 150 || o !== lastOrientation) {
        lastWidth = w;
        lastHeight = h;
        lastOrientation = o;
        resizeCanvas();
      }
    });

    const strideRank = new Uint8Array(FRAME_COUNT + 1);
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const k = i - 1;
      strideRank[i] = k % 8 === 0 ? 0 : k % 4 === 0 ? 1 : k % 2 === 0 ? 2 : 3;
    }

    const direction = () => (target >= playhead ? 1 : -1);
    const inWindow = (tier, i) => {
      const c = Math.round(playhead);
      const t = Math.round(target);
      const dir = direction();
      const lo = Math.min(c, t) - (dir > 0 ? tier.behind : tier.ahead);
      const hi = Math.max(c, t) + (dir > 0 ? tier.ahead : tier.behind);
      return i >= lo && i <= hi;
    };

    function decodeFrame(tier, i) {
      if (tier.bitmaps.has(i) || tier.decoding.has(i) || !tier.blobs.has(i)) return;
      tier.decoding.add(i);
      createImageBitmap(tier.blobs.get(i))
        .then((bmp) => {
          tier.decoding.delete(i);
          if (i === 1 || inWindow(tier, i)) {
            tier.bitmaps.set(i, bmp);
            ready = true;
          } else {
            bmp.close();
          }
        })
        .catch(() => tier.decoding.delete(i));
    }

    function fetchInto(tier, i, priority) {
      tier.inFlight.add(i);
      tier.pending++;
      fetch(tier.url(i), { priority })
        .then((res) => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          tier.pending--;
          tier.blobs.set(i, blob);
          if (inWindow(tier, i)) decodeFrame(tier, i);
          pump();
        })
        .catch(() => {
          tier.pending--;
          tier.inFlight.delete(i);
          setTimeout(pump, 800);
        });
    }

    function pump() {
      if (!posterLoaded) return;
      const center = Math.round(playhead);
      const dir = direction();

      // Sharp tier: nearest-first around the playhead, biased in scroll direction.
      let slots = full.maxInFlight - full.pending;
      for (let d = 0; slots > 0 && d <= Math.max(full.fetchAhead, full.fetchBehind); d++) {
        for (const i of [center + dir * d, center - dir * d]) {
          if (i < 1 || i > FRAME_COUNT || full.inFlight.has(i)) continue;
          const ahead = (i - center) * dir >= 0;
          if (d > (ahead ? full.fetchAhead : full.fetchBehind)) continue;
          fetchInto(full, i, d <= 12 ? 'high' : 'low');
          if (--slots <= 0) break;
        }
      }

      // Preview tier: stride pyramid over the whole sequence, nearest-first within each level.
      slots = preview.maxInFlight - preview.pending;
      if (preview.inFlight.size >= FRAME_COUNT) slots = 0;
      for (let rank = 0; slots > 0 && rank < 4; rank++) {
        for (let d = 0; slots > 0 && d < FRAME_COUNT; d++) {
          for (const i of d === 0 ? [center] : [center + dir * d, center - dir * d]) {
            if (i < 1 || i > FRAME_COUNT || strideRank[i] !== rank || preview.inFlight.has(i)) continue;
            fetchInto(preview, i, rank === 0 ? 'high' : 'low');
            if (--slots <= 0) break;
          }
        }
      }
    }

    function maintain(tier, budget) {
      for (const [k, bmp] of tier.bitmaps) {
        if (k !== 1 && !inWindow(tier, k)) {
          bmp.close();
          tier.bitmaps.delete(k);
        }
      }
      if (tier.keepBlobs) {
        const c = Math.round(playhead);
        for (const k of tier.blobs.keys()) {
          if (Math.abs(k - c) > tier.keepBlobs && !tier.decoding.has(k)) {
            tier.blobs.delete(k);
            tier.inFlight.delete(k); // refetch later comes from the HTTP cache
          }
        }
      }
      const c = Math.round(playhead);
      const dir = direction();
      budget -= tier.decoding.size;
      for (let d = 0; budget > 0 && d <= Math.max(tier.ahead, tier.behind); d++) {
        for (const i of [c + dir * d, c - dir * d]) {
          if (budget <= 0) break;
          if (i < 1 || i > FRAME_COUNT || !inWindow(tier, i)) continue;
          if (!tier.bitmaps.has(i) && tier.blobs.has(i) && !tier.decoding.has(i)) {
            decodeFrame(tier, i);
            budget--;
          }
        }
      }
    }

    function nearest(tier, desired, maxDist) {
      for (let d = 0; d <= maxDist; d++) {
        if (tier.bitmaps.has(desired - d)) return desired - d;
        if (tier.bitmaps.has(desired + d)) return desired + d;
      }
      return null;
    }

    // Exact sharp frame > exact preview > sharp within 2 > nearest preview > nearest sharp.
    function pickFrame(desired) {
      if (full.bitmaps.has(desired)) return [full, desired];
      if (preview.bitmaps.has(desired)) return [preview, desired];
      let f = nearest(full, desired, 2);
      if (f !== null) return [full, f];
      f = nearest(preview, desired, FRAME_COUNT);
      if (f !== null) return [preview, f];
      f = nearest(full, desired, FRAME_COUNT);
      return f !== null ? [full, f] : null;
    }

    const gpuRenderer = window.createHeroRenderer?.(canvas);
    canvas.addEventListener('hero-renderer-restored', () => { lastRenderKey = ''; });

    function draw(bmp) {
      if (gpuRenderer) {
        if (!gpuRenderer.draw(bmp, bmp, 0)) return;
      } else {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        if (canvas.width === 0 || canvas.height === 0) resizeCanvas();
        const scale = Math.max(canvas.width / bmp.width, canvas.height / bmp.height);
        const dw = bmp.width * scale, dh = bmp.height * scale;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      }

      if (!hasDrawnFirst) {
        hasDrawnFirst = true;
        canvas.style.display = 'block';
        requestAnimationFrame(() => {
          canvas.style.opacity = '1';
          if (posterImg) posterImg.style.opacity = '0';
          const lqip = document.getElementById('hero-lqip');
          if (lqip) {
            lqip.style.opacity = '0';
            setTimeout(() => lqip.remove(), 400);
          }
        });
      }
    }

    // Time-based following behaves consistently on 60/120Hz displays.
    let lastTime = 0;
    let lastMaintenance = 0;
    function loop(now) {
      const dt = Math.min(50, now - (lastTime || now));
      lastTime = now;
      if (ready && !document.hidden) {
        const delta = (target - playhead) * (1 - Math.exp(-dt / FOLLOW_TIME_MS));
        const step = Math.max(-dt * 0.45, Math.min(dt * 0.45, delta));
        playhead = Math.max(1, Math.min(FRAME_COUNT, playhead + step));
        updateHeroUI((playhead - 1) / (FRAME_COUNT - 1));

        const pick = pickFrame(Math.round(playhead));
        if (pick) {
          const [tier, frame] = pick;
          const key = `${tier === full ? 'f' : 'p'}${frame}:${canvas.width}:${canvas.height}`;
          if (key !== lastRenderKey) {
            draw(tier.bitmaps.get(frame));
            lastRenderKey = key;
          }
        }
        if (now - lastMaintenance > 24) {
          maintain(full, isMobile ? 3 : 4);
          maintain(preview, 6);
          pump();
          lastMaintenance = now;
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Seed frame 1 from the poster, which is byte-identical to the sharp frame 1.
    const seedImg = new Image();
    seedImg.src = posterUrl;
    seedImg.onload = async () => {
      try {
        full.bitmaps.set(1, await createImageBitmap(seedImg));
        full.inFlight.add(1);
        ready = true;
      } catch (e) {}
      posterLoaded = true;
      pump();
    };
    seedImg.onerror = () => {
      posterLoaded = true;
      ready = true;
      pump();
    };

    // Pin Hero Section with GSAP ScrollTrigger for Smooth Scroll Scrubbing
    const progressBar = document.getElementById('hero-scrub-progress');
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      const wordmark = heroSection.querySelector('.editorial-wordmark');
      const reveal = heroSection.querySelector('.editorial-reveal');
      // Keep the same lettering on screen as it becomes the navigation identity.
      document.body.appendChild(wordmark);
      wordmark.classList.add('wordmark-morph');
      let logoX=0, logoY=0, logoScale=1;
      function measureLogo() {
        const targetWidth=window.innerWidth<768 ? 106 : 126;
        logoScale=targetWidth/wordmark.offsetWidth;
        logoX=(window.innerWidth-targetWidth)/2-wordmark.offsetLeft;
        logoY=25-wordmark.offsetTop;
      }
      measureLogo();
      document.fonts.ready.then(measureLogo);
      window.addEventListener('resize',measureLogo);
      let logoProgress=0;
      gsap.ticker.add(() => {
        const desired=clamp((window.scrollY)/(window.innerHeight*.25));
        logoProgress+=(desired-logoProgress)*(1-Math.exp(-gsap.ticker.deltaRatio()*16.667/55));
        if(Math.abs(desired-logoProgress)<.0001) logoProgress=desired;
        const t=logoProgress*logoProgress*(3-2*logoProgress);
        gsap.set(wordmark,{x:logoX*t,y:logoY*t,scale:1+(logoScale-1)*t,opacity:1});
      });
      const clamp = gsap.utils.clamp(0, 1);
      const foot = heroSection.querySelector('.editorial-foot');
      const kicker = document.getElementById('scene-kicker');
      const line = document.getElementById('scene-line');
      const emphasis = document.getElementById('scene-emphasis');
      // Linear scroll mapping: no holds or per-scene acceleration.
      function frameAt(p) { return 1 + p * (FRAME_COUNT - 1); }
      const scenes = [
        {start:.11,end:.27,label:'Palm Jebel Ali',line:'Frond E',em:'Unit R084.'},
        {start:.32,end:.48,label:'Bluejay · Six bedrooms',line:'7,722 sq ft',em:'built-up area.'},
        {start:.54,end:.72,label:'Private beachfront living',line:'7,589 sq ft',em:'plot area.'},
        {start:.79,end:.99,label:'Frond E · Unit R084',line:'AED 25',em:'million.'}
      ];
      let activeScene = -1;
      updateHeroUI = (p) => {
          if (progressBar) {
            const pct = 5.5 + p * 94.5;
            progressBar.style.width = `${pct.toFixed(2)}%`;
          }
          if (!reduced) {

            gsap.set(foot, {opacity:1-.2*clamp(p/.08)});
            const idx=scenes.findIndex(scene=>p>=scene.start && p<=scene.end);
            if (idx !== -1) {
              const scene=scenes[idx];
              if (idx !== activeScene) {
                kicker.textContent=scene.label;
                line.textContent=scene.line;
                emphasis.textContent=scene.em;
                activeScene=idx;
              }
              const visibility=clamp((p-scene.start)/.025)*clamp((scene.end-p)/.025);
              gsap.set(reveal,{opacity:visibility,y:16*(1-visibility)});
            } else gsap.set(reveal,{opacity:0});
          }
      };
      ScrollTrigger.create({
        trigger: heroSection,
        start: 'top top',
        end: () => `+=${window.innerHeight * (SCROLL_LENGTH_VH / 100 - 1)}`,
        pin: true,
        anticipatePin: 1,
        scrub: 0,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          target = frameAt(p);

        }
      });
      setTimeout(() => ScrollTrigger.refresh(), 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResilientHeroScrub);
  } else {
    initResilientHeroScrub();
  }
})();
