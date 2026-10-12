import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { issuesRpc, type Density, type Issue, type RepoProject } from "../shared/issues";
import { findRemoteWorkspaces, type RemoteWorkspace } from "./issue-list";
import { IssueRow } from "./issue-row";

export const ISSUES_QUERY_KEY = ["issues.list"];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The selected project's issues as a GitHub-style table, newest first. */
export function RepoTable({
  project,
  query,
  density,
  branchPrefix,
  otherHostWorkspaces,
  pendingNumber,
  busy,
  onCreate,
  theme,
  layout,
  navigation,
}: Pick<PluginScreenProps, "theme" | "layout" | "navigation"> & {
  project: RepoProject;
  query: string;
  density: Density;
  branchPrefix: string;
  /** Every other host's workspaces, linked from the issues they cover. */
  otherHostWorkspaces: RemoteWorkspace[] | undefined;
  /** The issue number being created, if any. */
  pendingNumber: number | null;
  busy: boolean;
  onCreate: (issue: Issue) => void;
}) {
  const fetchIssues = useRpc(issuesRpc);
  const result = useQuery({
    queryKey: [...ISSUES_QUERY_KEY, project.projectId, query],
    queryFn: () => fetchIssues({ projectId: project.projectId, query }),
  });

  const issues = result.data?.issues ?? [];

  const s = useMemo(
    () => ({
      box: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 6,
        backgroundColor: theme.colors.surface0,
      },
      error: { color: theme.colors.statusDanger, paddingVertical: 12, paddingHorizontal: 16 },
      empty: { color: theme.colors.foregroundMuted, paddingVertical: 24, textAlign: "center" as const },
      loading: { paddingVertical: 24 },
    }),
    [theme],
  );

  return (
    <View style={s.box}>
      {result.isError ? <Text style={s.error}>Could not load issues: {message(result.error)}</Text> : null}
      {result.isPending ? (
        <View style={s.loading}>
          <ActivityIndicator color={theme.colors.foregroundMuted} />
        </View>
      ) : null}
      {result.isSuccess && !issues.length ? <Text style={s.empty}>No results matched your search.</Text> : null}
      {issues.map((issue, index) => (
        <IssueRow
          key={issue.number}
          issue={issue}
          density={density}
          elsewhere={
            issue.workspace ? [] : findRemoteWorkspaces(otherHostWorkspaces, project.repo, issue.number, branchPrefix)
          }
          first={index === 0}
          pending={pendingNumber === issue.number}
          busy={busy}
          onCreate={() => onCreate(issue)}
          theme={theme}
          layout={layout}
          navigation={navigation}
        />
      ))}
    </View>
  );
}
