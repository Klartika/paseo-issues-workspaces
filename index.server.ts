import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createWorkspace, issueList, projectList } from "./server/issues";
import {
  createWorkspaceRpc,
  DEFAULT_PREFERENCES,
  effectivePreferences,
  issuesRpc,
  preferences,
  projectsRpc,
} from "./shared/issues";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  const readPreferences = async () => {
    const state = await settings.read();
    return state.status === "ready" ? effectivePreferences(state.values) : DEFAULT_PREFERENCES;
  };

  server.handle(projectsRpc, (_input, { paseo }) => projectList(paseo));
  server.handle(issuesRpc, async (input, { paseo }) => issueList(paseo, await readPreferences(), input));
  server.handle(createWorkspaceRpc, async (input, { paseo }) =>
    createWorkspace(paseo, await readPreferences(), input),
  );
  return () => {};
}
