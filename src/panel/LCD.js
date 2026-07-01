/**
 * 16x2 character LCD emulation (spec section 8).
 *
 * Pixel-cell canvas renderer: each cell is 5x8 dots with 1-dot gaps, drawn
 * at SCALE=3 device pixels per dot. OFF dots are drawn at low opacity to
 * simulate the always-visible dot grid of a reflective STN panel. No CRT
 * effects, no fade.
 *
 * Refresh model: redraw happens only when the character buffer changes, and
 * rapid successive updates coalesce into a single paint per animation frame
 * (spec 8.3's 16 ms refresh window). Cursor blink (voice-name edit, later
 * milestone) runs at exactly 1 Hz, 50% duty.
 */

import { colors } from './colors.js';
import { glyphRows } from '../display/lcdCharROM.js';

export const COLS = 16;
export const ROWS = 2;
const DOT_W = 5;
const DOT_H = 8;
const CELL_W = DOT_W + 1; // 1-dot gap
const CELL_H = DOT_H + 1;
const SCALE = 3;
const MARGIN = 2; // dots of backlight margin around the cell grid

export class LCD {
  /** @param {HTMLElement} host element the canvas is appended to */
  constructor(host) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = (COLS * CELL_W - 1 + MARGIN * 2) * SCALE;
    this.canvas.height = (ROWS * CELL_H - 1 + MARGIN * 2) * SCALE;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.imageRendering = 'pixelated';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    /** @type {Uint8Array} 32 character codes, row-major */
    this.buffer = new Uint8Array(COLS * ROWS).fill(0x20);
    this.cursor = null; // {col,row} | null
    this.cursorPhase = true;
    this.paintQueued = false;
    this.blinkTimer = null;
    this.paint();
  }

  /**
   * Replace the whole text buffer. Strings are padded/truncated to 16 chars;
   * chars are mapped through charCodeAt, which lines up with A00 for the
   * ASCII range the firmware uses.
   * @param {string} row0 @param {string} row1
   */
  setText(row0, row1 = '') {
    const put = (str, row) => {
      for (let c = 0; c < COLS; c++) {
        this.buffer[row * COLS + c] = c < str.length ? str.charCodeAt(c) & 0xff : 0x20;
      }
    };
    put(row0, 0);
    put(row1, 1);
    this.requestPaint();
  }

  /** @param {{col:number,row:number}|null} pos */
  setCursor(pos) {
    this.cursor = pos;
    clearInterval(this.blinkTimer);
    this.blinkTimer = null;
    this.cursorPhase = true;
    if (pos) {
      // 1 Hz, 50% duty (spec 8.3).
      this.blinkTimer = setInterval(() => {
        this.cursorPhase = !this.cursorPhase;
        this.requestPaint();
      }, 500);
    }
    this.requestPaint();
  }

  requestPaint() {
    if (this.paintQueued) return;
    this.paintQueued = true;
    requestAnimationFrame(() => {
      this.paintQueued = false;
      this.paint();
    });
  }

  paint() {
    const { ctx, canvas } = this;
    ctx.fillStyle = colors.lcdBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const code = this.buffer[row * COLS + col];
        const rows = glyphRows(code);
        const cellX = (MARGIN + col * CELL_W) * SCALE;
        const cellY = (MARGIN + row * CELL_H) * SCALE;
        const cursorHere = this.cursor && this.cursor.col === col && this.cursor.row === row && this.cursorPhase;

        for (let dy = 0; dy < DOT_H; dy++) {
          const bits = cursorHere && dy === 7 ? 0b11111 : rows[dy];
          for (let dx = 0; dx < DOT_W; dx++) {
            const on = (bits >> (4 - dx)) & 1;
            ctx.fillStyle = colors.lcdChar;
            ctx.globalAlpha = on ? 1 : 0.07; // faint OFF-dot grid
            ctx.fillRect(cellX + dx * SCALE, cellY + dy * SCALE, SCALE - 0.4, SCALE - 0.4);
          }
        }
        ctx.globalAlpha = 1;
      }
    }
  }
}
