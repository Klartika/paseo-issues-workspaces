import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/** `owner/repo` for a github.com remote URL, else null. */
export function parseGitHubRemote(url: string): string | null {
  const m = url
    .trim()
    .match(/^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?github\.com(?::\d+)?[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

const issue = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
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
