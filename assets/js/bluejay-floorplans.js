/* Floor plans: accessible tabs and a full-screen viewer (pinch or tap to zoom). */
(() => {
  const root = document.getElementById('floor-plans');
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); select(next, true); }
    });
  });

  const viewer = root.querySelector('.bj-fp-viewer');
  const big = viewer.querySelector('img');
  const scroller = viewer.querySelector('.bj-fp-scroll');
  let opener = null;

  const close = () => { if (viewer.open) viewer.close(); };
  viewer.addEventListener('close', () => {
    viewer.classList.remove('is-zoomed');
    document.documentElement.style.overflow = '';
    if (opener) opener.focus();
  });
  viewer.querySelector('.bj-fp-close').addEventListener('click', close);

  root.querySelectorAll('.bj-fp-card').forEach((card) => {
    card.addEventListener('click', () => {
      opener = card;
      const thumb = card.querySelector('img');
      big.src = card.dataset.full;
      big.alt = thumb.alt;
      viewer.classList.remove('is-zoomed');
      document.documentElement.style.overflow = 'hidden';
      if (typeof viewer.showModal === 'function') viewer.showModal();
      else window.open(card.dataset.full, '_blank', 'noopener');
      scroller.scrollTo(0, 0);
    });
  });

  // Tap or click the plan to toggle between fit-to-screen and full size,
  // keeping the point under the finger in view.
  big.addEventListener('click', (e) => {
    const r = big.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const zoomed = viewer.classList.toggle('is-zoomed');
    if (zoomed) {
      big.style.width = Math.max(big.naturalWidth, window.innerWidth * 2) + 'px';
      scroller.scrollTo(fx * scroller.scrollWidth - window.innerWidth / 2, fy * scroller.scrollHeight - window.innerHeight / 2);
    } else {
      big.style.width = '';
    }
  });
})();
