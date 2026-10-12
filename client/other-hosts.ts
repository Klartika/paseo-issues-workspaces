import { getPaseoClient, useHosts } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { parseGitHubRemote } from "../shared/issues";
import type { RemoteWorkspace } from "./issue-list";

export const OTHER_HOSTS_QUERY_KEY = ["other-hosts"];

type HostApi = ReturnType<typeof getPaseoClient>;

/** One host's workspaces, read through the app's connection to it. */
export async function readHost(paseo: HostApi, serverId: string, hostLabel: string) {
  const workspaces: RemoteWorkspace[] = [];
  let cursor: string | undefined;
  do {
    const page = await paseo.workspaces.list({ page: { limit: 200, cursor } });
    for (const w of page.entries) {
      const repo = parseGitHubRemote(w.gitRuntime?.remoteUrl ?? "");
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

  return { workspaces };
}

/** Workspaces on every other online host. An unreachable host contributes nothing. */
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
      return { workspaces: fulfilled.flatMap((r) => r.workspaces) };
    },
  });
}
