import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { issuesPageRpc, pageCountFor, type CreateAction, type Density, type Issue } from "../shared/issues";
import { isDarkTheme, openIssueColor } from "./github-style";
import { findRemoteWorkspaces, withRemoteCoverage, type ProjectOption, type RemoteWorkspace } from "./issue-list";
import { IssueRow } from "./issue-row";
import { Pager } from "./pager";

export const PAGE_QUERY_KEY = ["issues.page"];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * The selected project's issues as a GitHub-style table with a pager. Each page is fetched
 * from GitHub when it is shown.
 */
export function RepoTable({
  project,
  query,
  page,
  onPageChange,
  density,
  branchPrefix,
  otherHostWorkspaces,
  pendingNumber,
  busy,
  onCreate,
  agentLabel,
  headerControls,
  createMenuFor = null,
  onCreateMenu,
  theme,
  layout,
  navigation,
}: Pick<PluginScreenProps, "theme" | "layout" | "navigation"> & {
  project: ProjectOption;
  query: string;
  page: number;
  onPageChange: (page: number) => void;
  density: Density;
  branchPrefix: string;
  /** Every other host's workspaces: links for this host's issues, coverage for another host's project. */
  otherHostWorkspaces: RemoteWorkspace[] | undefined;
  /** The issue number being created, if any. */
  pendingNumber: number | null;
  busy: boolean;
  onCreate: (issue: Issue, action: CreateAction) => void;
  agentLabel: string;
  /** The density toggle, shown at the right of the header as on github.com. */
  headerControls?: ReactNode;
  /** The issue whose create menu is open. */
  createMenuFor?: number | null;
  onCreateMenu?: (issue: number | null) => void;
}) {
  const fetchPage = useRpc(issuesPageRpc);
  const result = useQuery({
    queryKey: [...PAGE_QUERY_KEY, project.key, query, page],
    queryFn: () =>
      fetchPage(project.remote ? { repo: project.repo, query, page } : { projectId: project.projectId, query, page }),
    // Keep the previous page on screen, dimmed, until the next one arrives.
    placeholderData: keepPreviousData,
    // GitHub allows 30 searches a minute; revisiting a page shouldn't spend one. Refresh still does.
    staleTime: 60_000,
  });

  const remote = project.remote;
  const raw = result.data?.issues ?? [];
  // Another host's project is covered by that host's workspaces; the server only knows this host's.
  const issues = remote
    ? withRemoteCoverage(raw, otherHostWorkspaces, remote.serverId, project.repo, branchPrefix)
    : raw;
  const totalCount = result.data?.totalCount ?? 0;
  const stale = result.isPlaceholderData;
  const dark = isDarkTheme(theme);

  const s = useMemo(
    () => ({
      box: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 6,
        backgroundColor: theme.colors.surface0,
      },
      header: {
        flexDirection: (layout.compact ? "column" : "row") as "column" | "row",
        alignItems: (layout.compact ? "stretch" : "center") as "stretch" | "center",
        justifyContent: "space-between" as const,
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: layout.compact ? 12 : 16,
        backgroundColor: theme.colors.surface1,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
      },
      summary: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      repo: { color: theme.colors.foregroundMuted, fontSize: 13, fontWeight: "400" as const },
      count: { color: theme.colors.foreground, fontSize: 14, fontWeight: "600" as const },
      error: { color: theme.colors.statusDanger, paddingVertical: 12, paddingHorizontal: 16 },
      empty: { color: theme.colors.foregroundMuted, paddingVertical: 24, textAlign: "center" as const },
      loading: { paddingVertical: 24 },
    }),
    [theme, layout.compact],
  );

  return (
    <View style={{ gap: 12 }}>
      {/* Above the pager while a row's menu is open, so a dropdown on the last row stays on top. */}
      <View style={[s.box, createMenuFor !== null ? { zIndex: 1 } : null]}>
        <View style={s.header}>
          <View style={s.summary}>
            <Icon name="CircleDot" size={16} color={openIssueColor(dark)} />
            <Text style={s.count}>{formatCount(totalCount)} Open</Text>
            {remote ? <Text style={s.repo}>on {remote.hostLabel}</Text> : null}
            {result.isFetching && result.data ? (
              <ActivityIndicator size="small" color={theme.colors.foregroundMuted} />
            ) : null}
          </View>
          {headerControls}
        </View>
        {result.isError ? <Text style={s.error}>Could not load issues: {message(result.error)}</Text> : null}
        {result.isPending ? (
          <View style={s.loading}>
            <ActivityIndicator color={theme.colors.foregroundMuted} />
          </View>
        ) : null}
        {result.isSuccess && !raw.length ? <Text style={s.empty}>No results matched your search.</Text> : null}
        <View style={[stale ? { opacity: 0.5 } : null, createMenuFor !== null ? { zIndex: 6 } : null]}>
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
                remote || issue.workspace
                  ? []
                  : findRemoteWorkspaces(otherHostWorkspaces, project.repo, issue.number, branchPrefix)
              }
              first={index === 0}
              pending={pendingNumber === issue.number}
              busy={busy}
              onCreate={(action) => onCreate(issue, action)}
              agentLabel={agentLabel}
              workspaceServerId={remote?.serverId}
              menuOpen={createMenuFor === issue.number}
              onMenuOpenChange={(open) => onCreateMenu?.(open ? issue.number : null)}
              theme={theme}
              layout={layout}
              navigation={navigation}
            />
          ))}
        </View>
      </View>
      <Pager
        page={page}
        pageCount={pageCountFor(totalCount)}
        onChange={onPageChange}
        compact={layout.compact}
        theme={theme}
      />
    </View>
  );
}
