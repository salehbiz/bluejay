/**
 * Site-wide reveals, scrubbed to scroll position (same recipe as RealNY's
 * useScrollReveals): content resolves as you scroll toward it and un-resolves
 * if you scroll back. Native scrolling only; no pinning or parallax.
 *
 *   type     [data-title-anim], [words-rotate-in], [data-text-anim]
 *            word by word, from faint + blurred to sharp
 *   images   [data-img-curtain], .bj-coast
 *            frame opens from an inset clip while the image settles from 1.2x
 *   blocks   [data-tag-anim], form button
 *            fade and rise
 *   groups   .bj-stats
 *            each child fades and rises in turn
 *
 * Everything is scoped to .bj-site, so the scroll-scrubbed hero is untouched.
 */
(function () {
  function initAnimations() {
    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    var SplitText = window.SplitText;

    if (!gsap || !ScrollTrigger) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    var pick = function (sel) {
      return gsap.utils.toArray(sel).filter(function (el) {
        return el.closest('.bj-site');
      });
    };
    var scrub = function (trigger, start, end) {
      return { trigger: trigger, start: start, end: end, scrub: 0.6 };
    };

    pick('[data-title-anim], [words-rotate-in], [data-text-anim]').forEach(function (el) {
      var split = new SplitText(el, { type: 'words', wordsClass: 'reveal-word' });
      gsap.fromTo(
        split.words,
        { opacity: 0.1, filter: 'blur(6px)', y: 8 },
        { opacity: 1, filter: 'blur(0px)', y: 0, ease: 'none', stagger: 0.02, scrollTrigger: scrub(el, 'clamp(top bottom)', 'clamp(top 80%)') }
      );
    });

    pick('[data-img-curtain], .bj-coast').forEach(function (frame) {
      var st = scrub(frame, 'clamp(top bottom)', 'clamp(top 60%)');
      gsap.fromTo(frame, { clipPath: 'inset(10% 6% 10% 6%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: st });
      var media = frame.querySelectorAll(':scope > img, :scope picture');
      if (media.length) gsap.fromTo(media, { scale: 1.2 }, { scale: 1, ease: 'none', scrollTrigger: Object.assign({}, st) });
    });

    pick('[data-tag-anim], .contact-form button').forEach(function (el) {
      if (el.closest('.bj-stats')) return; // animated with its group below
      gsap.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, ease: 'none', scrollTrigger: scrub(el, 'clamp(top bottom)', 'clamp(top 85%)') });
    });

    pick('.bj-stats').forEach(function (group) {
      gsap.fromTo(
        group.children,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, ease: 'none', stagger: 0.15, scrollTrigger: scrub(group, 'clamp(top bottom)', 'clamp(top 65%)') }
      );
    });

    ScrollTrigger.refresh();
  }

  function boot() {
    // Wait for fonts so word splits measure the final typeface.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(initAnimations);
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
