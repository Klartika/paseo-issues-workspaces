import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { issuesRpc, type RepoProject } from "../shared/issues";
import { IssueRow } from "./issue-row";

export const ISSUES_QUERY_KEY = ["issues.list"];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The selected project's open issues, newest first. */
export function RepoTable({
  project,
  theme,
  layout,
}: Pick<PluginScreenProps, "theme" | "layout"> & {
  project: RepoProject;
}) {
  const fetchIssues = useRpc(issuesRpc);
  const result = useQuery({
    queryKey: [...ISSUES_QUERY_KEY, project.projectId],
    queryFn: () => fetchIssues({ projectId: project.projectId }),
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
      {result.isSuccess && !issues.length ? <Text style={s.empty}>No open issues.</Text> : null}
      {issues.map((issue, index) => (
        <IssueRow
          key={issue.number}
          issue={issue}
          first={index === 0}
          theme={theme}
          layout={layout}
        />
      ))}
    </View>
  );
}
