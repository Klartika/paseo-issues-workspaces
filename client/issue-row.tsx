import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { openExternalUrl } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { Issue } from "../shared/issues";

type Props = Pick<PluginScreenProps, "theme" | "layout">;

/** One issue: its title, which opens it on GitHub, and its number. */
export function IssueRow({
  issue,
  first,
  theme,
  layout,
}: Props & {
  issue: Issue;
  /** The first row in its box draws no divider above it. */
  first: boolean;
}) {
  const s = useMemo(
    () => ({
      row: {
        flexDirection: (layout.compact ? "column" : "row") as "column" | "row",
        alignItems: (layout.compact ? "stretch" : "center") as "stretch" | "center",
        gap: layout.compact ? 8 : 16,
        paddingVertical: 10,
        paddingHorizontal: layout.compact ? 12 : 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.border,
      },
      text: { flex: layout.compact ? undefined : 1, gap: 4 },
      title: { color: theme.colors.foreground, fontSize: 16, fontWeight: "600" as const },
      meta: { color: theme.colors.foregroundMuted, fontSize: 12 },
    }),
    [theme, layout.compact, first],
  );

  return (
    <View style={s.row}>
      <View style={s.text}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open issue ${issue.number} on GitHub: ${issue.title}`}
          onPress={() => void openExternalUrl(issue.url)}
        >
          <Text style={s.title}>{issue.title}</Text>
        </Pressable>
        <Text style={s.meta}>#{issue.number}</Text>
      </View>
    </View>
  );
}
