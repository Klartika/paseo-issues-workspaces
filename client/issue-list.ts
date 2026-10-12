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
