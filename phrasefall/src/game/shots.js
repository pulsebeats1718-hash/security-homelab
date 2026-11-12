/**
 * Camera shots for each screen, computed from the viewport so the character is
 * always framed properly — portrait phone, tablet or widescreen desktop.
 */
import { clamp } from '../core/utils.js';

const portrait = (s) => s.height > s.width * 1.05;

export const shots = {
  /** Title screen: the character centre stage under the wordmark. */
  title(s) {
    if (portrait(s)) return { fx: 0, fy: 1.15, fz: 0, yaw: -0.2, pitch: 0.11, span: 8.6, ox: 0, oy: s.height * 0.04, drift: 1 };
    return { fx: 0, fy: 1.15, fz: 0, yaw: -0.24, pitch: 0.1, span: 7.4, ox: 0, oy: s.height * 0.05, drift: 1 };
  },

  /** Title + main menu: character large, the island and sky on show. */
  menu(s) {
    if (portrait(s)) return { fx: 0, fy: 1.15, fz: 0, yaw: -0.22, pitch: 0.11, span: clamp(8.4 - (s.height - 640) / 400, 7.0, 8.6), ox: 0, oy: s.height * 0.045, drift: 1 };
    return { fx: 0, fy: 1.15, fz: 0, yaw: -0.3, pitch: 0.1, span: 5.9, ox: s.width * 0.19, oy: s.height * 0.08, drift: 1 };
  },

  /** Character collection: a close turntable view. */
  select(s) {
    if (portrait(s)) return { fx: 0, fy: 1.1, fz: 0, yaw: 0, pitch: 0.09, span: 6.4, ox: 0, oy: -s.height * 0.115, drift: 0.35 };
    return { fx: 0, fy: 1.1, fz: 0, yaw: 0, pitch: 0.09, span: 4.7, ox: -s.width * 0.17, oy: -s.height * 0.02, drift: 0.35 };
  },

  /** Overlays (flashcards, collection, settings): the scene pulls back behind the panel. */
  backdrop(s) {
    return { fx: 0, fy: 2.2, fz: 0, yaw: 0.32, pitch: 0.16, span: 13, ox: 0, oy: 0, drift: 1 };
  },

  /**
   * Gameplay. The ground line sits just above the answer panel and the sky above
   * it is the fall zone. Returns the shot plus the metrics the game needs.
   */
  play(s, panelH, hudH) {
    const groundPx = Math.max(140, s.height - panelH - 14);
    const range = clamp(groundPx / 86, 4.8, 6.7);
    const span = (range * s.height) / groundPx;
    const wpp = span / s.height;
    const usablePx = groundPx - hudH;
    const visibleW = s.width * wpp;
    const scale = Math.min(1, (visibleW * 0.86) / 6, (usablePx * 0.21 * wpp) / 1.7);
    const cardH = 1.7 * scale;
    return {
      shot: { fx: 0, fy: 0, fz: 0, yaw: 0, pitch: 0.1, span, ox: 0, oy: groundPx - s.height / 2, drift: 0 },
      cardScale: scale,
      spawnY: (usablePx - 10) * wpp - cardH / 2,
      cardH,
      wpp,
    };
  },

  /** Game over: the fallen character above the results panel. */
  over(s) {
    if (portrait(s)) return { fx: 0.25, fy: 0.75, fz: 0, yaw: 0.25, pitch: 0.2, span: 9.5, ox: 0, oy: -s.height * 0.3, drift: 0.6 };
    return { fx: 0.25, fy: 0.75, fz: 0, yaw: 0.3, pitch: 0.18, span: 6.2, ox: -s.width * 0.22, oy: s.height * 0.05, drift: 0.6 };
  },
};
