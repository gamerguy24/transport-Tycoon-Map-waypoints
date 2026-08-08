/*
 * drag.js — make a fixed-position overlay draggable.
 *
 * Used by the minimap and the collapsed handle. Both are pinned to a corner by
 * CSS until the player drags one, at which point an inline left/top takes over
 * and the corner rules have to be neutralised (hence clearing right/bottom).
 *
 * Dragging and clicking share the same pointer, so a click is only a click if
 * the pointer barely moved — otherwise letting go of a drag would also fire the
 * handle's "restore the UI" action.
 */

const THRESHOLD = 4;   // px of movement before it counts as a drag

/**
 * @param {HTMLElement} grip    what you press on
 * @param {HTMLElement} target  what actually moves (defaults to the grip)
 * @param {object} opts
 *   position — {x, y} to restore, or null to leave the CSS corner alone
 *   onEnd    — called with {x, y} once a drag finishes
 *   margin   — keep at least this many px on screen
 */
export function makeDraggable(grip, target, opts = {}) {
  target = target || grip;
  const margin = opts.margin ?? 4;

  const clamp = (x, y) => {
    const w = target.offsetWidth || 0;
    const h = target.offsetHeight || 0;
    return {
      x: Math.max(margin, Math.min(window.innerWidth - w - margin, x)),
      y: Math.max(margin, Math.min(window.innerHeight - h - margin, y))
    };
  };

  const place = (x, y) => {
    const p = clamp(x, y);
    // The corner presets set right/bottom; they must go or the element gets
    // stretched between two opposing anchors.
    target.style.right = 'auto';
    target.style.bottom = 'auto';
    target.style.left = p.x + 'px';
    target.style.top = p.y + 'px';
    return p;
  };

  /** Drop the inline position and fall back to whatever the CSS corner says. */
  const reset = () => {
    target.style.left = target.style.top = target.style.right = target.style.bottom = '';
  };

  if (opts.position) place(opts.position.x, opts.position.y);

  let drag = null;

  grip.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;               // leave right-click alone
    const box = target.getBoundingClientRect();
    drag = {
      id: ev.pointerId,
      dx: ev.clientX - box.left,
      dy: ev.clientY - box.top,
      startX: ev.clientX,
      startY: ev.clientY,
      moved: false
    };
    grip.setPointerCapture(ev.pointerId);
  });

  grip.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    if (!drag.moved &&
        Math.abs(ev.clientX - drag.startX) + Math.abs(ev.clientY - drag.startY) < THRESHOLD) return;
    drag.moved = true;
    grip.classList.add('is-dragging');
    ev.preventDefault();
    place(ev.clientX - drag.dx, ev.clientY - drag.dy);
  });

  const finish = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    grip.classList.remove('is-dragging');
    try { grip.releasePointerCapture(ev.pointerId); } catch { /* already gone */ }
    if (!moved) return;

    // Swallow the click that the browser fires after the pointer sequence, so a
    // drag never doubles as a press.
    const swallow = (clickEv) => { clickEv.stopPropagation(); clickEv.preventDefault(); };
    grip.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => grip.removeEventListener('click', swallow, { capture: true }), 0);

    const box = target.getBoundingClientRect();
    opts.onEnd?.({ x: Math.round(box.left), y: Math.round(box.top) });
  };

  grip.addEventListener('pointerup', finish);
  grip.addEventListener('pointercancel', finish);

  // A resized game window must not strand something off screen.
  window.addEventListener('resize', () => {
    if (!target.style.left) return;
    place(parseFloat(target.style.left), parseFloat(target.style.top));
  });

  return { place, reset };
}
