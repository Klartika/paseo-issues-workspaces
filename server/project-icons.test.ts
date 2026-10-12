import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { automaticIcon, customIconPath, findIconFile, iconRevision, projectIcon } from "./project-icons";

let scratch: string;
let count = 0;
beforeEach(() => {
  scratch ??= realpathSync(mkdtempSync(join(tmpdir(), "project-icons-")));
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A PNG header claiming the given size, which is all the size check reads. */
function png(width: number, height: number, padding = 0) {
  const buffer = Buffer.alloc(24 + padding);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/** A project folder holding `files`, keyed by relative path. */
function project(files: Record<string, Buffer | string>) {
  const root = join(scratch, `project-${++count}`);
  mkdirSync(root, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';

describe("findIconFile, following Paseo's search order", () => {
  it("looks in priority folders before the root", () =>
    expect(findIconFile(project({ "logo.png": png(16, 16), "public/favicon.png": png(16, 16) }))).resolves.toMatch(
      /public\/favicon\.png$/,
    ));

  it("prefers better names over worse ones in the same folder", () =>
    expect(findIconFile(project({ "favicon.ico": "x", "logo.svg": svg, "favicon.svg": svg }))).resolves.toMatch(
      /\/favicon\.svg$/,
    ));

  it("matches wildcard names such as apple-touch-icon-180x180.png", () =>
    expect(findIconFile(project({ "apple-touch-icon-180x180.png": png(180, 180) }))).resolves.toMatch(
      /apple-touch-icon-180x180\.png$/,
    ));

  it("searches monorepo packages after priority folders", () =>
    expect(findIconFile(project({ "apps/web/public/favicon.svg": svg }))).resolves.toMatch(
      /apps\/web\/public\/favicon\.svg$/,
    ));

  it("skips ignored folders such as node_modules and src", async () => {
    expect(await findIconFile(project({ "node_modules/pkg/favicon.png": png(16, 16), "src/icon.png": png(16, 16) }))).toBeNull();
  });

  it("does not search arbitrary folders below the root", async () => {
    expect(await findIconFile(project({ "docs/logo.png": png(16, 16) }))).toBeNull();
  });
});

describe("automaticIcon", () => {
  it("returns a square image as base64 with its type", async () => {
    const icon = await automaticIcon(project({ "favicon.png": png(32, 32) }));
    expect(icon).toEqual({ data: png(32, 32).toString("base64"), mimeType: "image/png" });
  });

  it("detects the type from the bytes, not the name", async () => {
    expect((await automaticIcon(project({ "favicon.ico": png(32, 32) })))?.mimeType).toBe("image/png");
  });

  it("trusts SVG to be square", async () => {
    expect((await automaticIcon(project({ "favicon.svg": svg })))?.mimeType).toBe("image/svg+xml");
  });

  it("rejects images that are not square, or larger than 32 KB", async () => {
    expect(await automaticIcon(project({ "logo.png": png(64, 32) }))).toBeNull();
    expect(await automaticIcon(project({ "logo.png": png(16, 16, 33 * 1024) }))).toBeNull();
  });

  it("uses the largest PNG frame of an ICO file", async () => {
    const small = png(16, 16);
    const large = png(32, 32);
    const header = Buffer.alloc(6 + 2 * 16);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(2, 4);
    [small, large].reduce((offset, frame, i) => {
      const entry = 6 + i * 16;
      header[entry] = i === 0 ? 16 : 32;
      header.writeUInt32LE(frame.length, entry + 8);
      header.writeUInt32LE(offset, entry + 12);
      return offset + frame.length;
    }, header.length);

    const icon = await automaticIcon(project({ "favicon.ico": Buffer.concat([header, small, large]) }));

    expect(icon).toEqual({ data: large.toString("base64"), mimeType: "image/png" });
  });

  it("finds nothing in a project without an icon", async () => {
    expect(await automaticIcon(project({ "README.md": "hi" }))).toBeNull();
  });
});

describe("projectIcon", () => {
  it("uses the custom icon Paseo stored for the project", async () => {
    const home = join(scratch, `home-${++count}`);
    mkdirSync(join(home, "projects", "icons"), { recursive: true });
    writeFileSync(customIconPath(home, "prj_1"), png(64, 64));
    const root = project({ "favicon.png": png(16, 16) });

    const icon = await projectIcon(home, { projectId: "prj_1", root, customIconRevision: "rev" });

    expect(icon).toEqual({ data: png(64, 64).toString("base64"), mimeType: "image/png" });
  });

  it("shows nothing, as Paseo does, when the custom icon file is missing", async () => {
    const root = project({ "favicon.png": png(16, 16) });
    expect(await projectIcon(join(scratch, "nowhere"), { projectId: "prj_2", root, customIconRevision: "rev" })).toBeNull();
  });

  it("falls back to the repository's icon without a custom one", async () => {
    const root = project({ "favicon.png": png(16, 16) });
    expect((await projectIcon(scratch, { projectId: "prj_3", root, customIconRevision: null }))?.mimeType).toBe("image/png");
  });
});

describe("iconRevision", () => {
  it("fingerprints an icon the way Paseo does, so results can be checked against the daemon", () => {
    // Paseo reports automatic:<sha256 of "image/svg+xml", NUL, base64 data> for this icon.
    const icon = { data: Buffer.from(svg).toString("base64"), mimeType: "image/svg+xml" };
    expect(iconRevision("automatic", icon)).toMatch(/^automatic:[0-9a-f]{64}$/);
    expect(iconRevision("automatic", icon)).toBe(iconRevision("automatic", { ...icon }));
    expect(iconRevision("automatic", icon)).not.toBe(iconRevision("automatic", { ...icon, mimeType: "image/png" }));
  });
});
