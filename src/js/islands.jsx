// Small React "islands": the site itself is plain JavaScript, and these helpers drop
// React Bits components into specific spots on a page.
import { createRoot } from 'react-dom/client';
import BlurText from '../reactbits/BlurText.jsx';
import CountUp from '../reactbits/CountUp.jsx';
import StarBorder from '../reactbits/StarBorder.jsx';
import LightRays from '../reactbits/LightRays.jsx';
import { reducedMotion } from './motion.js';

const roots = new Map(); // element -> React root

function mount(el, node) {
  if (!el) return;
  unmount(el);
  const root = createRoot(el);
  root.render(node);
  roots.set(el, root);
}
export function unmount(el) {
  const r = roots.get(el);
  if (r) { r.unmount(); roots.delete(el); }
}
export function unmountAll() { [...roots.keys()].forEach(unmount); }
export function unmountWithin(container) { [...roots.keys()].filter(el => container.contains(el)).forEach(unmount); }

const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

// Heading whose words un-blur one after another. Plays once per visit.
export function blurHeading(el, text) {
  if (!el) return;
  if (reducedMotion() || sessionStorage.getItem('sd.hello-played')) { el.textContent = text; return; }
  sessionStorage.setItem('sd.hello-played', '1');
  const wrap = document.createElement('div');
  el.replaceWith(wrap);
  mount(wrap, <BlurText as="h1" text={text} animateBy="words" direction="top" delay={90} stepDuration={0.4} blur={8} distance={18} />);
}

// Soft light rays behind the dashboard header, in the site's jade.
export function lightRays(el) {
  if (!el || reducedMotion()) return;
  const dark = isDark();
  mount(el, (
    <LightRays
      raysOrigin="top-center"
      raysColor={dark ? '#4FB39C' : '#2F7D6D'}
      lightMode={!dark}
      raysSpeed={0.45}
      lightSpread={0.9}
      rayLength={1.6}
      intensity={dark ? 0.75 : 0.7}
      glow={0.35}
      haze={0.15}
      followMouse={false}
      cursorShadow={false}
      clickPulse={false}
      noiseAmount={0.04}
      opacity={dark ? 0.6 : 0.6}
    />
  ));
}

// A number that counts up from zero when it comes into view.
export function countUp(el, value, { decimals = 0, separator = ',', prefix = '', suffix = '' } = {}) {
  if (!el) return;
  if (reducedMotion() || !Number.isFinite(value)) return; // the plain number is already in the page
  el.textContent = '';
  mount(el, <CountUp to={value} from={0} duration={1.2} separator={separator} decimals={decimals} prefix={prefix} suffix={suffix} />);
}

// The main call-to-action with a star travelling around its border.
export function starButton(el, { href, label }) {
  if (!el || reducedMotion()) return;
  const dark = isDark();
  mount(el, (
    <StarBorder
      as="a"
      href={href}
      className="btn primary"
      radius={6}
      thickness={1}
      duration={5}
      glow={0.5}
      hover="brighten"
      clickPulse={false}
      theme="dark"
      color={dark ? '#CFEDE4' : '#E9F6F1'}
      backgroundColor="var(--jade)"
      textColor={dark ? '#0E1418' : '#FFFFFF'}
      borderColor="rgba(255,255,255,0.18)"
    >
      {label}
    </StarBorder>
  ));
}
