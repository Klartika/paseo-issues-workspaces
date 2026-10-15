import type { getPaseoClient } from "@getpaseo/plugin/client";
import {
  agentAvailable,
  branchName,
  defaultAgent,
  offeredEffort,
  renderPrompt,
  type CreateAction,
  type Preferences,
  type ProviderEntry,
} from "../shared/issues";
import type { RemoteProject } from "./issue-list";

type HostApi = ReturnType<typeof getPaseoClient>;

export type IssueDetails = { title: string; state: string; url: string; defaultBranch: string };

/**
 * Creates a workspace for issue `number` on the host that owns `project`, through the app's
 * connection to that host. This host cannot run git there, so the worktree branches from that
 * host's last-fetched copy of the default branch, from `origin`.
 */
export async function createOnHost({
  paseo,
  project,
  number: n,
  details,
  action,
  prefs,
}: {
  paseo: HostApi;
  project: RemoteProject;
  number: number;
  details: IssueDetails;
  action: CreateAction;
  prefs: Pick<Preferences, "branchPrefix" | "agent" | "effort" | "agentPrompt">;
}) {
  if (details.state !== "OPEN") throw new Error(`#${n} is ${details.state.toLowerCase()}`);

  // Chosen before anything is created, so a host with no ready agent is left untouched.
  let agent: string | null = null;
  let effort: string | null = null;
  if (action === "agent") {
    const { entries } = await paseo.providers.snapshot();
    const providers = entries as ProviderEntry[];
    // The configured agent is a choice for this host; that host may not have it.
    agent = prefs.agent && agentAvailable(providers, prefs.agent) ? prefs.agent : defaultAgent(providers);
    if (!agent) throw new Error(`No agent provider is ready on ${project.hostLabel}`);
    effort = offeredEffort(providers, agent, prefs.effort);
  }
  const prompt = agent
    ? renderPrompt(prefs.agentPrompt, { number: String(n), title: details.title, url: details.url, repo: project.repo })
    : null;

  const branch = branchName(prefs.branchPrefix, n, details.title);
  const workspace = await paseo.workspaces.create({
    title: `#${n} ${details.title}`,
    ...(prompt ? { firstAgentContext: { prompt, attachments: [] } } : {}),
    source: {
      kind: "worktree",
      cwd: project.root,
      action: "branch-off",
      branchName: branch,
      baseBranch: `origin/${details.defaultBranch}`,
    },
  });
  if (!agent || !prompt) return { workspaceId: workspace.id, branch, agentId: null, agent: null, effort: null };

  const config = { provider: agent, ...(effort ? { thinkingOptionId: effort } : {}) };
  const started = await workspace.agents.create({ config, prompt }).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Workspace “#${n} ${details.title}” was created on ${project.hostLabel}, but the agent (${agent}) could not start: ${detail}`,
    );
  });
  return { workspaceId: workspace.id, branch, agentId: started.id, agent, effort };
}
