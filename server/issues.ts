import { execCommand, type PluginHandlerContext } from "@getpaseo/plugin/server";
import { branchName, issueMatcher, parseGitHubRemote, type Issue, type Preferences } from "../shared/issues";

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

type Workspace = { id: string; name: string; branch: string; projectId: string };

async function listWorkspaces(paseo: PaseoApi): Promise<Workspace[]> {
  const out: Workspace[] = [];
  let cursor: string | undefined;
  do {
    const page = await paseo.workspaces.list({ page: { limit: 200, cursor } });
    for (const w of page.entries) {
      out.push({
        id: w.id,
        name: w.title ?? w.name,
        branch: w.gitRuntime?.currentBranch ?? "",
        projectId: w.projectId,
      });
    }
    cursor = page.pageInfo.hasMore ? (page.pageInfo.nextCursor ?? undefined) : undefined;
  } while (cursor);
  return out;
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

async function localBranches(root: string): Promise<string[]> {
  const { stdout } = await run("git", ["-C", root, "branch", "--format=%(refname:short)"]);
  return stdout.split("\n").filter(Boolean);
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

function coverage(n: number, branchPrefix: string, workspaces: Workspace[], branches: string[]) {
  const match = issueMatcher(n, branchPrefix);
  const ws = workspaces.find((w) => match.title(w.name) || match.branch(w.branch));
  return {
    workspace: ws ? { id: ws.id, name: ws.name } : null,
    orphanBranch: ws ? null : (branches.find(match.branch) ?? null),
  };
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

/** What coverage needs to know about one project: its workspaces and local branches. */
async function coverageContext(paseo: PaseoApi, p: GitHubProject, workspaces?: Workspace[]) {
  const [all, branches] = await Promise.all([workspaces ?? listWorkspaces(paseo), localBranches(p.project.root)]);
  return { workspaces: all.filter((w) => w.projectId === p.project.id), branches };
}

function toIssues(items: ListItem[], branchPrefix: string, context: { workspaces: Workspace[]; branches: string[] }) {
  return items.map(
    (i): Issue => ({
      number: i.number,
      title: i.title,
      url: i.url,
      ...coverage(i.number, branchPrefix, context.workspaces, context.branches),
    }),
  );
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
export async function issueList(paseo: PaseoApi, prefs: Preferences, { projectId }: { projectId: string }) {
  const { projects } = await githubProjects(await listProjects(paseo));
  const p = projects.find((candidate) => candidate.project.id === projectId);
  if (!p) throw new Error("That project is no longer in Paseo, or no longer has a github.com remote");
  const [items, context] = await Promise.all([listIssues(p.repo), coverageContext(paseo, p)]);
  return { issues: toIssues(items, prefs.branchPrefix, context) };
}

// A double press must not create two worktrees for one issue.
const inFlight = new Set<string>();

export async function createWorkspace(
  paseo: PaseoApi,
  prefs: Preferences,
  { projectId, number: n }: { projectId: string; number: number },
) {
  const key = `${projectId}#${n}`;
  if (inFlight.has(key)) throw new Error(`#${n} is already being created`);
  inFlight.add(key);
  try {
    const { projects } = await githubProjects(await listProjects(paseo));
    const target = projects.find((p) => p.project.id === projectId);
    if (!target) throw new Error("That project is no longer in Paseo, or no longer has a github.com remote");
    const project = target.project;

    const [issue, repo] = await Promise.all([
      gh(["issue", "view", String(n), "--repo", target.repo, "--json", "title,state"]),
      gh(["repo", "view", target.repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"]),
    ]);
    const { title, state } = JSON.parse(issue.stdout) as { title: string; state: string };
    if (state !== "OPEN") throw new Error(`#${n} is ${state.toLowerCase()}`);
    const defaultBranch = repo.stdout.trim();
    if (!defaultBranch) throw new Error(`${target.repo} has no default branch`);

    const own = (await listWorkspaces(paseo)).filter((w) => w.projectId === projectId);
    const existing = coverage(n, prefs.branchPrefix, own, await localBranches(project.root));
    if (existing.workspace) throw new Error(`#${n} already has workspace “${existing.workspace.name}”`);
    if (existing.orphanBranch) throw new Error(`#${n} already has local branch ${existing.orphanBranch}`);

    await run("git", ["-C", project.root, "fetch", target.remote, defaultBranch, "--quiet"]);
    const branch = branchName(prefs.branchPrefix, n, title);
    const workspace = await paseo.workspaces.create({
      title: `#${n} ${title}`,
      source: {
        kind: "worktree",
        cwd: project.root,
        action: "branch-off",
        branchName: branch,
        baseBranch: `${target.remote}/${defaultBranch}`,
      },
    });
    console.log(`created workspace ${workspace.id} for ${target.repo}#${n} on ${branch}`);
    return { workspaceId: workspace.id, branch };
  } finally {
    inFlight.delete(key);
  }
}
