import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "../shared/issues";
import type { RemoteProject } from "./issue-list";
import { createOnHost, type IssueDetails } from "./remote-create";

const project: RemoteProject = {
  serverId: "srv_box",
  hostLabel: "Build box",
  projectId: "prj_1",
  name: "widgets",
  root: "/home/me/widgets",
  repo: "octo/widgets",
};

const details: IssueDetails = {
  title: "Crash on start",
  state: "OPEN",
  url: "https://github.com/octo/widgets/issues/42",
  defaultBranch: "trunk",
};

function fakeHost({ providers = [] as unknown[], agentError }: { providers?: unknown[]; agentError?: Error } = {}) {
  const created: any[] = [];
  const agents: any[] = [];
  const paseo = {
    providers: { snapshot: async () => ({ entries: providers }) },
    workspaces: {
      create: async (options: any) => {
        created.push(options);
        return {
          id: "wks_remote",
          agents: {
            create: async (options: any) => {
              agents.push(options);
              if (agentError) throw agentError;
              return { id: "agt_remote" };
            },
          },
        };
      },
    },
  };
  return { paseo: paseo as any, created, agents };
}

const ready = (provider: string, ...models: { id: string; isDefault?: boolean }[]) => ({
  provider,
  status: "ready",
  models,
});

describe("createOnHost", () => {
  it("creates a worktree on that host from its origin's default branch", async () => {
    const { paseo, created, agents } = fakeHost();

    const result = await createOnHost({ paseo, project, number: 42, details, action: "create", prefs: DEFAULT_PREFERENCES });

    expect(result).toEqual({ workspaceId: "wks_remote", branch: "issue/42-crash-on-start", agentId: null, agent: null });
    expect(created).toEqual([
      {
        title: "#42 Crash on start",
        source: {
          kind: "worktree",
          cwd: "/home/me/widgets",
          action: "branch-off",
          branchName: "issue/42-crash-on-start",
          baseBranch: "origin/trunk",
        },
      },
    ]);
    expect(agents).toEqual([]);
  });

  it("refuses a closed issue without touching the host", async () => {
    const { paseo, created } = fakeHost();
    await expect(
      createOnHost({ paseo, project, number: 42, details: { ...details, state: "CLOSED" }, action: "create", prefs: DEFAULT_PREFERENCES }),
    ).rejects.toThrow("#42 is closed");
    expect(created).toEqual([]);
  });

  it("starts that host's default agent with the agent prompt", async () => {
    const { paseo, created, agents } = fakeHost({ providers: [ready("claude", { id: "opus", isDefault: true })] });

    const result = await createOnHost({
      paseo,
      project,
      number: 42,
      details,
      action: "agent",
      prefs: { ...DEFAULT_PREFERENCES, agentPrompt: "Fix {repo}#{number}: {title} {url}" },
    });

    const prompt = "Fix octo/widgets#42: Crash on start https://github.com/octo/widgets/issues/42";
    expect(result).toMatchObject({ agentId: "agt_remote", agent: "claude/opus" });
    expect(created[0].firstAgentContext).toEqual({ prompt, attachments: [] });
    expect(agents).toEqual([{ config: { provider: "claude/opus" }, prompt }]);
  });

  it("uses the configured agent when that host offers it", async () => {
    const { paseo, agents } = fakeHost({
      providers: [ready("claude", { id: "opus", isDefault: true }), ready("codex", { id: "gpt-5.5" })],
    });

    await createOnHost({ paseo, project, number: 1, details, action: "agent", prefs: { ...DEFAULT_PREFERENCES, agent: "codex/gpt-5.5" } });

    expect(agents[0].config.provider).toBe("codex/gpt-5.5");
  });

  it("falls back to that host's default when it lacks the configured agent", async () => {
    const { paseo, agents } = fakeHost({ providers: [ready("claude", { id: "opus", isDefault: true })] });

    await createOnHost({ paseo, project, number: 1, details, action: "agent", prefs: { ...DEFAULT_PREFERENCES, agent: "codex/gpt-5.5" } });

    expect(agents[0].config.provider).toBe("claude/opus");
  });

  it("creates nothing when that host has no ready agent", async () => {
    const { paseo, created } = fakeHost({ providers: [{ provider: "claude", status: "loading", models: [] }] });

    await expect(
      createOnHost({ paseo, project, number: 1, details, action: "agent", prefs: DEFAULT_PREFERENCES }),
    ).rejects.toThrow("No agent provider is ready on Build box");
    expect(created).toEqual([]);
  });

  it("says the workspace exists, and where, when the agent fails to start", async () => {
    const { paseo } = fakeHost({
      providers: [ready("claude", { id: "opus" })],
      agentError: new Error("model not found"),
    });

    await expect(
      createOnHost({ paseo, project, number: 7, details, action: "agent", prefs: DEFAULT_PREFERENCES }),
    ).rejects.toThrow("Workspace “#7 Crash on start” was created on Build box, but the agent (claude/opus) could not start: model not found");
  });
});
