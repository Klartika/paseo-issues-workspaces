import { getPaseoClient, useHosts } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { parseGitHubRemote, parseProjectKey } from "../shared/issues";
import type { RemoteProject, RemoteWorkspace } from "./issue-list";

export const OTHER_HOSTS_QUERY_KEY = ["other-hosts"];

type HostApi = ReturnType<typeof getPaseoClient>;

/** One host's GitHub projects and workspaces, read through the app's connection to it. */
export async function readHost(paseo: HostApi, serverId: string, hostLabel: string) {
  const workspaces: RemoteWorkspace[] = [];
  const remoteByProject = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const page = await paseo.workspaces.list({ page: { limit: 200, cursor } });
    for (const w of page.entries) {
      const repo = parseGitHubRemote(w.gitRuntime?.remoteUrl ?? "");
      if (repo && !remoteByProject.has(w.projectId)) remoteByProject.set(w.projectId, repo);
      workspaces.push({
        serverId,
        hostLabel,
        workspaceId: w.id,
        name: w.title ?? w.name,
        branch: w.gitRuntime?.currentBranch ?? "",
        repo: repo?.toLowerCase() ?? null,
      });
    }
    cursor = page.pageInfo.hasMore ? (page.pageInfo.nextCursor ?? undefined) : undefined;
  } while (cursor);

  const { projects: entries } = await paseo.projects.list();
  const projects: RemoteProject[] = entries.flatMap((p) => {
    if (p.projectKind !== "git") return [];
    // The project key names the GitHub repository even before the project has a workspace.
    const repo = parseProjectKey(p.projectKey) ?? remoteByProject.get(p.projectId);
    if (!repo) return [];
    return [
      {
        serverId,
        hostLabel,
        projectId: p.projectId,
        name: p.projectCustomName || p.projectDisplayName,
        root: p.projectRootPath,
        repo,
      },
    ];
  });
  return { projects, workspaces };
}

/** Projects and workspaces on every other online host. An unreachable host contributes nothing. */
export function useOtherHosts(currentHostId: string) {
  const others = useHosts().filter((h) => h.serverId !== currentHostId && h.status === "online");
  return useQuery({
    queryKey: [...OTHER_HOSTS_QUERY_KEY, others.map((h) => h.serverId).sort().join(",")],
    enabled: others.length > 0,
    queryFn: async () => {
      const results = await Promise.allSettled(
        others.map((host) => readHost(getPaseoClient(host.serverId), host.serverId, host.label)),
      );
      const fulfilled = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      return {
        projects: fulfilled.flatMap((r) => r.projects),
        workspaces: fulfilled.flatMap((r) => r.workspaces),
      };
    },
  });
}
