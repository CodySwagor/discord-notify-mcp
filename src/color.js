/**
 * Deterministic embed colors derived from a conversation's AI title.
 *
 * The same title always yields the same color, and the hue is spread across the
 * full 360° spectrum so distinct conversations get visibly distinct colors.
 * Saturation and lightness are pinned to a tuned band, so every generated color
 * is vivid-but-not-garish and reads well against Discord's embed background.
 */

// Fixed HSL band: high enough saturation to be colorful, mid lightness so the
// color stays legible on both dark and light Discord themes.
const SATURATION = 0.68;
const LIGHTNESS = 0.58;

// Fallback when there's no title to derive a color from (amber — "attention").
export const DEFAULT_COLOR = 0xf59e0b;

/**
 * FNV-1a hash → unsigned 32-bit integer. Cheap, dependency-free, and scrambles
 * input well enough that similar titles land on unrelated hues.
 *
 * @param {string} str
 * @returns {number}
 */
const hash32 = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/**
 * Convert HSL (each 0–1) to a packed 0xRRGGBB integer for Discord embeds.
 *
 * @param {number} h - hue, 0–1
 * @param {number} s - saturation, 0–1
 * @param {number} l - lightness, 0–1
 * @returns {number}
 */
const hslToInt = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  const seg = Math.floor(h * 6) % 6;
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to255 = (v) => Math.round((v + m) * 255);
  return (to255(r) << 16) | (to255(g) << 8) | to255(b);
};

/**
 * Deterministically map an AI conversation title to a Discord embed color.
 * Returns {@link DEFAULT_COLOR} when no usable title is provided.
 *
 * @param {string} [title]
 * @returns {number} packed 0xRRGGBB color
 */
export const colorForTitle = (title) => {
  const key = (title ?? '').trim();
  if (!key) return DEFAULT_COLOR;
  // 360 discrete hues across the full spectrum — well beyond the 64-color floor.
  const hue = (hash32(key) % 360) / 360;
  return hslToInt(hue, SATURATION, LIGHTNESS);
};
