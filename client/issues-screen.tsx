import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc, useSettings } from "@getpaseo/plugin/client";
import { Icon, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type ScrollView as NativeScrollView } from "react-native";
import {
  createWorkspaceRpc,
  DEFAULT_PREFERENCES,
  DEFAULT_QUERY,
  effectivePreferences,
  preferences,
  projectsRpc,
  type CreateAction,
  type Density,
  type Issue,
  type Preferences,
  type RepoProject,
} from "../shared/issues";
import { DensityToggle } from "./density-toggle";
import { pickProject, showProjectSelector } from "./issue-list";
import { OTHER_HOSTS_QUERY_KEY, useOtherHosts } from "./other-hosts";
import { ProjectSelector } from "./project-selector";
import { PAGE_QUERY_KEY, RepoTable } from "./repo-table";
import { SearchBar } from "./search-bar";

const PROJECTS_QUERY_KEY = ["issues.projects"];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function IssuesScreen({
  theme,
  layout,
  navigation,
  host,
}: PluginScreenProps) {
  const listProjects = useRpc(projectsRpc);
  const createWorkspace = useRpc(createWorkspaceRpc);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<number | null>(null);
  // The issue whose create menu is open, if any.
  const [createMenu, setCreateMenu] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const scroller = useRef<NativeScrollView>(null);

  const settings = useSettings(preferences);
  const saved = settings.status === "ready" ? settings.values : null;
  // Local choices apply at once; saved values carry them across sessions and clients.
  const [queryChoice, setQueryChoice] = useState<string | null>(null);
  const [densityChoice, setDensityChoice] = useState<Density | null>(null);
  const [repoChoice, setRepoChoice] = useState<string | null>(null);
  const query = queryChoice ?? saved?.searchQuery ?? DEFAULT_QUERY;
  const density = densityChoice ?? saved?.density ?? "comfortable";
  const prefs = effectivePreferences(saved ?? DEFAULT_PREFERENCES);

  const projects = useQuery({ queryKey: PROJECTS_QUERY_KEY, queryFn: () => listProjects({}) });
  const others = useOtherHosts(host.id);
  const options = projects.data?.repos ?? [];
  const selected = pickProject(options, repoChoice ?? saved?.selectedRepo ?? "");
  const showTabs = showProjectSelector(options);

  async function savePreferences(patch: Partial<Preferences>) {
    if (settings.status !== "ready") return false;
    return settings.save({ ...settings.values, ...patch }, settings.revision);
  }
  function search(next: string) {
    setQueryChoice(next);
    setPage(1);
    void savePreferences({ searchQuery: next });
  }
  function selectProject(option: RepoProject) {
    setRepoChoice(option.repo.toLowerCase());
    setPage(1);
    setCreateMenu(null);
    void savePreferences({ selectedRepo: option.repo.toLowerCase() });
  }

  const create = useMutation({
    mutationFn: ({ project, issue, action }: { project: RepoProject; issue: Issue; action: CreateAction }) =>
      createWorkspace({ projectId: project.projectId, number: issue.number, action }),
    onMutate: ({ issue }) => setPending(issue.number),
    onSuccess: (result, { issue }) => {
      toast.show(
        result.agent
          ? `Created workspace for #${issue.number} and started ${result.agent}`
          : `Created workspace for #${issue.number}`,
        { variant: "success" },
      );
    },
    onError: (error, { issue }) => {
      toast.show(`#${issue.number}: ${message(error)}`, { variant: "error" });
    },
    onSettled: () => {
      setPending(null);
      void queryClient.invalidateQueries({ queryKey: PAGE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: OTHER_HOSTS_QUERY_KEY });
    },
  });

  const s = useMemo(() => {
    const pad = layout.compact ? 16 : 24;
    return {
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: pad, gap: 12 },
      searchRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      muted: { color: theme.colors.foregroundMuted, fontSize: 13 },
      error: { color: theme.colors.statusDanger },
      iconButton: { padding: 8, borderRadius: 6 },
      // Closes an open create menu when anything outside it is pressed.
      backdrop: { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
    };
  }, [theme, layout.compact]);

  const refreshing = projects.isFetching || others.isFetching;

  return (
    <ScrollView ref={scroller} style={s.screen} contentContainerStyle={s.content}>
      {createMenu !== null ? (
        <Pressable accessibilityLabel="Close menu" onPress={() => setCreateMenu(null)} style={s.backdrop} />
      ) : null}
      {showTabs ? (
        <ProjectSelector
          options={options}
          selectedId={selected?.projectId ?? null}
          onSelect={selectProject}
          theme={theme}
        />
      ) : null}

      <View style={s.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar query={query} onSearch={search} theme={theme} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh issues"
          disabled={refreshing}
          onPress={() => {
            void projects.refetch();
            void others.refetch();
            void queryClient.invalidateQueries({ queryKey: PAGE_QUERY_KEY });
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
        <>
          {/* Above the screen's dismiss layer, so an issue's create menu can be pressed. */}
          <View style={{ zIndex: 6 }}>
            <RepoTable
              project={selected}
              query={query}
              page={page}
              onPageChange={(next) => {
                setPage(next);
                setCreateMenu(null);
                // Like following a page link on github.com: start reading from the top.
                scroller.current?.scrollTo({ y: 0, animated: false });
              }}
              density={density}
              branchPrefix={prefs.branchPrefix}
              otherHostWorkspaces={others.data?.workspaces}
              pendingNumber={pending}
              busy={pending !== null}
              onCreate={(issue, action) => create.mutate({ project: selected, issue, action })}
              agentLabel={prefs.agent || "the host's default agent"}
              createMenuFor={createMenu}
              onCreateMenu={setCreateMenu}
              headerControls={
                <DensityToggle
                  density={density}
                  onChange={(next) => {
                    setDensityChoice(next);
                    void savePreferences({ density: next });
                  }}
                  theme={theme}
                />
              }
              theme={theme}
              layout={layout}
              navigation={navigation}
            />
          </View>
        </>
      ) : null}

    </ScrollView>
  );
}
