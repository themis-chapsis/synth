/**
 * 2-digit red 7-segment LED (spec section 9).
 *
 * Canvas renderer. Segments are elongated hexagons with mitered ends, lit
 * segments glow softly (shadowBlur), unlit segments stay faintly visible at
 * 15% opacity like a real LED display. Digits carry the slight rightward
 * slant of the original part.
 */

import { colors } from './colors.js';
import { glyphFor } from '../display/segmentFont.js';

// Digit cell geometry in canvas pixels (before the 2x device scale).
const DIGIT_W = 26;
const DIGIT_H = 46;
const THICK = 5;
const GAP = 1.2;      // gap between segment ends
const PITCH = 38;     // digit spacing
const PAD = 10;
const SLANT = 0.05;   // horizontal shear, like the real display
const DPR = 2;

export class SevenSegment {
  /** @param {HTMLElement} host @param {number} digits */
  constructor(host, digits = 2) {
    this.digits = digits;
    this.canvas = document.createElement('canvas');
    this.canvas.width = (PAD * 2 + PITCH * (digits - 1) + DIGIT_W) * DPR;
    this.canvas.height = (PAD * 2 + DIGIT_H) * DPR;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.text = ' '.repeat(digits);
    this.blinkOn = true;
    this.blinkTimer = null;
    this.paint();
  }

  /** @param {string} text right-most `digits` chars are shown */
  setText(text) {
    this.text = text.slice(-this.digits).padStart(this.digits, ' ');
    this.paint();
  }

  /**
   * 2 Hz blink for the Store-mode destination prompt (spec 9). Pass false
   * to stop blinking and stay lit.
   */
  setBlinking(blinking) {
    clearInterval(this.blinkTimer);
    this.blinkTimer = null;
    this.blinkOn = true;
    if (blinking) {
      this.blinkTimer = setInterval(() => {
        this.blinkOn = !this.blinkOn;
        this.paint();
      }, 250);
    }
    this.paint();
  }

  /**
   * Segment center-line endpoints in the digit's local (unslanted) space.
   * Horizontal segments: a (top), g (middle), d (bottom).
   * Verticals: f,b (upper), e,c (lower).
   */
  static segmentPath(ctx, seg, t) {
    const w = DIGIT_W, h = DIGIT_H, half = t / 2;
    const H = (x1, x2, y) => {
      ctx.moveTo(x1 + GAP, y);
      ctx.lineTo(x1 + GAP + half, y - half);
      ctx.lineTo(x2 - GAP - half, y - half);
      ctx.lineTo(x2 - GAP, y);
      ctx.lineTo(x2 - GAP - half, y + half);
      ctx.lineTo(x1 + GAP + half, y + half);
      ctx.closePath();
    };
    const V = (x, y1, y2) => {
      ctx.moveTo(x, y1 + GAP);
      ctx.lineTo(x + half, y1 + GAP + half);
      ctx.lineTo(x + half, y2 - GAP - half);
      ctx.lineTo(x, y2 - GAP);
      ctx.lineTo(x - half, y2 - GAP - half);
      ctx.lineTo(x - half, y1 + GAP + half);
      ctx.closePath();
    };
    switch (seg) {
      case 'a': H(0, w, half); break;
      case 'g': H(0, w, h / 2); break;
      case 'd': H(0, w, h - half); break;
      case 'f': V(half, half, h / 2); break;
      case 'b': V(w - half, half, h / 2); break;
      case 'e': V(half, h / 2, h - half); break;
      case 'c': V(w - half, h / 2, h - half); break;
    }
  }

  paint() {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(DPR, DPR);

    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let d = 0; d < this.digits; d++) {
      const bits = this.blinkOn ? glyphFor(this.text[d]) : 0;
      ctx.save();
      ctx.transform(1, 0, -SLANT, 1, PAD + d * PITCH + DIGIT_H * SLANT, PAD);
      for (let s = 0; s < 7; s++) {
        const on = (bits >> (6 - s)) & 1;
        ctx.beginPath();
        SevenSegment.segmentPath(ctx, order[s], THICK);
        if (on) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = colors.ledRed;
          ctx.shadowColor = colors.ledRed;
          ctx.shadowBlur = 7 * DPR;
        } else {
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = colors.ledRedDim;
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
