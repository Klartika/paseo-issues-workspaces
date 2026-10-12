import { describe, expect, it, vi } from "vitest";

vi.mock("@getpaseo/plugin/client", () => ({ getPaseoClient: vi.fn(), useHosts: vi.fn() }));
const { readHost } = await import("./other-hosts");

function fakeApi(workspacePages: unknown[][]) {
  return {
    workspaces: {
      list: async ({ page }: { page: { cursor?: string } }) => {
        const index = Number(page.cursor ?? 0);
        const more = index + 1 < workspacePages.length;
        return { entries: workspacePages[index], pageInfo: { hasMore: more, nextCursor: more ? String(index + 1) : null } };
      },
    },
  } as any;
}

const workspace = (overrides: Record<string, unknown>) => ({
  id: "w",
  projectId: "p",
  name: "name",
  title: null,
  gitRuntime: { currentBranch: "main", remoteUrl: null },
  ...overrides,
});

describe("readHost", () => {
  it("reads every page of workspaces, with each one's repository and branch", async () => {
    const api = fakeApi([
      [workspace({ id: "w1", title: "#1 One", gitRuntime: { currentBranch: "issue/1-one", remoteUrl: "git@github.com:Octo/App.git" } })],
      [workspace({ id: "w2", name: "fallback name", gitRuntime: null })],
    ]);

    const { workspaces } = await readHost(api, "srv_b", "Build box");

    expect(workspaces).toEqual([
      { serverId: "srv_b", hostLabel: "Build box", workspaceId: "w1", name: "#1 One", branch: "issue/1-one", repo: "octo/app" },
      { serverId: "srv_b", hostLabel: "Build box", workspaceId: "w2", name: "fallback name", branch: "", repo: null },
    ]);
  });
});
