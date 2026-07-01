/**
 * Renders the panel strip as SVG.
 *
 * The SVG is generated at runtime from panelLayout.js rather than shipped as
 * a static assets/panel.svg, so that geometry and silkscreen live in one
 * data file (deliberate deviation from spec 4.4's static file, recorded in
 * the milestone report). The generated document keeps the spec's layer
 * structure: background -> silkscreen -> interactive slots, and every
 * interactive element gets an empty <g id="slot-..."> mount point.
 */

import { colors } from './colors.js';
import {
  VIEW, sliders, modeButtons, modeBrackets, display,
  numberedButtons, matrix, editLegends, functionLegends,
  editBrackets, functionBrackets, buttonCenterX
} from './panelLayout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SILK_FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";

function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.appendChild(c);
  return node;
}

function text(str, x, y, { size = 7, fill = colors.silkscreenWhite, anchor = 'middle', weight = 500, spacing = 0.2 } = {}) {
  const lines = String(str).split('\n');
  const t = el('text', {
    x, y,
    fill,
    'text-anchor': anchor,
    'font-family': SILK_FONT,
    'font-size': size,
    'font-weight': weight,
    'letter-spacing': spacing
  });
  lines.forEach((line, i) => {
    const span = el('tspan', { x, dy: i === 0 ? 0 : size + 1 });
    span.textContent = line;
    t.appendChild(span);
  });
  return t;
}

/** Thin silkscreen bracket: a horizontal rule with short end ticks and a centered label. */
function bracket(x1, x2, y, label, fill) {
  const g = el('g');
  const stroke = { stroke: fill, 'stroke-width': 0.7, fill: 'none' };
  g.appendChild(el('path', { d: `M ${x1} ${y + 3} V ${y} H ${x2} V ${y + 3}`, ...stroke }));
  if (label) {
    const mid = (x1 + x2) / 2;
    const t = text(label, mid, y + 2.4, { size: 6.5, fill, weight: 600, spacing: 0.4 });
    t.setAttribute('class', 'bracket-label');
    // Knock the line out behind the label so the text sits "in" the rule.
    // Width is provisional here; finalizeSilkscreen() sizes it from real
    // text metrics once the SVG is in the DOM and fonts have loaded.
    const pad = label.length * 3.3 + 6;
    const knockout = el('rect', { x: mid - pad / 2, y: y - 4, width: pad, height: 8, fill: colors.panelBg, class: 'bracket-knockout' });
    g.appendChild(knockout);
    g.appendChild(t);
  }
  return g;
}

function brushedBackground(defs) {
  // Subtle horizontal brushed-metal streaks via turbulence, at very low
  // contrast over the near-black base.
  defs.appendChild(el('filter', { id: 'brushed', x: 0, y: 0, width: '100%', height: '100%' }, [
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.004 0.9', numOctaves: 2, result: 'noise' }),
    el('feColorMatrix', {
      in: 'noise', type: 'matrix',
      values: '0 0 0 0 0.10  0 0 0 0 0.105  0 0 0 0 0.105  0 0 0 0.06 0'
    })
  ]));

  const g = el('g', { id: 'layer-bg' });
  g.appendChild(el('rect', { x: 0, y: 0, width: VIEW.w, height: VIEW.h, fill: colors.panelBg }));
  g.appendChild(el('rect', { x: 0, y: 0, width: VIEW.w, height: VIEW.h, filter: 'url(#brushed)' }));
  // Top and bottom machined edges of the strip.
  g.appendChild(el('rect', { x: 0, y: 0, width: VIEW.w, height: 1.2, fill: '#2e3132' }));
  g.appendChild(el('rect', { x: 0, y: VIEW.h - 1.2, width: VIEW.w, height: 1.2, fill: '#000000' }));
  return g;
}

