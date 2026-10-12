// Plain logic behind the issues screen, kept free of React Native so it can be tested directly.
import { issueMatcher } from "../shared/issues";

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
