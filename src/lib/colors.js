function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

// Picks a rainbow hue that isn't already close to an existing type's hue,
// matching the saturation/lightness of the seeded palette.
export function generateDefaultTypeColors(existingAccents = []) {
  const usedHues = existingAccents.map(hexToHue).filter((h) => h !== null);
  let hue = Math.floor(Math.random() * 360);
  let attempts = 0;
  while (usedHues.some((h) => Math.abs(h - hue) < 25) && attempts < 30) {
    hue = Math.floor(Math.random() * 360);
    attempts += 1;
  }
  return {
    accent: hslToHex(hue, 55, 45),
    bg: hslToHex(hue, 42, 16),
  };
}

function hexToHue(hex) {
  const m = hex.replace('#', '');
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}
