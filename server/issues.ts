import { execCommand, type PluginHandlerContext } from "@getpaseo/plugin/server";
import {
  branchName,
  defaultAgent,
  issueMatcher,
  parseGitHubRemote,
  renderPrompt,
  type CreateAction,
  type Issue,
  type Preferences,
} from "../shared/issues";

type PaseoApi = PluginHandlerContext["paseo"];

const run = (cmd: string, args: string[], cwd?: string) =>
  execCommand(cmd, args, { timeout: 60_000, cwd });

function errorText(error: unknown): string {
  const stderr = (error as { stderr?: unknown })?.stderr;
  if (typeof stderr === "string" && stderr.trim()) return stderr.trim().split("\n")[0];
  return error instanceof Error ? error.message : String(error);
}

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
 * Picks the remote whose repository holds the issues: the one chosen with
 * `gh repo set-default`, then `upstream` (forks keep issues upstream), then `origin`.
 * Returns the reason as a string when the project has no github.com remote.
 */
async function resolveRemote(root: string): Promise<GitHubRemote | string> {
  let stdout: string;
  try {
    ({ stdout } = await run("git", ["-C", root, "config", "--get-regexp", "^remote\\..*\\.(url|gh-resolved)$"]));
  } catch {
    return "no git remote";
  }
  const remotes = new Map<string, { url?: string; resolved?: string }>();
  for (const line of stdout.split("\n")) {
    const m = line.match(/^remote\.(.+)\.(url|gh-resolved) (.*)$/);
    if (!m) continue;
    const entry = remotes.get(m[1]) ?? {};
    if (m[2] === "url") entry.url = m[3];
    else entry.resolved = m[3];
    remotes.set(m[1], entry);
  }
  const github = [...remotes].flatMap(([name, r]) => {
    // gh stores "base", or the chosen owner/repo when it differs from the URL.
    const repo = r.resolved?.includes("/") ? r.resolved : r.url ? parseGitHubRemote(r.url) : null;
    return repo ? [{ name, repo, isDefault: Boolean(r.resolved) }] : [];
  });
  const pick =
    github.find((r) => r.isDefault) ??
    github.find((r) => r.name === "upstream") ??
    github.find((r) => r.name === "origin") ??
    github[0];
  if (!pick) return remotes.size ? "remote is not on github.com" : "no git remote";
  return { remote: pick.name, repo: pick.repo };
}

async function localBranches(root: string): Promise<string[]> {
  const { stdout } = await run("git", ["-C", root, "branch", "--format=%(refname:short)"]);
  return stdout.split("\n").filter(Boolean);
}

async function isLinkedWorktree(root: string): Promise<boolean> {
  try {
    const { stdout } = await run("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"]);
    const [gitDir, commonDir] = stdout.trim().split("\n");
    return gitDir !== commonDir;
  } catch {
    return false;
  }
}

type RepoProjects = {
  repo: string;
  /** Where new workspaces are created: a main checkout rather than a linked worktree. */
  primary: Project;
  remote: string;
  /** Every project on this repository. Their workspaces all count as coverage. */
  projectIds: Set<string>;
  roots: string[];
  otherProjects: string[];
};

/** GitHub repositories behind the host's git projects. Several projects can share one repository. */
async function githubRepos(projects: Project[]) {
  const resolved = await Promise.all(
    projects
      .filter((p) => p.kind === "git")
      .map(async (p) => ({ project: p, remote: await resolveRemote(p.root), linked: await isLinkedWorktree(p.root) })),
  );
  const skipped: { projectName: string; reason: string }[] = [];
  const candidates = new Map<string, typeof resolved>();
  for (const entry of resolved) {
    if (typeof entry.remote === "string") {
      skipped.push({ projectName: entry.project.name, reason: entry.remote });
      continue;
    }
    const key = entry.remote.repo.toLowerCase();
    candidates.set(key, [...(candidates.get(key) ?? []), entry]);
  }
  const repos = new Map<string, RepoProjects>();
  for (const [key, entries] of candidates) {
    entries.sort((a, b) => Number(a.linked) - Number(b.linked) || a.project.name.localeCompare(b.project.name));
    const first = entries[0];
    const remote = first.remote as GitHubRemote;
    repos.set(key, {
      repo: remote.repo,
      primary: first.project,
      remote: remote.remote,
      projectIds: new Set(entries.map((e) => e.project.id)),
      roots: entries.map((e) => e.project.root),
      otherProjects: entries.slice(1).map((e) => e.project.name),
    });
  }
  return { repos, skipped };
}

/** Local branches across every checkout of a repository. Worktrees share theirs. */
async function repoBranches(roots: string[]): Promise<string[]> {
  const lists = await Promise.all(roots.map((root) => localBranches(root).catch(() => [])));
  return [...new Set(lists.flat())];
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
  labels: { name: string; color: string }[];
  author: { login: string } | null;
  createdAt: string;
};

const MAX_ISSUES = 100;

/** Up to 100 open issues in `repo` matching `query`, newest first. */
async function listIssues(repo: string, query: string) {
  const { stdout } = await gh([
    "issue", "list", "--repo", repo, "--state", "open",
    "--search", `${query} sort:created-desc`.trim(),
    "--limit", String(MAX_ISSUES),
    "--json", "number,title,url,labels,author,createdAt",
  ]);
  return JSON.parse(stdout) as ListItem[];
}

