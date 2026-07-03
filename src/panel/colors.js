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

  // Button colours sampled to match the original DX7 (see reference
  // photos). The panel is colour-coded: green = numbered params + memory
  // (select/protect) + NO/YES; periwinkle = the EDIT-navigation buttons
  // (operator select, edit/compare) and the green-legend params above the
  // 32 buttons; red = STORE; tan = FUNCTION and the gold legends below.
  buttonCyan: '#33c9ad', // numbered buttons + memory select (green)
  buttonCyanPressed: '#63e0c9',
  buttonBlueLight: '#8f97e0', // operator select + edit/compare (periwinkle)
  buttonBlueLightPressed: '#adb4ee',
  buttonOrange: '#de6d5b', // STORE (red)
  buttonOrangePressed: '#ec8a7b',
  buttonCream: '#33c9ad', // memory protect + NO/YES (same green)
  buttonCreamPressed: '#63e0c9',
  buttonYellow: '#ddb184', // FUNCTION (tan)
  buttonYellowPressed: '#ecc9a6',

  // Silkscreen legend colours: EDIT params (above the 32 buttons) in
  // periwinkle to match the blue EDIT buttons; FUNCTION params (below) in
  // gold; mode-cluster labels/brackets in white.
  silkscreenGreen: '#7fb56a', // FM6 branding, slider + wheel labels
  silkscreenEdit: '#bcc4ea', // EDIT-mode legends + their brackets
  silkscreenWhite: '#e8e6e0',
  silkscreenOrange: '#d0a860', // FUNCTION-mode legends + their brackets

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
