// Motion: Lenis smooth scrolling, driven by GSAP's ticker so both run on the same clock,
// plus gentle scroll reveals with ScrollTrigger. Everything switches off when the device
// asks for reduced motion.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

const query = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => query.matches;

let lenis = null;
const tick = time => lenis && lenis.raf(time * 1000);

function startLenis() {
  if (lenis || query.matches) return;
  lenis = new Lenis({ duration: 1.05, easing: t => 1 - Math.pow(1 - t, 3), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);   // ScrollTrigger reads Lenis' position
  gsap.ticker.add(tick);                      // Lenis advances on GSAP's frame clock
  gsap.ticker.lagSmoothing(0);
}
function stopLenis() {
  if (!lenis) return;
  gsap.ticker.remove(tick);
  lenis.destroy();
  lenis = null;
}

export function initMotion() {
  startLenis();
  query.addEventListener('change', () => {
    if (query.matches) { stopLenis(); killReveals(); gsap.set('[data-reveal]', { clearProps: 'all' }); }
    else startLenis();
  });
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}
// Modals: stop smooth scrolling behind an open dialog.
export function pauseScroll(on) { if (lenis) on ? lenis.stop() : lenis.start(); }

// ---------- section reveals ----------
let triggers = [];
function killReveals() { triggers.forEach(t => t.kill()); triggers = []; }

// Each panel fades and rises 14px the first time it scrolls into view.
export function reveal(root) {
  killReveals();
  if (query.matches) return;
  const items = [...root.querySelectorAll('.page-head, .hello, .bridge, .toolbar, .tabs, .panel, .big-result, .lane, .kanban')]
    .filter(el => !el.parentElement.closest('.panel, .lane, .big-result'));
  if (!items.length) return;
  items.forEach(el => el.setAttribute('data-reveal', ''));
  gsap.set(items, { autoAlpha: 0, y: 14 });
  triggers = ScrollTrigger.batch(items, {
    start: 'top 94%',
    once: true,
    onEnter: batch => gsap.to(batch, {
      autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.06, overwrite: true,
      clearProps: 'transform,opacity,visibility'
    })
  });
  ScrollTrigger.refresh();
}
