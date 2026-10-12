import type { PluginServerContext } from "@getpaseo/plugin/server";
import { issueList, projectList } from "./server/issues";
import { issuesRpc, projectsRpc } from "./shared/issues";

export default function contribute(server: PluginServerContext) {
  server.handle(projectsRpc, (_input, { paseo }) => projectList(paseo));
  server.handle(issuesRpc, (input, { paseo }) => issueList(paseo, input));
  return () => {};
}
