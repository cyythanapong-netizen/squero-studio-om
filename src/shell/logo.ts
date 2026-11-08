/**
 * Geometry and specifications for the Squero Studio logo (squero#42).
 *
 * Everything is derived from module m = 13px (stem width of Geist 600 "H" at 100px font-size):
 * - Wordmark: "squero" Geist 600 ink, word space, "studio" Geist 400 muted.
 * - Water: 5 square dots of 1.5m (19.5px) in --signal, spread evenly from first to last ink of "squero".
 *   Sitting at descender(q) + lift + 0.5m (35.6px), so at the top of ripple it never touches "q".
 * - Badge: square ink tile with radius 1m (13px), height matching the wordmark block (top of "d"
 *   to bottom of dots = 127.1px), placed 3m (39px) after "studio".
 *   The product code is in Geist Mono 600, paper color, centered on its ink.
 * - Ripple motion: idle ripple every 5 s; live continuous ripple (1.4 s) when running.
 *   Turned off under prefers-reduced-motion.
 */

export const STEM_M = 13;

export const SQUERO_LOGO_VIEWBOX = {
  x: 0,
  y: -72,
  width: 811.2,
  height: 127.1,
} as const;

export const WATER_DOTS = [0, 78.375, 156.75, 235.125, 313.5] as const;
export const WATER_Y = 35.565;
export const DOT_SIZE = 19.5; // 1.5 * m
export const RIPPLE_LIFT = 13.065; // 0.67 * DOT_SIZE

export const BADGE_GEOMETRY = {
  x: 684.1,
  y: -72,
  size: 127.1,
  radius: 13, // 1 * m
  codeX: 29.2,
  codeY: 84.1,
  codeFontSize: 57.18,
} as const;

export type SqueroLogoProps = {
  product?: string;
  height?: number;
  running?: boolean;
};

export function logoWidth(height: number): number {
  return (height * SQUERO_LOGO_VIEWBOX.width) / SQUERO_LOGO_VIEWBOX.height;
}
