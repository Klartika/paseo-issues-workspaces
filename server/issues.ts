import { execCommand, type PluginHandlerContext } from "@getpaseo/plugin/server";
import { parseGitHubRemote } from "../shared/issues";

type PaseoApi = PluginHandlerContext["paseo"];

const run = (cmd: string, args: string[], cwd?: string) =>
  execCommand(cmd, args, { timeout: 60_000, cwd });

// The desktop-managed daemon does not inherit a login shell's PATH, so Homebrew's
// bin directory is usually missing from it.
let ghPath: Promise<string> | undefined;
function findGh() {
  ghPath ??= (async () => {
    for (const p of ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/home/linuxbrew/.linuxbrew/bin/gh", "gh"]) {
      try {
        await run(p, ["--version"]);
        return p;
      } catch {}
    }
    throw new Error("GitHub CLI (gh) is not installed on this host. Install it, then run `gh auth login`.");
  })().catch((error) => {
    ghPath = undefined;
    throw error;
  });
  return ghPath;
}

async function gh(args: string[]) {
  return run(await findGh(), args);
}

type Project = { id: string; name: string; root: string; kind: string };

async function listProjects(paseo: PaseoApi): Promise<Project[]> {
  const { projects } = await paseo.projects.list();
  return projects.map((p) => ({
    id: p.projectId,
    name: p.projectCustomName || p.projectDisplayName,
    root: p.projectRootPath,
    kind: p.projectKind,
  }));
}

type GitHubRemote = { remote: string; repo: string };

/**
 * The project's `origin` remote and the github.com repository it points at.
 * Returns the reason as a string when there is none.
 */
async function resolveRemote(root: string): Promise<GitHubRemote | string> {
  let stdout: string;
  try {
    ({ stdout } = await run("git", ["-C", root, "remote", "get-url", "origin"]));
  } catch {
    return "no origin remote";
  }
  const repo = parseGitHubRemote(stdout);
  if (!repo) return "remote is not on github.com";
  return { remote: "origin", repo };
}

type GitHubProject = {
  project: Project;
  /** `owner/repo` on github.com. */
  repo: string;
  remote: string;
};

/** The host's git projects that have a github.com remote. */
async function githubProjects(projects: Project[]) {
  const resolved = await Promise.all(
    projects
      .filter((p) => p.kind === "git")
      .map(async (p) => ({ project: p, remote: await resolveRemote(p.root) })),
  );
  const skipped: { projectName: string; reason: string }[] = [];
  const found: GitHubProject[] = [];
  for (const entry of resolved) {
    if (typeof entry.remote === "string") {
      skipped.push({ projectName: entry.project.name, reason: entry.remote });
      continue;
    }
    found.push({ project: entry.project, repo: entry.remote.repo, remote: entry.remote.remote });
  }
  return { projects: found, skipped };
}

/** One issue as `gh issue list --json` prints it. */
type ListItem = {
  number: number;
  title: string;
  url: string;
};

const MAX_ISSUES = 100;

/** Up to 100 open issues in `repo`, newest first. */
async function listIssues(repo: string) {
  const { stdout } = await gh([
    "issue", "list", "--repo", repo, "--state", "open",
    "--limit", String(MAX_ISSUES),
    "--json", "number,title,url",
  ]);
  return JSON.parse(stdout) as ListItem[];
}

/** This host's GitHub projects, for the project picker. */
export async function projectList(paseo: PaseoApi) {
  const { projects, skipped } = await githubProjects(await listProjects(paseo));
  const choices = projects.map((p) => ({
    projectId: p.project.id,
    projectName: p.project.name,
    repo: p.repo,
  }));
  choices.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { repos: choices, skipped };
}

/** One project's open issues. `projectId` names one of this host's projects. */
export async function issueList(paseo: PaseoApi, { projectId }: { projectId: string }) {
  const { projects } = await githubProjects(await listProjects(paseo));
  const p = projects.find((candidate) => candidate.project.id === projectId);
  if (!p) throw new Error("That project is no longer in Paseo, or no longer has a github.com remote");
  return { issues: await listIssues(p.repo) };
}
