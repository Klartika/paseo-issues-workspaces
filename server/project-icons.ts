// Project icons as the Paseo app shows them. The plugin SDK has no icon call, so this follows
// the daemon's own rules (0.11.2): a custom icon set in Paseo wins, then a square favicon or
// logo found in the repository.
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";

export type ProjectIcon = { data: string; mimeType: string };

/** Icon file names, best first. */
export const ICON_PATTERNS = [
  "favicon.svg", "favicon.png", "favicon-*.svg", "favicon-*.png", "favico.svg", "favico.png",
  "icon.svg", "icon.png", "app-icon.svg", "app-icon.png", "apple-touch-icon.png",
  "apple-touch-icon-*.png", "icon-*.png", "android-chrome-*.png", "safari-pinned-tab.svg",
  "mstile-*.png", "logo.svg", "logo.png", "favicon.ico", "favico.ico",
];
const PRIORITY_DIRS = ["public", "static", "priv/static", "assets", "images", "img"];
const MONOREPO_DIRS = ["packages", "apps"];
const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".nuxt", ".output", "coverage", ".cache",
  "vendor", "src", "lib", "test", "tests", "__tests__",
]);
const MAX_AUTOMATIC_BYTES = 32 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Paseo keeps a custom icon at `<home>/projects/icons/<sha256 of project id>.bin`. */
export function customIconPath(paseoHome: string, projectId: string) {
  return join(paseoHome, "projects", "icons", `${createHash("sha256").update(projectId).digest("hex")}.bin`);
}

export function paseoHome() {
  return process.env.PASEO_HOME || join(homedir(), ".paseo");
}

function sniff(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG)) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buffer.length >= 6 && buffer.readUInt16LE(0) === 0 && buffer.readUInt16LE(2) === 1 && buffer.readUInt16LE(4) > 0) {
    return "image/x-icon";
  }
  return null;
}

function byExtension(file: string): string {
  const types: Record<string, string> = {
    ".ico": "image/x-icon", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  };
  return types[extname(file).toLowerCase()] ?? "application/octet-stream";
}

function dimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  switch (mimeType) {
    case "image/png":
      return buffer.length >= 24 ? { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) } : null;
    case "image/gif":
      return buffer.length >= 10 ? { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) } : null;
    case "image/jpeg": {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        if (marker >= 0xc0 && marker <= 0xc2) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
      return null;
    }
    case "image/webp": {
      if (buffer.length < 30) return null;
      const chunk = buffer.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      return null;
    }
    // Icons in these formats are trusted to be square, as Paseo does.
    case "image/x-icon":
    case "image/svg+xml":
      return { width: 1, height: 1 };
    default:
      return null;
  }
}

/** The largest PNG frame of an ICO file, which every client can draw. */
function icoPngFrame(buffer: Buffer): Buffer | null {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;
  let best: Buffer | null = null;
  let bestWidth = -1;
  for (let i = 0; i < buffer.readUInt16LE(4); i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > buffer.length) break;
    const width = buffer[entry] === 0 ? 256 : buffer[entry];
    const size = buffer.readUInt32LE(entry + 8);
    const offset = buffer.readUInt32LE(entry + 12);
    if (offset + size > buffer.length) continue;
    const frame = buffer.subarray(offset, offset + size);
    if (frame.length >= 8 && frame.subarray(0, 8).equals(PNG) && width > bestWidth) {
      best = frame;
      bestWidth = width;
    }
  }
  return best;
}

const matches = (name: string, pattern: string) =>
  pattern.includes("*")
    ? new RegExp(`^${pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`).test(name)
    : name === pattern;

async function isFile(path: string) {
  return stat(path).then((s) => s.isFile(), () => false);
}
async function isDir(path: string) {
  return stat(path).then((s) => s.isDirectory(), () => false);
}
async function list(dir: string) {
  return readdir(dir).catch(() => null);
}

async function iconIn(dir: string): Promise<string | null> {
  const entries = await list(dir);
  if (!entries) return null;
  for (const pattern of ICON_PATTERNS) {
    for (const entry of entries) {
      if (matches(entry, pattern) && (await isFile(join(dir, entry)))) return join(dir, entry);
    }
  }
  return null;
}

async function searchTree(dir: string, maxDepth: number, depth = 0): Promise<string | null> {
  if (depth > maxDepth) return null;
  const found = await iconIn(dir);
  if (found) return found;
  for (const entry of (await list(dir)) ?? []) {
    if (IGNORED_DIRS.has(entry) || !(await isDir(join(dir, entry)))) continue;
    const deeper = await searchTree(join(dir, entry), maxDepth, depth + 1);
    if (deeper) return deeper;
  }
  return null;
}

async function searchPriorityDirs(base: string, maxDepth: number) {
  for (const dir of PRIORITY_DIRS) {
    const path = join(base, dir);
    if (await isDir(path)) {
      const found = await searchTree(path, maxDepth);
      if (found) return found;
    }
  }
  return null;
}

/** Where Paseo looks: priority folders, then monorepo packages, then the repository root. */
export async function findIconFile(root: string): Promise<string | null> {
  const priority = await searchPriorityDirs(root, 2);
  if (priority) return priority;
  for (const mono of MONOREPO_DIRS) {
    for (const pkg of (await list(join(root, mono))) ?? []) {
      const path = join(root, mono, pkg);
      if (!(await isDir(path))) continue;
      const found = (await searchPriorityDirs(path, 2)) ?? (await iconIn(path));
      if (found) return found;
    }
  }
  return iconIn(root);
}

/** A square image found in the repository, up to 32 KB. */
export async function automaticIcon(root: string): Promise<ProjectIcon | null> {
  const path = await findIconFile(root);
  if (!path) return null;
  try {
    if ((await stat(path)).size > MAX_AUTOMATIC_BYTES) return null;
    let buffer: Buffer = await readFile(path);
    let mimeType = sniff(buffer) ?? byExtension(path);
    if (mimeType === "image/x-icon") {
      const frame = icoPngFrame(buffer);
      if (frame) {
        buffer = frame;
        mimeType = "image/png";
      }
    }
    const size = dimensions(buffer, mimeType);
    if (!size || size.width !== size.height) return null;
    return { data: buffer.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

/**
 * The icon Paseo shows for a project. With a custom icon recorded, only that file counts, even
 * when it is missing; otherwise one found in the repository.
 */
export async function projectIcon(
  home: string,
  project: { projectId: string; root: string; customIconRevision: string | null },
): Promise<ProjectIcon | null> {
  if (project.customIconRevision) {
    try {
      const custom = await readFile(customIconPath(home, project.projectId));
      const mimeType = sniff(custom);
      return mimeType && custom.length ? { data: custom.toString("base64"), mimeType } : null;
    } catch {
      return null;
    }
  }
  return automaticIcon(project.root);
}

/** Paseo's revision string for an icon, `<source>:<sha256 of mime type and data>`. */
export function iconRevision(source: "automatic" | "custom", icon: ProjectIcon) {
  return `${source}:${createHash("sha256").update(icon.mimeType).update("\0").update(icon.data).digest("hex")}`;
}
