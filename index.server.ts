import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createWorkspace, issueList, projectList } from "./server/issues";
import { createWorkspaceRpc, issuesRpc, projectsRpc } from "./shared/issues";

export default function contribute(server: PluginServerContext) {
  server.handle(projectsRpc, (_input, { paseo }) => projectList(paseo));
  server.handle(issuesRpc, (input, { paseo }) => issueList(paseo, input));
  server.handle(createWorkspaceRpc, (input, { paseo }) => createWorkspace(paseo, input));
  return () => {};
}
