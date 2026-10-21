/**
 * GSAP Scroll-Driven & Interactive Animations Engine
 * Implements:
 * 1. Tag Reveal (.tag, [data-tag-anim])
 * 2. Title Line Split Reveal ([data-title-anim])
 * 3. Body Text Line Split Reveal ([data-text-anim])
 * 4. Words Rotate In (3D X-Axis Flip, [words-rotate-in])
 * 5. Number Count-up ([data-num-anim])
 * 6. Image Scale Zoom Out ([data-img-scale]) & Curtain Reveal ([data-img-curtain])
 * 7. Hover Letter-Swap Link Button Effect ([data-gsap="btn"])
 */
(function () {
  function initAnimations() {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    var SplitText = window.SplitText;

    if (!gsap || !ScrollTrigger) return;
    if (SplitText) {
      gsap.registerPlugin(ScrollTrigger, SplitText);
    } else {
      gsap.registerPlugin(ScrollTrigger);
    }

    var syncMotionCanvas = function () {
      window.dispatchEvent(new Event('scroll'));
    };

    // 1. Tag Reveal
    gsap.utils.toArray('.bj-site .tag, .bj-site [data-tag-anim]').forEach(function (tag) {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: tag,
          start: 'top 90%',
          toggleActions: 'play none none none'
        }
      });
      tl.fromTo(
        tag,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
      );
    });

    // 2. Title Line Split Reveal
    gsap.utils.toArray('.bj-site [data-title-anim]').forEach(function (title) {
      if (SplitText) {
        var split = new SplitText(title, {
          type: 'lines',
          linesClass: 'text-line'
        });
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: title,
            start: 'top 90%'
          }
        });
        tl.fromTo(
          split.lines,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.15
          }
        );
      } else {
        gsap.fromTo(
          title,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: title, start: 'top 90%' }
          }
        );
      }
    });

    // 3. Body Text Line Split Reveal
    gsap.utils.toArray('.bj-site [data-text-anim]').forEach(function (el) {
      var delay = parseFloat(el.getAttribute('data-delay')) || 0;
      if (SplitText) {
        var split = new SplitText(el, {
          type: 'lines',
          linesClass: 'text-line'
        });
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: 'top 90%'
          }
        });
        tl.fromTo(
          split.lines,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.2,
            delay: delay
          }
        );
      } else {
        gsap.fromTo(
          el,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
             delay: delay,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 90%' }
          }
        );
      }
    });

    // 4. Words Rotate In (3D X-Axis Flip)
    gsap.utils.toArray('.bj-site [words-rotate-in]').forEach(function (el) {
      if (SplitText) {
        var split = new SplitText(el, {
          type: 'words',
          wordsClass: 'word'
        });
        gsap.set(el, { perspective: 1000 });
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        });
        tl.fromTo(
          split.words,
          { rotationX: -90, opacity: 0, transformOrigin: '50% 50% -20px' },
          {
            rotationX: 0,
            opacity: 1,
            duration: 1,
            ease: 'power2.out',
            stagger: { amount: 0.6, from: 'end' }
          }
        );
      }
    });

    // 5. Number Count-up
    gsap.utils.toArray('.bj-site [data-num-anim]').forEach(function (el) {
      var raw = el.getAttribute('data-target') || el.textContent || '0';
      var endValue = parseInt(raw.replace(/,/g, ''), 10);
      if (isNaN(endValue)) return;
      var formatComma = raw.indexOf(',') !== -1 || endValue >= 1000;
      var obj = { val: 0 };

      gsap.to(obj, {
        val: endValue,
        duration: 2,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%'
        },
        onUpdate: function () {
          var rounded = Math.floor(obj.val);
          el.textContent = formatComma ? rounded.toLocaleString('en-US') : String(rounded);
        }
      });
    });

    // 6. Image Scale Zoom Out & Curtain Reveal
    gsap.utils.toArray('.bj-site [data-img-scale]').forEach(function (img) {
      var container = img.closest('figure') || img.parentElement;
      gsap.fromTo(
        img,
        { scale: 1.2 },
        {
          scale: 1,
          duration: 1.5,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start: 'top 85%'
          },
          onUpdate: syncMotionCanvas
        }
      );
    });

    gsap.utils.toArray('.bj-site [data-img-curtain]').forEach(function (curtain) {
      gsap.fromTo(
        curtain,
        { clipPath: 'inset(0% 100% 0% 0%)', y: 24 },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          y: 0,
          duration: 1.2,
          ease: 'power3.inOut',
          scrollTrigger: {
            trigger: curtain,
            start: 'top 85%',
            toggleActions: 'play none none none'
          },
          onUpdate: syncMotionCanvas,
          onComplete: function () {
            gsap.set(curtain, { clearProps: 'clipPath,transform' });
            syncMotionCanvas();
          }
        }
      );
    });

    // 7. Hover Letter-Swap Link Button Effect
    if (SplitText) {
      document.querySelectorAll('.bj-site [data-gsap="btn"]').forEach(function (btn) {
        var textEl = btn.querySelector('[data-gsap="btn-text"]');
        if (!textEl || btn.dataset.gsapBtnReady === '1') return;
        btn.dataset.gsapBtnReady = '1';

        var clone = textEl.cloneNode(true);
        clone.classList.add('is-clone');
        textEl.parentElement.appendChild(clone);

        var splitOriginal = new SplitText(textEl, { type: 'chars', charsClass: 'char' });
        var splitClone = new SplitText(clone, { type: 'chars', charsClass: 'char' });

        gsap.set(splitClone.chars, { yPercent: 100 });

        var tl = gsap.timeline({ paused: true });
        tl.to(splitOriginal.chars, {
          yPercent: -100,
          duration: 0.35,
          ease: 'power2.inOut',
          stagger: { amount: 0.18, from: 'start' }
        }).to(
          splitClone.chars,
          {
            yPercent: 0,
            duration: 0.35,
            ease: 'power2.inOut',
            stagger: { amount: 0.18, from: 'start' }
          },
          0
        );

        btn.addEventListener('mouseenter', function () {
          tl.play();
        });
        btn.addEventListener('mouseleave', function () {
          tl.reverse();
        });
      });
    }

    ScrollTrigger.refresh();
  }

  function boot() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        initAnimations();
      });
    } else {
      window.addEventListener('load', initAnimations, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
