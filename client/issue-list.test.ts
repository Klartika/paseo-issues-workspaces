import { describe, expect, it } from "vitest";
import {
  findRemoteWorkspaces,
  pageItems,
  pickProject,
  remoteOnlyProjects,
  showProjectSelector,
  withRemoteCoverage,
  type RemoteProject,
  type RemoteWorkspace,
} from "./issue-list";

describe("pageItems", () => {
  const show = (page: number, count: number) => pageItems(page, count).map((x) => (x === "gap" ? "…" : x)).join(" ");

  it.each([
    [1, 1, "1"],
    [1, 3, "1 2 3"],
    [1, 10, "1 2 3 … 9 10"],
    [5, 10, "1 2 3 4 5 6 7 8 9 10"],
    [10, 10, "1 2 … 8 9 10"],
    [6, 20, "1 2 3 4 5 6 7 8 … 19 20"],
    [12, 40, "1 2 … 10 11 12 13 14 … 39 40"],
  ])("page %i of %i shows %s", (page, count, expected) => {
    expect(show(page, count)).toBe(expected);
  });

  it("fills a one-page gap with the page instead of an ellipsis", () => {
    expect(show(5, 9)).toBe("1 2 3 4 5 6 7 8 9");
    expect(pageItems(5, 9)).not.toContain("gap");
  });

  it("always includes the current page exactly once", () => {
    for (let count = 1; count <= 30; count++) {
      for (let page = 1; page <= count; page++) {
        expect(pageItems(page, count).filter((x) => x === page)).toHaveLength(1);
      }
    }
  });
});

describe("showProjectSelector", () => {
  it("is hidden with no projects or one project, since there is nothing to choose", () => {
    expect(showProjectSelector([])).toBe(false);
    expect(showProjectSelector([{}])).toBe(false);
  });

  it("shows with more than one project", () => {
    expect(showProjectSelector([{}, {}])).toBe(true);
  });
});

describe("pickProject", () => {
  const options = [{ repo: "octo/a" }, { repo: "Octo/B" }];

  it("picks the saved project, whatever its casing", () => {
    expect(pickProject(options, "octo/b")).toBe(options[1]);
  });

  it("falls back to the first project when nothing is saved or the saved one is gone", () => {
    expect(pickProject(options, "")).toBe(options[0]);
    expect(pickProject(options, "octo/gone")).toBe(options[0]);
  });

  it("has nothing to pick without projects", () => {
    expect(pickProject([], "octo/a")).toBeNull();
  });
});

describe("findRemoteWorkspaces", () => {
  const ws = (overrides: Partial<RemoteWorkspace>): RemoteWorkspace => ({
    serverId: "srv_b",
    hostLabel: "Build box",
    workspaceId: "wks_1",
    name: "Something",
    branch: "main",
    repo: "octo/repo",
    ...overrides,
  });

  it("finds a workspace by title or branch in the same repository", () => {
    const byTitle = ws({ workspaceId: "t", name: "#42 Crash on start" });
    const byBranch = ws({ workspaceId: "b", branch: "issue/42-crash" });
    const other = ws({ workspaceId: "o", name: "#43 Other" });
    expect(findRemoteWorkspaces([byTitle, byBranch, other], "Octo/Repo", 42, "issue/")).toEqual([byTitle, byBranch]);
  });

  it("ignores the same issue number in another repository", () => {
    expect(findRemoteWorkspaces([ws({ name: "#42 x", repo: "octo/other" })], "octo/repo", 42, "issue/")).toEqual([]);
  });

  it("ignores workspaces whose remote is not on github.com", () => {
    expect(findRemoteWorkspaces([ws({ name: "#42 x", repo: null })], "octo/repo", 42, "issue/")).toEqual([]);
  });

  it("handles no data yet", () => {
    expect(findRemoteWorkspaces(undefined, "octo/repo", 42, "issue/")).toEqual([]);
  });
});

describe("remoteOnlyProjects", () => {
  const project = (overrides: Partial<RemoteProject>): RemoteProject => ({
    serverId: "srv_b",
    hostLabel: "Build box",
    projectId: "p",
    name: "app",
    root: "/srv/app",
    repo: "octo/app",
    ...overrides,
  });

  it("leaves out repositories this host already has, whatever their casing", () => {
    expect(remoteOnlyProjects(["Octo/App"], [project({})])).toEqual([]);
  });

  it("keeps one project per repository, from the host listed first", () => {
    const onZed = project({ serverId: "z", hostLabel: "Zed", projectId: "pz" });
    const onAlpha = project({ serverId: "a", hostLabel: "Alpha", projectId: "pa" });
    expect(remoteOnlyProjects([], [onZed, onAlpha])).toEqual([onAlpha]);
  });

  it("sorts the result by project name", () => {
    const b = project({ name: "beta", repo: "octo/beta" });
    const a = project({ name: "alpha", repo: "octo/alpha" });
    expect(remoteOnlyProjects([], [b, a]).map((p) => p.name)).toEqual(["alpha", "beta"]);
  });
});

describe("withRemoteCoverage", () => {
  const issues = [
    { number: 1, workspace: null },
    { number: 2, workspace: null },
    { number: 3, workspace: null },
  ];
  const ws = (overrides: Partial<RemoteWorkspace>): RemoteWorkspace => ({
    serverId: "srv_b",
    hostLabel: "Build box",
    workspaceId: "w",
    name: "x",
    branch: "",
    repo: "octo/app",
    ...overrides,
  });

  it("marks issues covered by the owning host's workspaces", () => {
    const result = withRemoteCoverage(
      issues,
      [ws({ workspaceId: "w1", name: "#1 One" }), ws({ workspaceId: "w2", branch: "issue/2-two" })],
      "srv_b",
      "Octo/App",
      "issue/",
    );
    expect(result.map((i) => i.workspace)).toEqual([{ id: "w1", name: "#1 One" }, { id: "w2", name: "x" }, null]);
  });

  it("ignores workspaces on other hosts or other repositories", () => {
    const result = withRemoteCoverage(
      issues,
      [ws({ serverId: "srv_c", name: "#1 One" }), ws({ repo: "octo/other", name: "#2 Two" })],
      "srv_b",
      "octo/app",
      "issue/",
    );
    expect(result.every((i) => i.workspace === null)).toBe(true);
  });
});
