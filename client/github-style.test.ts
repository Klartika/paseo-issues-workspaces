import { describe, expect, it } from "vitest";
import { isDarkTheme, labelColors, openIssueColor, timeAgo } from "./github-style";

const theme = (surface0: string) => ({ colors: { surface0 } }) as Parameters<typeof isDarkTheme>[0];

describe("isDarkTheme", () => {
  it.each([
    ["#0d1117", true],
    ["#000", true],
    ["rgb(22, 27, 34)", true],
    ["#ffffff", false],
    ["#f6f8fa", false],
    ["rgba(255, 255, 255, 1)", false],
  ])("reads %s as dark=%s", (bg, dark) => {
    expect(isDarkTheme(theme(bg))).toBe(dark);
  });

  it("assumes light when the color cannot be read", () => {
    expect(isDarkTheme(theme("transparent"))).toBe(false);
  });
});

describe("labelColors on light themes", () => {
  it("uses the label color as a solid fill", () => {
    expect(labelColors("d73a4a", false).backgroundColor).toBe("rgb(215, 58, 74)");
  });

  it("puts white text on dark labels and black text on light ones, like github.com", () => {
    expect(labelColors("d73a4a", false).color).toBe("#ffffff"); // bug
    expect(labelColors("5319e7", false).color).toBe("#ffffff");
    expect(labelColors("faf99e", false).color).toBe("#000000");
    expect(labelColors("a2eeef", false).color).toBe("#000000"); // enhancement
  });

  it("outlines only near-white labels so they stay visible", () => {
    expect(labelColors("ffffff", false).borderColor).not.toBe("transparent");
    expect(labelColors("d73a4a", false).borderColor).toBe("transparent");
  });
});

describe("labelColors on dark themes", () => {
  it("tints the background with the label color", () => {
    expect(labelColors("d73a4a", true).backgroundColor).toBe("rgba(215, 58, 74, 0.18)");
  });

  it("lightens text for dark labels and leaves light labels alone", () => {
    expect(labelColors("d73a4a", true).color).toBe("hsla(353.9, 66.2%, 77.2%, 1)");
    expect(labelColors("ffffff", true).color).toBe("hsla(0.0, 0.0%, 100.0%, 1)");
  });

  it("draws the border in the text color at 30%", () => {
    const c = labelColors("0e8a16", true);
    expect(c.borderColor).toBe(c.color.replace(/, 1\)$/, ", 0.3)"));
  });
});

describe("labelColors with bad input", () => {
  it("falls back to GitHub's default gray instead of throwing", () => {
    expect(labelColors("not-a-color", false).backgroundColor).toBe("rgb(237, 237, 237)");
  });

  it("accepts three-digit and #-prefixed colors", () => {
    expect(labelColors("#fff", false)).toEqual(labelColors("ffffff", false));
  });
});

describe("openIssueColor", () => {
  it("uses GitHub's greens", () => {
    expect(openIssueColor(false)).toBe("#1a7f37");
    expect(openIssueColor(true)).toBe("#3fb950");
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 9, 12, 12, 0, 0).getTime(); // Oct 12 2026, local noon
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  it.each([
    [ago(10_000), "just now"],
    [ago(minute), "1 minute ago"],
    [ago(30 * minute), "30 minutes ago"],
    [ago(hour), "1 hour ago"],
    [ago(23 * hour), "23 hours ago"],
    [ago(day + hour), "yesterday"],
    [ago(2 * day), "2 days ago"],
    [ago(29 * day), "29 days ago"],
  ])("%s reads %s", (iso, text) => {
    expect(timeAgo(iso, now)).toBe(text);
  });

  it("names the date after a month, adding the year only when it differs", () => {
    expect(timeAgo(new Date(2026, 2, 4, 12).toISOString(), now)).toBe("on Mar 4");
    expect(timeAgo(new Date(2025, 11, 25, 12).toISOString(), now)).toBe("on Dec 25, 2025");
  });

  it("treats a clock-skewed future time as just now", () => {
    expect(timeAgo(new Date(now + 5 * minute).toISOString(), now)).toBe("just now");
  });
});
