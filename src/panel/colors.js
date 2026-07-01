/**
 * Panel color palette.
 *
 * Values are the approximations given in the build spec (section 4.3).
 * NOTE: the spec calls for sampling each value from a high-resolution
 * reference photograph before finalizing; photo sources are blocked by the
 * current network policy, so these remain the spec's approximations and are
 * flagged for verification at the milestone 1 review.
 */
export const colors = {
  panelBg: '#0d0e0e',
  panelBgHi: '#1a1c1c',

  buttonCyan: '#5fb8c9',
  buttonCyanPressed: '#8fd2de',
  buttonBlueLight: '#a8c8d8',
  buttonBlueLightPressed: '#c6dde8',
  buttonOrange: '#c66a5a',
  buttonOrangePressed: '#dd8f80',
  buttonCream: '#ded6c1',
  buttonCreamPressed: '#f0ead9',
  buttonYellow: '#d4a24a',
  buttonYellowPressed: '#e6bd72',

  silkscreenGreen: '#7fb56a',
  silkscreenWhite: '#e8e6e0',
  silkscreenOrange: '#c68a3a',

  ledRed: '#ff4020',
  ledRedDim: '#ff4020', // drawn at 15% opacity for ghost segments

  lcdBg: '#5a8c7a',
  lcdChar: '#0a1a12',

  sliderCap: '#7a9d6f', // avocado-green slider caps
  sliderTrack: '#050606',
  bezel: '#141516',
  bezelEdge: '#2a2c2d'
};

/** Inject the palette as CSS custom properties on :root. */
export function applyColors(root = document.documentElement) {
  const map = {
    '--panel-bg': colors.panelBg,
    '--button-cyan': colors.buttonCyan,
    '--button-cyan-pressed': colors.buttonCyanPressed,
    '--button-blue-light': colors.buttonBlueLight,
    '--button-orange': colors.buttonOrange,
    '--button-cream': colors.buttonCream,
    '--button-yellow': colors.buttonYellow,
    '--silkscreen-green': colors.silkscreenGreen,
    '--silkscreen-white': colors.silkscreenWhite,
    '--silkscreen-orange': colors.silkscreenOrange,
    '--led-red': colors.ledRed,
    '--led-red-dim': colors.ledRedDim,
    '--lcd-bg': colors.lcdBg,
    '--lcd-char': colors.lcdChar
  };
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
}
