function channel(hex: string, index: number) {
  return Number.parseInt(hex.slice(index, index + 2), 16);
}

function linearize(channel: number) {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string) {
  const hex = color.replace("#", "");
  const expanded = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const red = linearize(channel(expanded, 0));
  const green = linearize(channel(expanded, 2));
  const blue = linearize(channel(expanded, 4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio for two opaque sRGB colours. */
export function contrastRatio(foreground: string, background: string) {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
