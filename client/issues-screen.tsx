import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { Icon, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createWorkspaceRpc, projectsRpc, type Issue, type RepoProject } from "../shared/issues";
import { showProjectSelector } from "./issue-list";
import { ProjectSelector } from "./project-selector";
import { ISSUES_QUERY_KEY, RepoTable } from "./repo-table";

const PROJECTS_QUERY_KEY = ["issues.projects"];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function IssuesScreen({
  theme,
  layout,
  navigation,
}: PluginScreenProps) {
  const listProjects = useRpc(projectsRpc);
  const createWorkspace = useRpc(createWorkspaceRpc);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projects = useQuery({ queryKey: PROJECTS_QUERY_KEY, queryFn: () => listProjects({}) });
  const options = projects.data?.repos ?? [];
  const selected = options.find((o) => o.projectId === selectedId) ?? options[0] ?? null;
  const showTabs = showProjectSelector(options);

  const create = useMutation({
    mutationFn: ({ project, issue }: { project: RepoProject; issue: Issue }) =>
      createWorkspace({ projectId: project.projectId, number: issue.number }),
    onMutate: ({ issue }) => setPending(issue.number),
    onSuccess: (_result, { issue }) => {
      toast.show(`Created workspace for #${issue.number}`, { variant: "success" });
    },
    onError: (error, { issue }) => {
      toast.show(`#${issue.number}: ${message(error)}`, { variant: "error" });
    },
    onSettled: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
    },
  });

  const s = useMemo(() => {
    const pad = layout.compact ? 16 : 24;
    return {
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: pad, gap: 12 },
      toolbar: { flexDirection: "row" as const, justifyContent: "flex-end" as const },
      muted: { color: theme.colors.foregroundMuted, fontSize: 13 },
      error: { color: theme.colors.statusDanger },
      iconButton: { padding: 8, borderRadius: 6 },
    };
  }, [theme, layout.compact]);

  const refreshing = projects.isFetching;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {showTabs ? (
        <ProjectSelector
          options={options}
          selectedId={selected?.projectId ?? null}
          onSelect={(option) => setSelectedId(option.projectId)}
          theme={theme}
        />
      ) : null}

      <View style={s.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh issues"
          disabled={refreshing}
          onPress={() => {
            void projects.refetch();
            void queryClient.invalidateQueries({ queryKey: ISSUES_QUERY_KEY });
          }}
          style={s.iconButton}
        >
          {refreshing ? (
            <ActivityIndicator color={theme.colors.foregroundMuted} />
          ) : (
            <Icon name="RefreshCw" size={18} color={theme.colors.foregroundMuted} />
          )}
        </Pressable>
      </View>

      {projects.isPending ? <ActivityIndicator color={theme.colors.foregroundMuted} /> : null}
      {projects.isError ? <Text style={s.error}>Could not load projects: {message(projects.error)}</Text> : null}
      {projects.data && !options.length ? (
        <Text style={s.muted}>
          None of your Paseo projects has a github.com remote. Add a GitHub repository as a project to see its issues
          here.
        </Text>
      ) : null}

      {selected ? (
        <RepoTable
          project={selected}
          pendingNumber={pending}
          busy={pending !== null}
          onCreate={(issue) => create.mutate({ project: selected, issue })}
          theme={theme}
          layout={layout}
          navigation={navigation}
        />
      ) : null}

    </ScrollView>
  );
}
