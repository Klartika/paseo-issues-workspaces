import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { useMemo } from "react";

export function IssuesScreen({
  theme,
  layout,
}: PluginScreenProps) {
  const s = useMemo(() => {
    const pad = layout.compact ? 16 : 24;
    return {
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: pad, gap: 12 },
    };
  }, [theme, layout.compact]);

  return <ScrollView style={s.screen} contentContainerStyle={s.content} />;
}
