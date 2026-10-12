import { describe, expect, it, vi } from "vitest";

vi.mock("@getpaseo/plugin/client", () => ({ getPaseoClient: vi.fn(), useHosts: vi.fn() }));
const { readHost } = await import("./other-hosts");

function fakeApi(projects: unknown[], workspacePages: unknown[][]) {
  return {
    projects: { list: async () => ({ projects }) },
    workspaces: {
      list: async ({ page }: { page: { cursor?: string } }) => {
        const index = Number(page.cursor ?? 0);
        const more = index + 1 < workspacePages.length;
        return { entries: workspacePages[index], pageInfo: { hasMore: more, nextCursor: more ? String(index + 1) : null } };
      },
    },
  } as any;
}

const project = (overrides: Record<string, unknown>) => ({
  projectId: "p",
  projectKey: undefined,
  projectDisplayName: "app",
  projectCustomName: null,
  projectRootPath: "/srv/app",
  projectKind: "git",
  ...overrides,
});

const workspace = (overrides: Record<string, unknown>) => ({
  id: "w",
  projectId: "p",
  name: "name",
  title: null,
  gitRuntime: { currentBranch: "main", remoteUrl: null },
  ...overrides,
});

describe("readHost", () => {
  it("names a project's repository from its project key, even with no workspaces", async () => {
    const api = fakeApi([project({ projectId: "p1", projectKey: "remote:github.com/octo/app" })], [[]]);

    const { projects } = await readHost(api, "srv_b", "Build box");

    expect(projects).toEqual([
      { serverId: "srv_b", hostLabel: "Build box", projectId: "p1", name: "app", root: "/srv/app", repo: "octo/app" },
    ]);
  });

  it("falls back to a workspace's remote when the project key does not name GitHub", async () => {
    const api = fakeApi(
      [project({ projectId: "p1", projectKey: "host:srv_b:/srv/app", projectCustomName: "My app" })],
      [[workspace({ projectId: "p1", gitRuntime: { currentBranch: "x", remoteUrl: "git@github.com:octo/app.git" } })]],
    );

    const { projects } = await readHost(api, "srv_b", "Build box");

    expect(projects).toEqual([expect.objectContaining({ name: "My app", repo: "octo/app" })]);
  });

  it("skips projects that are not git or not on GitHub", async () => {
    const api = fakeApi(
      [
        project({ projectId: "p1", projectKind: "non_git", projectKey: "remote:github.com/octo/app" }),
        project({ projectId: "p2", projectKey: "host:srv_b:/srv/local" }),
      ],
      [[]],
    );

    expect((await readHost(api, "srv_b", "Build box")).projects).toEqual([]);
  });

  it("reads every page of workspaces, with each one's repository and branch", async () => {
    const api = fakeApi(
      [],
      [
        [workspace({ id: "w1", title: "#1 One", gitRuntime: { currentBranch: "issue/1-one", remoteUrl: "git@github.com:Octo/App.git" } })],
        [workspace({ id: "w2", name: "fallback name", gitRuntime: null })],
      ],
    );

    const { workspaces } = await readHost(api, "srv_b", "Build box");

    expect(workspaces).toEqual([
      { serverId: "srv_b", hostLabel: "Build box", workspaceId: "w1", name: "#1 One", branch: "issue/1-one", repo: "octo/app" },
      { serverId: "srv_b", hostLabel: "Build box", workspaceId: "w2", name: "fallback name", branch: "", repo: null },
    ]);
  });
});
