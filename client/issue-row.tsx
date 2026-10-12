import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { openExternalUrl } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { Issue } from "../shared/issues";
import { isDarkTheme, labelColors, openIssueColor, timeAgo } from "./github-style";
import type { RemoteWorkspace } from "./issue-list";

type Props = Pick<PluginScreenProps, "theme" | "layout" | "navigation">;

/** One issue, laid out like a row of GitHub's issue list. */
export function IssueRow({
  issue,
  elsewhere,
  first,
  pending,
  busy,
  onCreate,
  theme,
  layout,
  navigation,
}: Props & {
  issue: Issue;
  /** Workspaces for this issue on other hosts. */
  elsewhere: RemoteWorkspace[];
  /** The first row in its box draws no divider above it. */
  first: boolean;
  pending: boolean;
  busy: boolean;
  onCreate: () => void;
}) {
  const dark = isDarkTheme(theme);
  const s = useMemo(
    () => ({
      row: {
        flexDirection: "row" as const,
        alignItems: "flex-start" as const,
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: layout.compact ? 12 : 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.border,
      },
      icon: { paddingTop: 3 },
      body: {
        flex: 1,
        flexDirection: (layout.compact ? "column" : "row") as "column" | "row",
        alignItems: (layout.compact ? "stretch" : "center") as "stretch" | "center",
        gap: layout.compact ? 8 : 16,
      },
      text: { flex: layout.compact ? undefined : 1, gap: 4 },
      titleLine: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 6 },
      title: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" as const },
      meta: { color: theme.colors.foregroundMuted, fontSize: 12 },
      link: { color: theme.colors.accent, fontSize: 12 },
    }),
    [theme, layout.compact, first],
  );

  const opened = `#${issue.number} opened ${timeAgo(issue.createdAt)}${issue.author ? ` by ${issue.author}` : ""}`;

  return (
    <View style={s.row}>
      <View style={s.icon}>
        <Icon name="CircleDot" size={16} color={openIssueColor(dark)} />
      </View>
      <View style={s.body}>
        <View style={s.text}>
          <View style={s.titleLine}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open issue ${issue.number} on GitHub: ${issue.title}`}
              onPress={() => void openExternalUrl(issue.url)}
            >
              <Text style={s.title}>{issue.title}</Text>
            </Pressable>
            {issue.labels.map((label) => (
              <IssueLabel key={label.name} name={label.name} color={label.color} dark={dark} />
            ))}
          </View>
          <Text style={s.meta}>{opened}</Text>
          {issue.orphanBranch ? (
            <Text style={s.meta}>Local branch {issue.orphanBranch} exists without a workspace</Text>
          ) : null}
          {elsewhere.map((w) => (
            <ElsewhereLink key={`${w.serverId}/${w.workspaceId}`} workspace={w} style={s.link} navigation={navigation} />
          ))}
        </View>
        <IssueAction
          issue={issue}
          pending={pending}
          busy={busy}
          theme={theme}
          onCreate={onCreate}
          onOpen={
            issue.workspace && navigation ? () => navigation.openWorkspace({ workspaceId: issue.workspace!.id }) : undefined
          }
        />
      </View>
    </View>
  );
}

function IssueLabel({ name, color, dark }: { name: string; color: string; dark: boolean }) {
  const c = labelColors(color, dark);
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.borderColor,
        backgroundColor: c.backgroundColor,
      }}
    >
      <Text style={{ color: c.color, fontSize: 12, fontWeight: "500", lineHeight: 18 }}>{name}</Text>
    </View>
  );
}

function ElsewhereLink({
  workspace: w,
  style,
  navigation,
}: {
  workspace: RemoteWorkspace;
  style: object;
  navigation: PluginScreenProps["navigation"];
}) {
  const label = `Workspace on ${w.hostLabel}: ${w.name}`;
  if (!navigation) return <Text style={style}>{label}</Text>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open workspace ${w.name} on ${w.hostLabel}`}
      onPress={() => navigation.openWorkspace({ workspaceId: w.workspaceId, serverId: w.serverId })}
    >
      <Text style={style}>{label}</Text>
    </Pressable>
  );
}

function IssueAction({
  issue,
  pending,
  busy,
  theme,
  onCreate,
  onOpen,
}: {
  issue: Issue;
  pending: boolean;
  busy: boolean;
  theme: PluginScreenProps["theme"];
  onCreate: () => void;
  onOpen?: () => void;
}) {
  const pad = { paddingVertical: 6, paddingHorizontal: 12 };
  const shell = {
    flexDirection: "row" as const,
    alignItems: "stretch" as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    backgroundColor: theme.colors.surface2,
    overflow: "hidden" as const,
  };
  const label = { color: theme.colors.foreground, fontSize: 13, fontWeight: "600" as const };

  if (issue.workspace) {
    if (!onOpen) return <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>Has a workspace</Text>;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open workspace for issue ${issue.number}`}
        onPress={onOpen}
        style={[shell, pad, { alignItems: "center", gap: 6 }]}
      >
        <Icon name="SquareArrowOutUpRight" size={14} color={theme.colors.foregroundMuted} />
        <Text style={label}>Open workspace</Text>
      </Pressable>
    );
  }
  if (issue.orphanBranch) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Create workspace for issue ${issue.number}`}
      disabled={busy}
      onPress={onCreate}
      style={[shell, pad, { alignItems: "center", gap: 6 }, busy && !pending ? { opacity: 0.5 } : null]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : (
        <Icon name="GitBranchPlus" size={16} color={theme.colors.accent} />
      )}
      <Text style={label}>{pending ? "Creating…" : "Create workspace"}</Text>
    </Pressable>
  );
}
