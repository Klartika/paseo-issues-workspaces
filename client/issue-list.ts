// Plain logic behind the issues screen, kept free of React Native so it can be tested directly.
import { issueMatcher } from "../shared/issues";

/** GitHub's page list: both ends, two pages either side of the current one, gaps as "…". */
export function pageItems(page: number, pageCount: number): (number | "gap")[] {
  const shown = new Set([1, 2, pageCount - 1, pageCount]);
  for (let p = page - 2; p <= page + 2; p++) shown.add(p);
  const pages = [...shown].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  for (const p of pages) {
    const last = items[items.length - 1];
    if (typeof last === "number" && p - last > 1) items.push(p - last === 2 ? last + 1 : "gap");
    items.push(p);
  }
  return items;
}

/** A project the picker offers: one of this host's, or one only `remote`'s host has. */
export type ProjectOption = {
  /** Unique across hosts. */
  key: string;
  projectId: string;
  projectName: string;
  repo: string;
  otherProjects: string[];
  /** Paseo's icon for the project, when this host can read it. */
  icon?: { data: string; mimeType: string } | null;
  remote?: RemoteProject;
};

/** The picker appears only when there is a choice to make. */
export function showProjectSelector(options: readonly unknown[]): boolean {
  return options.length > 1;
}

/** The saved project when it is still offered, else the first one. */
export function pickProject<T extends { repo: string }>(options: readonly T[], selectedRepo: string): T | null {
  return options.find((o) => o.repo.toLowerCase() === selectedRepo.toLowerCase()) ?? options[0] ?? null;
}

export type RemoteWorkspace = {
  serverId: string;
  hostLabel: string;
  workspaceId: string;
  name: string;
  branch: string;
  /** Lowercased `owner/repo` of the workspace's remote, when it is on github.com. */
  repo: string | null;
};

/** Workspaces on other hosts that cover issue `n` of `repo`. */
export function findRemoteWorkspaces(
  workspaces: readonly RemoteWorkspace[] | undefined,
  repo: string,
  n: number,
  branchPrefix: string,
): RemoteWorkspace[] {
  if (!workspaces?.length) return [];
  const match = issueMatcher(n, branchPrefix);
  const slug = repo.toLowerCase();
  return workspaces.filter((w) => w.repo === slug && (match.title(w.name) || match.branch(w.branch)));
}

/** A GitHub project on another host. */
export type RemoteProject = {
  serverId: string;
  hostLabel: string;
  projectId: string;
  name: string;
  root: string;
  /** `owner/repo` as GitHub spells it. */
  repo: string;
};

/**
 * Projects to show from other hosts: one per repository this host does not have, from the
 * host listed first by label, then project name.
 */
export function remoteOnlyProjects(localRepos: Iterable<string>, projects: readonly RemoteProject[]): RemoteProject[] {
  const taken = new Set([...localRepos].map((r) => r.toLowerCase()));
  const sorted = [...projects].sort((a, b) => a.hostLabel.localeCompare(b.hostLabel) || a.name.localeCompare(b.name));
  const out: RemoteProject[] = [];
  for (const p of sorted) {
    const key = p.repo.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    out.push(p);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Marks issues covered by a workspace on `serverId`, the host that owns the project. */
export function withRemoteCoverage<T extends { number: number; workspace: { id: string; name: string } | null }>(
  issues: readonly T[],
  workspaces: readonly RemoteWorkspace[] | undefined,
  serverId: string,
  repo: string,
  branchPrefix: string,
): T[] {
  const own = (workspaces ?? []).filter((w) => w.serverId === serverId);
  return issues.map((issue) => {
    const [ws] = findRemoteWorkspaces(own, repo, issue.number, branchPrefix);
    return ws ? { ...issue, workspace: { id: ws.workspaceId, name: ws.name } } : issue;
  });
}
