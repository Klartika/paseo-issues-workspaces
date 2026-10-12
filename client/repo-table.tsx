import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { issuesRpc, type CreateAction, type Density, type Issue, type RepoProject } from "../shared/issues";
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
  agentLabel,
  createMenuFor = null,
  onCreateMenu,
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
  onCreate: (issue: Issue, action: CreateAction) => void;
  agentLabel: string;
  /** The issue whose create menu is open. */
  createMenuFor?: number | null;
  onCreateMenu?: (issue: number | null) => void;
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
      <View style={createMenuFor !== null ? { zIndex: 6 } : null}>
        {createMenuFor !== null ? (
          // Covers the rows, under the row whose menu is open.
          <Pressable
            accessibilityLabel="Close menu"
            onPress={() => onCreateMenu?.(null)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}
          />
        ) : null}
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
            onCreate={(action) => onCreate(issue, action)}
            agentLabel={agentLabel}
            menuOpen={createMenuFor === issue.number}
            onMenuOpenChange={(open) => onCreateMenu?.(open ? issue.number : null)}
            theme={theme}
            layout={layout}
            navigation={navigation}
          />
        ))}
      </View>
    </View>
  );
}
