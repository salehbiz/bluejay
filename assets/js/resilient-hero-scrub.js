/**
 * 60 fps hero sequence with a bandwidth-adaptive progressive loader.
 * 1. The poster paints first (preloaded from <head> and the Link header).
 * 2. A motion tier streams ahead of the scroll: the sharpest of micro (~5 KB),
 *    preview, hd and full frames that measured bandwidth can deliver
 *    fast enough for a brisk scroll. Below full, it streams at 1/4, 1/2, then
 *    full density so motion stays even instead of jumping.
 * 3. When the motion tier is not full, the full frame under a resting view is
 *    fetched first, so the picture sharpens as soon as the visitor stops.
 * Decoded bitmaps live in small sliding windows to keep memory bounded.
 */

(function () {
  'use strict';

  const FRAME_COUNT = 895;
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

    // Tiers, sharpest first. kb: average frame size, which decides what the link can
    // stream. penalty: how many frames of distance a lower tier's exact frame is worth
    // when choosing what to draw. behind/ahead: decoded-bitmap window around the
    // playhead (in scroll direction). fetchAhead/fetchBehind: full-tier prefetch reach.
    const full = makeTier(isMobile ? 'mobile' : 'desktop', {
      rank: 3, kb: isMobile ? 37.5 : 84, penalty: 0, timeout: 20000,
      behind: isMobile ? 8 : 6, ahead: isMobile ? 16 : 14,
      fetchBehind: 20, fetchAhead: isMobile ? 90 : 150, keepBlobs: 320
    });
    const hd = makeTier(isMobile ? 'hd-mobile' : 'hd-desktop', {
      rank: 2, kb: isMobile ? 24 : 47, penalty: 0.5, timeout: 15000,
      behind: 10, ahead: 24, maxInFlight: 6, keepBlobs: 400
    });
    const preview = makeTier(isMobile ? 'preview-mobile' : 'preview-desktop', {
      rank: 1, kb: isMobile ? 8.5 : 18, penalty: 1.6, timeout: 12000,
      behind: 30, ahead: 80, maxInFlight: 6
    });
    const micro = makeTier(isMobile ? 'micro-mobile' : 'micro-desktop', {
      rank: 0, kb: isMobile ? 4.2 : 5.8, penalty: 2.6, timeout: 8000,
      behind: 40, ahead: 120, maxInFlight: 6
    });
    const ladder = [full, hd, preview, micro];

    // Measured throughput: bytes over the time bytes were actually arriving (the union
    // of each response's first-to-last-byte window). Waiting on round trips is left
    // out, or small frames on a high-latency link would read as a slow link.
    let transfers = []; // [responseStart, responseEnd, bytes], most recent last
    let bw = 0;
    function recordTransfer(e) {
      if (!e.name.includes(BASE) || !e.transferSize || e.responseEnd - e.responseStart < 1) return;
      transfers.push([e.responseStart, e.responseEnd, e.encodedBodySize || e.transferSize]);
      if (transfers.length > 60) transfers = transfers.slice(-60);
      const spans = transfers.slice().sort((a, b) => a[0] - b[0]);
      let busy = 0, bytes = 0, from = -1, to = -1;
      for (const [s, e2, b] of spans) {
        bytes += b;
        if (s > to) { busy += to - from; from = s; to = e2; } else to = Math.max(to, e2);
      }
      busy += to - from;
      if (busy > 300) bw = bytes / busy;
    }
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(recordTransfer))
        .observe({ type: 'resource', buffered: true });
    } catch (e) {}
    // Chrome's own estimate (Mbit/s, capped at 10) keeps one low reading from
    // dragging the tier down; other browsers rely on the measurement alone.
    const bandwidth = () => (slow ? 0 : Math.max(bw, (conn.downlink || 0) * 125 * 0.7));

    // The motion tier is the sharpest one the link can stream at the visitor's own
    // scroll speed: every other frame, with 15% headroom, and never planning for less
    // than a gentle 20 frames/s of scroll. A recent fast scroll is remembered for a
    // couple of seconds so the tier doesn't bounce back mid-flick. Stepping down waits
    // until the link falls well below the current tier's need, so it doesn't flap.
    // Until there is a measurement this picks micro, which costs little either way.
    const needs = (tier, fps) => (tier.kb * 1024 * fps) / 1000 / 0.85; // bytes/ms
    let motion = micro;
    function motionTier() {
      const fps = Math.max(10, scrollFps / 2);
      const now = bandwidth();
      motion = ladder.find((tier) => now >= needs(tier, fps) * (tier === motion ? 0.7 : 1)) || micro;
      return motion;
    }

    // Scroll speed in frames/ms, smoothed; scrollFps is its recent peak in frames/s,
    // decaying over a couple of seconds.
    let velocity = 0;
    let scrollFps = 0;
    let lastTarget = 1;
    let lastVelocityAt = 0;
    function trackVelocity(now) {
      if (lastVelocityAt) {
        const dt = Math.max(1, now - lastVelocityAt);
        velocity += (Math.abs(target - lastTarget) / dt - velocity) * 0.2;
        scrollFps = Math.max(velocity * 1000, scrollFps * Math.exp(-dt / 2000));
      }
      lastTarget = target;
      lastVelocityAt = now;
    }

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
      // A stalled request on a flaky network would hold its slot forever; give up and retry.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), tier.timeout);
      fetch(tier.url(i), { priority, signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          clearTimeout(timeout);
          tier.pending--;
          tier.blobs.set(i, blob);
          if (inWindow(tier, i)) decodeFrame(tier, i);
          pump();
        })
        .catch(() => {
          clearTimeout(timeout);
          tier.pending--;
          tier.inFlight.delete(i);
          setTimeout(pump, 800);
        });
    }

    // Fetch up to `slots` frames of `tier` with strideRank <= maxRank, nearest-first,
    // limited to `ahead` frames in the scroll direction and `behind` frames against it.
    function fill(tier, slots, maxRank, ahead, behind, priority) {
      const center = Math.round(playhead);
      const dir = direction();
      for (let d = 0; slots > 0 && d <= Math.max(ahead, behind); d++) {
        for (const i of d === 0 ? [center] : [center + dir * d, center - dir * d]) {
          if (i < 1 || i > FRAME_COUNT || strideRank[i] > maxRank || tier.inFlight.has(i)) continue;
          if (d > ((i - center) * dir >= 0 ? ahead : behind)) continue;
          fetchInto(tier, i, priority);
          if (--slots <= 0) break;
        }
      }
      return slots;
    }

    function pump() {
      if (!posterLoaded) return;
      const motion = motionTier();
      const resting = velocity < 0.012 && Math.abs(target - playhead) < 2;

      // Whatever carries motion, keep cheap micro frames a step ahead at 1/4 density
      // and across the whole sequence at 1/8, so a sudden fling always has something.
      if (motion !== micro && micro.pending < 2) {
        const left = fill(micro, 2 - micro.pending, 1, 120, 10, 'low');
        if (left > 0) fill(micro, left, 0, FRAME_COUNT, FRAME_COUNT, 'low');
      }

      // A link fast enough for full frames streams them nearest-first, far ahead.
      if (motion === full) {
        fill(full, (isMobile ? 6 : 8) - full.pending, 3, full.fetchAhead, full.fetchBehind, 'high');
        return;
      }

      // Otherwise full frames only sharpen a resting view (or everything, once the
      // motion tier is complete), so they never starve the motion tier.
      if (motion.inFlight.size >= FRAME_COUNT) {
        fill(full, 2 - full.pending, 3, 6, 2, 'high');
      } else if (resting) {
        fill(full, 1 - full.pending, 3, 0, 0, 'high'); // just the frame on screen
      }

      // The motion tier covers the stretch the visitor is about to scroll into at
      // 1/4 then 1/2 density first (an even 15-30 fps beats 8-frame jumps), then the
      // whole sequence at 1/8 so a jump anywhere has something to show.
      // While the full frame under a resting view loads, leave it the bandwidth.
      const sharpHere = full.blobs.has(Math.round(playhead));
      const motionCap = resting && !sharpHere ? 1 : motion.maxInFlight;
      let slots = motionCap - motion.pending;
      if (motion.inFlight.size < FRAME_COUNT) {
        // Small frames are cheap, so look further ahead even at rest: the first scroll
        // from the top would otherwise outrun what has loaded.
        const minLead = motion === micro ? 120 : motion === preview ? 60 : 40;
        const lead = Math.max(minLead, Math.min(300, Math.round(velocity * 4000)));
        const passes = [[1, lead, 10], [2, lead, 10], [0, FRAME_COUNT, FRAME_COUNT],
          [3, lead, 10], [1, FRAME_COUNT, FRAME_COUNT], [3, FRAME_COUNT, FRAME_COUNT]];
        for (const [rank, ahead, behind] of passes) {
          if (slots <= 0) break;
          slots = fill(motion, slots, rank, ahead, behind, ahead < FRAME_COUNT ? 'high' : 'low');
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

    // Draw the frame with the lowest (distance from target + tier penalty): a sharper
    // frame one step away beats a blurrier exact one. Never a frame farther from the
    // target than the one already on screen: when nothing closer is loaded, holding
    // the current image beats jumping backwards.
    let shownFrame = 1;
    let shownTier = full;
    function pickFrame(desired) {
      let best = null;
      let bestScore = Infinity;
      const limit = Math.abs(shownFrame - desired);
      for (const tier of ladder) {
        const f = nearest(tier, desired, Math.min(limit, Math.floor(bestScore - tier.penalty)));
        if (f === null) continue;
        const score = Math.abs(f - desired) + tier.penalty;
        if (score < bestScore) {
          best = [tier, f];
          bestScore = score;
        }
      }
      return best;
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
    // ?herodebug records [desiredFrame, shownFrame, tier rank (3 full .. 0 micro), time]
    // per animation frame.
    const debugLog = /herodebug/.test(location.search) ? (window.__heroLog = []) : null;
    function loop(now) {
      const dt = Math.min(50, now - (lastTime || now));
      lastTime = now;
      if (ready && !document.hidden) {
        const delta = (target - playhead) * (1 - Math.exp(-dt / FOLLOW_TIME_MS));
        const step = Math.max(-dt * 0.45, Math.min(dt * 0.45, delta));
        playhead = Math.max(1, Math.min(FRAME_COUNT, playhead + step));
        updateHeroUI((playhead - 1) / (FRAME_COUNT - 1));

        const pick = pickFrame(Math.round(playhead));
        if (debugLog) {
          const shown = pick || [shownTier, shownFrame];
          window.__heroBw = Math.round(bandwidth());
          debugLog.push([Math.round(playhead), shown[1], shown[0].rank, Math.round(now)]);
        }
        if (pick) {
          const [tier, frame] = pick;
          const key = `${tier.rank}:${frame}:${canvas.width}:${canvas.height}`;
          if (key !== lastRenderKey) {
            draw(tier.bitmaps.get(frame));
            lastRenderKey = key;
            shownFrame = frame;
            shownTier = tier;
          }
        }
        trackVelocity(now);
        if (now - lastMaintenance > 24) {
          maintain(full, isMobile ? 3 : 4);
          maintain(hd, 4);
          maintain(preview, 6);
          maintain(micro, 8);
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
      // The hero is held by CSS (position: sticky inside .hero-track), so layout is
      // final before this script runs; ScrollTrigger only reads progress through it.
      const heroTrigger = ScrollTrigger.create({
        trigger: heroSection.parentElement,
        start: 'top top',
        end: 'bottom bottom',
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          target = frameAt(self.progress);
        }
      });
      // A visitor may already be mid-hero when this runs on a slow connection:
      // start there instead of chasing the playhead up from frame 1.
      target = playhead = frameAt(heroTrigger.progress);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResilientHeroScrub);
  } else {
    initResilientHeroScrub();
  }
})();
