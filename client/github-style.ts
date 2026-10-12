import type { PluginScreenProps } from "@getpaseo/plugin/client";

type Theme = PluginScreenProps["theme"];
type Rgb = { r: number; g: number; b: number };

function parseColor(color: string): Rgb | null {
  const hex = color.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = [...hex].map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  const m = color.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) } : null;
}

/** GitHub's perceived lightness, 0 to 1. */
function perceivedLightness({ r, g, b }: Rgb) {
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
}

function toHsl({ r, g, b }: Rgb) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

const hsla = (h: number, s: number, l: number, a = 1) =>
  `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${Math.min(100, Math.max(0, l)).toFixed(1)}%, ${a})`;

/** Decides GitHub's light or dark label treatment from the screen background. */
export function isDarkTheme(theme: Theme) {
  const bg = parseColor(theme.colors.surface0);
  return bg ? perceivedLightness(bg) < 0.5 : false;
}

/**
 * Label colors computed the way github.com does: solid with black or white text on light
 * backgrounds, and a translucent fill with lightened text and border on dark ones.
 */
export function labelColors(hex: string, dark: boolean) {
  const rgb = parseColor(hex) ?? { r: 0xed, g: 0xed, b: 0xed };
  const lightness = perceivedLightness(rgb);
  if (!dark) {
    return {
      backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      borderColor: lightness > 0.96 ? "rgba(31, 35, 40, 0.15)" : "transparent",
      color: lightness > 0.453 ? "#000000" : "#ffffff",
    };
  }
  const { h, s, l } = toHsl(rgb);
  const lightenBy = Math.max(0, 0.6 - lightness) * 100;
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`,
    borderColor: hsla(h, s, l + lightenBy, 0.3),
    color: hsla(h, s, l + lightenBy),
  };
}

/** GitHub's open-issue green. */
export function openIssueColor(dark: boolean) {
  return dark ? "#3fb950" : "#1a7f37";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 hours ago", "yesterday", "on Oct 3": the phrasing of GitHub's issue list. */
export function timeAgo(iso: string, now = Date.now()) {
  const then = new Date(iso);
  const seconds = Math.max(0, (now - then.getTime()) / 1000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return plural(Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return plural(Math.floor(seconds / 3600), "hour");
  const days = Math.floor(seconds / 86400);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const date = `${MONTHS[then.getMonth()]} ${then.getDate()}`;
  return new Date(now).getFullYear() === then.getFullYear() ? `on ${date}` : `on ${date}, ${then.getFullYear()}`;
}

// GitHub's issue type colors (Primer's scale), light and dark.
const TYPE_COLORS: Record<string, [string, string]> = {
  GRAY: ["#59636e", "#9198a1"],
  BLUE: ["#0969da", "#4493f8"],
  GREEN: ["#1a7f37", "#3fb950"],
  YELLOW: ["#9a6700", "#d29922"],
  ORANGE: ["#bc4c00", "#db6d28"],
  RED: ["#d1242f", "#f85149"],
  PINK: ["#bf3989", "#db61a2"],
  PURPLE: ["#8250df", "#ab7df8"],
};

/** The hex color for a GitHub issue type color name such as RED; gray when unknown. */
export function issueTypeColor(name: string, dark: boolean): string {
  const [light, darkColor] = TYPE_COLORS[name.toUpperCase()] ?? TYPE_COLORS.GRAY;
  return dark ? darkColor : light;
}
