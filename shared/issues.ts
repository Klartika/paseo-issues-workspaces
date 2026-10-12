import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** New branches are named `<prefix><number>-<slug>`. */
export const BRANCH_PREFIX = "issue/";

const SLUG_LENGTH = 40;

/** `<prefix><n>-<slug>`, the slug cut at a word boundary to at most 40 characters. */
export function branchName(prefix: string, n: number, title: string): string {
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let slug = words.slice(0, SLUG_LENGTH);
  if (words.length > SLUG_LENGTH && words[SLUG_LENGTH] !== "-" && slug.includes("-")) {
    slug = slug.slice(0, slug.lastIndexOf("-"));
  }
  slug = slug.replace(/-+$/, "");
  return slug ? `${prefix}${n}-${slug}` : `${prefix}${n}`;
}

/** `owner/repo` for a github.com remote URL, else null. */
export function parseGitHubRemote(url: string): string | null {
  const m = url
    .trim()
    .match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?github\.com(?::\d+)?[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A workspace covers issue `n` when its title starts with `#n`, or its branch is
 * `<prefix>n-…` or contains `n-` right after a slash.
 */
export function issueMatcher(n: number, branchPrefix: string) {
  const titleRe = new RegExp(`^#${n}\\b`);
  const branchRes = [new RegExp(`(^|/)${n}-`), new RegExp(`^${escapeRegExp(branchPrefix)}${n}-`)];
  return {
    title: (title: string) => titleRe.test(title),
    branch: (branch: string) => branchRes.some((re) => re.test(branch)),
  };
}

const issue = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  /** The workspace in this project that already covers this issue, if one does. */
  workspace: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** A local branch for this issue with no active workspace (e.g. the workspace was archived). */
  orphanBranch: z.string().nullable(),
});
export type Issue = z.infer<typeof issue>;

/** One of this host's projects and the GitHub repository behind it. */
const repoProject = z.object({
  projectId: z.string(),
  projectName: z.string(),
  /** `owner/repo` on github.com. */
  repo: z.string(),
});
export type RepoProject = z.infer<typeof repoProject>;

/** This host's GitHub projects, for the project picker. Makes no GitHub calls. */
export const projectsRpc = defineRpc({
  name: "issues.projects",
  input: z.object({}),
  output: z.object({
    repos: z.array(repoProject),
    /** Git projects without a github.com remote. */
    skipped: z.array(z.object({ projectName: z.string(), reason: z.string() })),
  }),
});

/** Open issues in one repository, newest first, up to 100. */
export const issuesRpc = defineRpc({
  name: "issues.list",
  input: z.object({ projectId: z.string() }),
  output: z.object({ issues: z.array(issue) }),
});

export const createWorkspaceRpc = defineRpc({
  name: "issues.create-workspace",
  input: z.object({ projectId: z.string(), number: z.number() }),
  output: z.object({ workspaceId: z.string(), branch: z.string() }),
});