function silkscreen() {
  const g = el('g', { id: 'layer-silkscreen' });
  const green = colors.silkscreenGreen;
  const orange = colors.silkscreenOrange;
  const white = colors.silkscreenWhite;

  // Generic model name, no trademarked branding (spec section 18).
  g.appendChild(text('FM6', 14, 30, { size: 16, weight: 600, anchor: 'start', fill: white, spacing: 1 }));
  g.appendChild(text('DIGITAL ALGORITHM SYNTHESIZER', 14, 42, { size: 6.5, weight: 500, anchor: 'start', fill: green, spacing: 0.8 }));

  // Slider labels + scale ticks. Label baseline stays clear of the track
  // recess, which starts at trackTop - cap/2 - 2.
  for (const s of sliders) {
    g.appendChild(text(s.label, s.x, 50, { size: 7.5, fill: green, weight: 600, spacing: 0.6 }));
    for (let i = 0; i <= 10; i++) {
      const y = s.trackTop + (i / 10) * (s.trackBottom - s.trackTop);
      const wTick = i === 0 || i === 5 || i === 10 ? 7 : 4;
      g.appendChild(el('rect', { x: s.x + 8, y: y - 0.35, width: wTick, height: 0.7, fill: white, opacity: 0.55 }));
    }
  }

  // Mode-button labels above their buttons.
  for (const b of modeButtons) {
    const lines = b.label.split('\n').length;
    const yBase = b.y - 4 - (lines - 1) * 8;
    g.appendChild(text(b.label, b.x + b.w / 2, yBase, { size: 7, fill: white, weight: 500 }));
  }
  for (const br of modeBrackets) {
    g.appendChild(bracket(br.x1, br.x2, br.y, br.label, green));
  }

  // Numbered-button matrix silkscreen.
  const m = matrix;
  for (let n = 1; n <= 32; n++) {
    const cx = buttonCenterX(n);
    const row = n <= 16 ? 0 : 1;
    const btnTop = m.rowY[row];
    const btnBot = btnTop + m.btnH;

    const edit = editLegends[n - 1];
    if (edit) {
      const lines = edit.split('\n').length;
      g.appendChild(text(edit, cx, btnTop - 6 - (lines - 1) * 8, { size: 7, fill: green, weight: 500 }));
    }
    const fn = functionLegends[n - 1];
    if (fn) {
      g.appendChild(text(fn, cx, btnBot + 10, { size: 7, fill: orange, weight: 500 }));
    }
  }
  const spanX = (br) => [
    m.x0 + (br.from - 1) % 16 * m.pitch - 2,
    m.x0 + (br.to - 1) % 16 * m.pitch + m.btnW + 2
  ];
  for (const br of editBrackets) {
    const [x1, x2] = spanX(br);
    const row = br.from <= 16 ? 0 : 1;
    g.appendChild(bracket(x1, x2, m.rowY[row] - 25, br.label, green));
  }
  for (const br of functionBrackets) {
    const [x1, x2] = spanX(br);
    const row = br.from <= 16 ? 0 : 1;
    const y = m.rowY[row] + m.btnH + 26;
    // Function brackets hang below their legends: flip the ticks upward.
    const g2 = el('g', { transform: `translate(0 ${y}) scale(1 -1) translate(0 ${-y})` });
    g2.appendChild(bracket(x1, x2, y, br.label, orange));
    // Un-mirror the label text.
    for (const t of g2.querySelectorAll('text')) {
      const ty = y + 2.4;
      t.setAttribute('transform', `translate(0 ${ty}) scale(1 -1) translate(0 ${-ty})`);
    }
    g.appendChild(g2);
  }

  return g;
}

function displayBezel() {
  const g = el('g', { id: 'display-bezel' });
  const d = display.bezel;
  g.appendChild(el('rect', {
    x: d.x, y: d.y, width: d.w, height: d.h, rx: 6,
    fill: colors.bezel, stroke: colors.bezelEdge, 'stroke-width': 1
  }));
  g.appendChild(el('rect', {
    x: d.x + 2, y: d.y + 2, width: d.w - 4, height: d.h - 4, rx: 5,
    fill: 'none', stroke: '#000', 'stroke-width': 1.5, opacity: 0.8
  }));
  return g;
}

/**
 * Builds the full panel SVG.
 * @returns {{ svg: SVGSVGElement, slots: Map<string, SVGGElement> }}
 */
export function renderPanel() {
  const svg = el('svg', {
    viewBox: `0 0 ${VIEW.w} ${VIEW.h}`,
    xmlns: SVG_NS,
    role: 'application',
    'aria-label': 'FM6 control panel'
  });
  const defs = el('defs');
  svg.appendChild(defs);
  svg.appendChild(brushedBackground(defs));
  svg.appendChild(silkscreen());
  svg.appendChild(displayBezel());

  const slotLayer = el('g', { id: 'layer-slots' });
  svg.appendChild(slotLayer);

  const slots = new Map();
  const addSlot = (id) => {
    const s = el('g', { id: `slot-${id}` });
    slotLayer.appendChild(s);
    slots.set(id, s);
    return s;
  };

  for (const s of sliders) addSlot(s.id);
  for (const b of modeButtons) addSlot(b.id);
  for (const b of numberedButtons) addSlot(b.id);
  addSlot('lcd');
  addSlot('led');

  return { svg, slots };
}

/**
 * Resize bracket-label knockout rects to the labels' rendered widths.
 * Needs the SVG mounted in the DOM; call again after fonts finish loading,
 * since text metrics change when the silkscreen font swaps in.
 */
export function finalizeSilkscreen(svg) {
  for (const label of svg.querySelectorAll('text.bracket-label')) {
    const knockout = label.previousElementSibling;
    if (!knockout || !knockout.classList.contains('bracket-knockout')) continue;
    const box = label.getBBox();
    knockout.setAttribute('x', box.x - 3);
    knockout.setAttribute('width', box.width + 6);
  }
}
