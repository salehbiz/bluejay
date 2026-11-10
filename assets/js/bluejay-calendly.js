/* Booking: Calendly's official inline widget, loaded only when the contact
   section comes within a couple of screens, so it never touches first load. */
(() => {
  const box = document.querySelector('.bj-calendly');
  if (!box) return;
  const url = box.dataset.url;
  let started = false;

  const load = () => {
    if (started) return;
    started = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    s.onload = () => {
      box.querySelector('.bj-calendly-status')?.remove();
      window.Calendly.initInlineWidget({ url, parentElement: box });
    };
    s.onerror = () => {
      const p = box.querySelector('.bj-calendly-status');
      if (p) p.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener">Open the booking calendar on Calendly ↗</a>';
    };
    document.body.appendChild(s);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '1500px 0px' });
    io.observe(box);
  } else {
    addEventListener('load', load);
  }
})();
