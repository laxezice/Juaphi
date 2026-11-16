// เมาส์ธรรมดาเลื่อนแถวการ์ดแนวนอนได้ โดยไม่แย่ง trackpad หรือ Ctrl+wheel (zoom)
const attached = new WeakMap();

export function attachTrayScroll(row, { prev, next, hint } = {}) {
  if (attached.has(row)) return attached.get(row);
  const end = () => Math.max(0, row.scrollWidth - row.clientWidth);
  function refresh() {
    const overflow = end() > 1;
    if (prev) { prev.hidden = !overflow; prev.disabled = row.scrollLeft <= 1; }
    if (next) { next.hidden = !overflow; next.disabled = row.scrollLeft >= end() - 1; }
    if (hint) hint.hidden = !overflow;
  }
  function move(delta) {
    const left = Math.max(0, Math.min(end(), row.scrollLeft + delta));
    const changed = Math.abs(left - row.scrollLeft) > 0.5;
    if (changed) row.scrollLeft = left;
    refresh();
    return changed;
  }
  row.addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? row.clientWidth : 1;
    if (move(e.deltaY * unit)) e.preventDefault();
  }, { passive: false });
  row.addEventListener('scroll', refresh, { passive: true });
  row.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const cards = Array.from(row.children);
    const index = cards.findIndex((card) => card === e.target || card.contains?.(e.target));
    const step = e.key === 'ArrowLeft' ? -1 : 1;
    if (cards.length && (index >= 0 || e.key === 'Home' || e.key === 'End')) {
      const target = e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1
        : Math.max(0, Math.min(cards.length - 1, index + step));
      cards[target].focus({ preventScroll: true });
      cards[target].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (e.key === 'Home' || e.key === 'End') move(e.key === 'Home' ? -end() : end());
    } else move(e.key === 'Home' ? -end() : e.key === 'End' ? end() : step * row.clientWidth * 0.75);
    e.preventDefault();
  });
  prev?.addEventListener('click', () => move(-row.clientWidth * 0.75));
  next?.addEventListener('click', () => move(row.clientWidth * 0.75));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(row);
  const controller = { refresh, reset() { row.scrollLeft = 0; refresh(); } };
  attached.set(row, controller);
  refresh();
  return controller;
}
