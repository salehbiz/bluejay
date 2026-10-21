/**
 * 60 fps motion-interpolated hero sequence.
 * Cached low-resolution frames support immediate reverse playback;
 * a bounded sharp-frame window keeps image decoding and memory controlled.
 * Contiguous frame selection and fractional blending avoid missing-frame jumps.
 */

(function () {
  'use strict';

  const FRAME_COUNT = 895;
  const SCROLL_LENGTH_VH = 1100;
  const FOLLOW_TIME_MS = 95;

  function getFrameTier() {
    return {dir: window.innerWidth < 768 ? 'hq60-mobile' : 'qhd60-desktop', ext:'jpg'};
  }

  function initResilientHeroScrub() {
    const heroSection = document.querySelector('.section.mod--hero');
    const canvas = document.getElementById('hero-scrub-canvas');
    const posterImg = document.getElementById('hero-scrub-poster');

    if (!heroSection || !canvas) return;

    // Session-locked tier resolution
    const tier = getFrameTier();
    let isMobile = window.innerWidth < 768;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const padFrame = (i) => String(i).padStart(4, '0');
    const framePath = (i) => `/frames/hero/${tier.dir}/${padFrame(i)}.${tier.ext}`;
    const fallbackFramePath = tier.dir === 'desktop-hq'
      ? (i) => `/frames/hero/desktop/${padFrame(i)}.webp`
      : null;
    const posterUrl = framePath(1);
    if (posterImg && posterImg.getAttribute('src') !== posterUrl) {
      posterImg.src = posterUrl;
    }

    if (reduced) {
      const lqip = document.getElementById('hero-lqip');
      if (lqip) lqip.style.display = 'none';
      if (posterImg) posterImg.style.opacity = '1';
      return;
    }

    // State & Caches — Original-quality frames only (no blurry 320x180 preview tier)
    const realBlobs = new Map();
    const realInFlight = new Set();
    const realBitmaps = new Map();
    const decodingFrames = new Set();

    let updateHeroUI = () => {};
    let playhead = 1;
    let target = 1;
    let ready = false;
    let posterLoaded = false;
    let hasDrawnFirst = false;
    let lastDrawn = { frame: -1, quality: null };

    // Resize canvas at native devicePixelRatio for full original crispness
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;
    let lastOrientation = lastWidth > lastHeight ? 'landscape' : 'portrait';

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round((rect.width || window.innerWidth) * dpr));
      const h = Math.max(1, Math.round((rect.height || window.innerHeight) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lastDrawn = { frame: -1, quality: null };
      }
    }

    resizeCanvas();
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const o = w > h ? 'landscape' : 'portrait';
      const widthDiff = Math.abs(w - lastWidth);
      const heightDiff = Math.abs(h - lastHeight);
      const orientationChanged = o !== lastOrientation;
      isMobile = w < 768;
      if (widthDiff > 10 || heightDiff > 150 || orientationChanged) {
        lastWidth = w;
        lastHeight = h;
        lastOrientation = o;
        resizeCanvas();
      }
    });

    // Stride Pyramid Order: 8 -> 4 -> 2 -> 1 for full-resolution frames
    const strideRank = new Uint8Array(FRAME_COUNT + 1);
    for (let i = 1; i <= FRAME_COUNT; i++) {
      if ((i - 1) % 8 === 0) strideRank[i] = 0;
      else if ((i - 1) % 4 === 0) strideRank[i] = 1;
      else if ((i - 1) % 2 === 0) strideRank[i] = 2;
      else strideRank[i] = 3;
    }

    const requiredForReady = isMobile ? 3 : 6;
    const DECODE_WIN = isMobile ? 28 : 48;

    async function fetchFrame(url, priority) {
      let cache = null;
      try {
        if ('caches' in window) {
          cache = await caches.open('frame-cache-hq-v2');
          const matched = await cache.match(url);
          if (matched) return await matched.blob();
        }
      } catch (e) {}

      const res = await fetch(url, { priority });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      if (cache) {
        try {
          cache.put(url, res.clone());
        } catch (e) {}
      }
      return await res.blob();
    }

    function decodeFrame(frameNum) {
      if (realBitmaps.has(frameNum) || decodingFrames.has(frameNum) || !realBlobs.has(frameNum)) return;
      decodingFrames.add(frameNum);
      createImageBitmap(realBlobs.get(frameNum))
        .then((bmp) => {
          decodingFrames.delete(frameNum);
          const curCenter = Math.round(playhead);
          const curTarget = Math.round(target);
          const isKeyframe = (frameNum - 1) % 16 === 0 || frameNum === 1 || frameNum === FRAME_COUNT;
          if (
            isKeyframe ||
            Math.abs(frameNum - curCenter) <= DECODE_WIN ||
            Math.abs(frameNum - curTarget) <= DECODE_WIN
          ) {
            realBitmaps.set(frameNum, bmp);
            if (realBitmaps.size >= requiredForReady) ready = true;
          } else {
            bmp.close();
          }
        })
        .catch(() => decodingFrames.delete(frameNum));
    }

    function pump() {
      if (!posterLoaded) return;
      if (realBlobs.size === FRAME_COUNT) return;

      let inFlightReal = realInFlight.size - realBlobs.size;
      const maxRealInFlight = isMobile ? 10 : 16;
      const center = Math.round(playhead);
      const tgt = Math.round(target);
      const diff = target - playhead;

      while (inFlightReal < maxRealInFlight) {
        let bestFrame = null;
        let bestScore = Infinity;

        for (let i = 1; i <= FRAME_COUNT; i++) {
          if (realInFlight.has(i)) continue;
          const distPlayhead = Math.abs(i - center);
          const distTarget = Math.abs(i - tgt);
          const minDist = Math.min(distPlayhead, distTarget);
          const dirBias = diff >= 0 ? (i >= center ? 0.65 : 1.2) : (i <= center ? 0.65 : 1.2);
          // Immediate window around playhead/target gets highest priority in contiguous order;
          // outside window uses stride pyramid so scrubbing anywhere has sharp keyframes ready.
          let score;
          if (minDist <= DECODE_WIN) {
            score = minDist * dirBias;
          } else {
            score = 1000 + strideRank[i] * 1000 + minDist * dirBias;
          }
          if (score < bestScore) {
            bestScore = score;
            bestFrame = i;
          }
        }

        if (bestFrame === null) break;

        const frameNum = bestFrame;
        realInFlight.add(frameNum);
        inFlightReal++;

        const realUrl = framePath(frameNum);
        const prio = Math.abs(frameNum - center) <= 12 ? 'high' : 'low';

        fetchFrame(realUrl, prio)
          .then((blob) => {
            realBlobs.set(frameNum, blob);
            const curCenter = Math.round(playhead);
            const curTarget = Math.round(target);
            const isKeyframe = (frameNum - 1) % 16 === 0 || frameNum === 1 || frameNum === FRAME_COUNT;
            if (
              isKeyframe ||
              Math.abs(frameNum - curCenter) <= DECODE_WIN ||
              Math.abs(frameNum - curTarget) <= DECODE_WIN
            ) {
              decodeFrame(frameNum);
            }
            pump();
          })
          .catch(() => {
            realInFlight.delete(frameNum);
            setTimeout(pump, 500);
          });
      }
    }

    // Sliding Decode Window for Original-Quality Bitmaps
    function decodeFrames(center) {
      const tgt = Math.round(target);
      const lo = Math.max(1, Math.min(center, tgt) - DECODE_WIN);
      const hi = Math.min(FRAME_COUNT, Math.max(center, tgt) + DECODE_WIN);

      for (const [k, bmp] of realBitmaps) {
        const isKeyframe = (k - 1) % 16 === 0 || k === 1 || k === FRAME_COUNT;
        if ((k < lo || k > hi) && !isKeyframe) {
          bmp.close();
          realBitmaps.delete(k);
        }
      }

      let budget = Math.max(0, (isMobile ? 6 : 10) - decodingFrames.size);
      for (let dist = 0; dist <= DECODE_WIN && budget > 0; dist++) {
        for (const p of [center + dist, center - dist, tgt + dist, tgt - dist]) {
          if (p < 1 || p > FRAME_COUNT) continue;
          if (!realBitmaps.has(p) && realBlobs.has(p) && !decodingFrames.has(p)) {
            decodeFrame(p);
            budget--;
            if (budget <= 0) break;
          }
        }
      }
    }

    function findNearestSharpFrame(desired) {
      const rounded = Math.max(1, Math.min(FRAME_COUNT, Math.round(desired)));
      if (realBitmaps.has(rounded)) return rounded;
      for (let d = 1; d <= FRAME_COUNT; d++) {
        if (rounded - d >= 1 && realBitmaps.has(rounded - d)) return rounded - d;
        if (rounded + d <= FRAME_COUNT && realBitmaps.has(rounded + d)) return rounded + d;
      }
      return null;
    }

    const gpuRenderer=window.createHeroRenderer?.(canvas);
    canvas.addEventListener('hero-renderer-restored',()=>{lastRenderKey='';});
    // GPU compositing with Canvas fallback — always renders original-quality bitmaps.
    function draw(frame, nextFrame = frame, blend = 0) {
      const bmp = realBitmaps.get(frame);
      if (!bmp) return;
      const nextBmp = realBitmaps.get(nextFrame) || bmp;
      const actualBlend = realBitmaps.has(nextFrame) && nextFrame !== frame ? blend : 0;
      if (gpuRenderer) {
        if(!gpuRenderer.draw(bmp, nextBmp, actualBlend)) return;
      } else {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      if (canvas.width === 0 || canvas.height === 0) resizeCanvas();

      const cr = canvas.width / canvas.height;
      const ir = bmp.width / bmp.height;
      let dw = canvas.width, dh = canvas.height, dx = 0, dy = 0;
      if (ir > cr) {
        dh = canvas.height;
        dw = dh * ir;
        dx = (canvas.width - dw) / 2;
      } else {
        dw = canvas.width;
        dh = dw / ir;
        dy = (canvas.height - dh) / 2;
      }

      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, dx, dy, dw, dh);
      // Fractional frames avoid visible stepping during very slow scrolling.
      if (actualBlend > 0) {
        const scale = Math.max(canvas.width / nextBmp.width, canvas.height / nextBmp.height);
        const nw = nextBmp.width * scale, nh = nextBmp.height * scale;
        ctx.globalAlpha = actualBlend;
        ctx.drawImage(nextBmp, (canvas.width-nw)/2, (canvas.height-nh)/2, nw, nh);
        ctx.globalAlpha = 1;
      }

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
    let lastRenderKey = '';
    function loop(now) {
      const dt = Math.min(50, now - (lastTime || now));
      lastTime = now;
      if (ready && !document.hidden) {
        const delta = (target - playhead) * (1 - Math.exp(-dt / FOLLOW_TIME_MS));
        const step = Math.max(-dt * 0.45, Math.min(dt * 0.45, delta));
        playhead = Math.max(1, Math.min(FRAME_COUNT, playhead + step));
        updateHeroUI((playhead - 1) / (FRAME_COUNT - 1));

        const desiredFrame = Math.round(playhead);
        const frame = realBitmaps.has(desiredFrame) ? desiredFrame : findNearestSharpFrame(desiredFrame);
        const key = `${frame}:${canvas.width}:${canvas.height}`;
        if (frame !== null && key !== lastRenderKey) {
          draw(frame, frame, 0);
          lastRenderKey = key;
        }
        if (now - lastMaintenance > 24) {
          decodeFrames(Math.round(playhead));
          pump();
          lastMaintenance = now;
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // Seed Frame 1 from Poster Image Pre-decode
    const seedImg = new Image();
    seedImg.src = posterUrl;
    seedImg.onload = async () => {
      try {
        const bmp = await createImageBitmap(seedImg);
        realBitmaps.set(1, bmp);
        ready = true;
      } catch (e) {}
      posterLoaded = true;
      pump();
    };
    seedImg.onerror = () => {
      posterLoaded = true;
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