/** What coverage needs to know about one repository: its workspaces and local branches. */
async function coverageContext(paseo: PaseoApi, r: RepoProjects, workspaces?: Workspace[]) {
  const [all, branches] = await Promise.all([workspaces ?? listWorkspaces(paseo), repoBranches(r.roots)]);
  return { workspaces: all.filter((w) => r.projectIds.has(w.projectId)), branches };
}

function toIssues(items: ListItem[], branchPrefix: string, context: { workspaces: Workspace[]; branches: string[] }) {
  return items.map(
    (i): Issue => ({
      number: i.number,
      title: i.title,
      url: i.url,
      labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
      // gh lists apps as "app/<name>"; GitHub shows them by name.
      author: i.author?.login.replace(/^app\//, "") ?? null,
      createdAt: i.createdAt,
      ...coverage(i.number, branchPrefix, context.workspaces, context.branches),
    }),
  );
}

const normalizeQuery = (query: string) => query.replace(/\s+/g, " ").trim();

/** This host's GitHub projects, one per repository, for the project picker. */
export async function projectList(paseo: PaseoApi) {
  const { repos, skipped } = await githubRepos(await listProjects(paseo));
  const choices = [...repos.values()].map((r) => ({
    projectId: r.primary.id,
    projectName: r.primary.name,
    repo: r.repo,
    otherProjects: r.otherProjects,
  }));
  choices.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return { repos: choices, skipped };
}

/** One repository's open issues matching `query`. `projectId` names one of this host's projects. */
export async function issueList(
  paseo: PaseoApi,
  prefs: Preferences,
  { projectId, query }: { projectId: string; query: string },
) {
  const { repos } = await githubRepos(await listProjects(paseo));
  const r = [...repos.values()].find((candidate) => candidate.projectIds.has(projectId));
  if (!r) throw new Error("That project is no longer in Paseo, or no longer has a github.com remote");
  const [items, context] = await Promise.all([listIssues(r.repo, normalizeQuery(query)), coverageContext(paseo, r)]);
  return { issues: toIssues(items, prefs.branchPrefix, context) };
}

/** The configured `provider/model`, else the first ready provider with its default model. */
async function resolveAgent(paseo: PaseoApi, configured: string): Promise<string> {
  if (configured) return configured;
  const agent = defaultAgent((await paseo.providers.snapshot()).entries);
  if (!agent) throw new Error("No agent provider is ready on this host. Choose one in the plugin's settings.");
  return agent;
}

// A double press must not create two worktrees for one issue.
const inFlight = new Set<string>();

export async function createWorkspace(
  paseo: PaseoApi,
  prefs: Preferences,
  { projectId, number: n, action }: { projectId: string; number: number; action: CreateAction },
) {
  const key = `${projectId}#${n}`;
  if (inFlight.has(key)) throw new Error(`#${n} is already being created`);
  inFlight.add(key);
  try {
    const { repos } = await githubRepos(await listProjects(paseo));
    const target = [...repos.values()].find((r) => r.projectIds.has(projectId));
    if (!target) throw new Error("That project is no longer in Paseo, or no longer has a github.com remote");
    const project = target.primary;

    const [issue, repo] = await Promise.all([
      gh(["issue", "view", String(n), "--repo", target.repo, "--json", "title,state,url"]),
      gh(["repo", "view", target.repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"]),
    ]);
    const { title, state, url } = JSON.parse(issue.stdout) as { title: string; state: string; url: string };
    if (state !== "OPEN") throw new Error(`#${n} is ${state.toLowerCase()}`);
    const defaultBranch = repo.stdout.trim();
    if (!defaultBranch) throw new Error(`${target.repo} has no default branch`);

    const own = (await listWorkspaces(paseo)).filter((w) => target.projectIds.has(w.projectId));
    const existing = coverage(n, prefs.branchPrefix, own, await repoBranches(target.roots));
    if (existing.workspace) throw new Error(`#${n} already has workspace “${existing.workspace.name}”`);
    if (existing.orphanBranch) throw new Error(`#${n} already has local branch ${existing.orphanBranch}`);

    // Resolved before anything is created, so a missing provider leaves no workspace behind.
    const agent = action === "agent" ? await resolveAgent(paseo, prefs.agent) : null;
    const prompt =
      action === "agent" ? renderPrompt(prefs.agentPrompt, { number: String(n), title, url, repo: target.repo }) : null;

    await run("git", ["-C", project.root, "fetch", target.remote, defaultBranch, "--quiet"]);
    const branch = branchName(prefs.branchPrefix, n, title);
    const workspace = await paseo.workspaces.create({
      title: `#${n} ${title}`,
      // Tells the daemon an agent is coming, so the workspace shows as running right away.
      ...(prompt ? { firstAgentContext: { prompt, attachments: [] } } : {}),
      source: {
        kind: "worktree",
        cwd: project.root,
        action: "branch-off",
        branchName: branch,
        baseBranch: `${target.remote}/${defaultBranch}`,
      },
    });
    console.log(`created workspace ${workspace.id} for ${target.repo}#${n} on ${branch}`);
    if (!agent || !prompt) return { workspaceId: workspace.id, branch, agentId: null, agent: null };

    // The agent runs in the new worktree; the prompt is its first message.
    const started = await workspace.agents.create({ config: { provider: agent }, prompt }).catch((error: unknown) => {
      throw new Error(`Workspace “#${n} ${title}” was created, but the agent (${agent}) could not start: ${errorText(error)}`);
    });
    console.log(`started agent ${started.id} (${agent}) for ${target.repo}#${n}`);
    return { workspaceId: workspace.id, branch, agentId: started.id, agent };
  } finally {
    inFlight.delete(key);
  }
}
