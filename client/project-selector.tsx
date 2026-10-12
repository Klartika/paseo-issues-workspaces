import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { RepoProject } from "../shared/issues";

/** Picks the one project whose issues the screen shows. */
export function ProjectSelector({
  options,
  selectedId,
  onSelect,
  theme,
}: Pick<PluginScreenProps, "theme"> & {
  options: RepoProject[];
  selectedId: string | null;
  onSelect: (option: RepoProject) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View accessibilityRole="tablist" accessibilityLabel="Project" style={{ flexDirection: "row", gap: 6 }}>
        {options.map((o) => {
          const selected = o.projectId === selectedId;
          const also = o.otherProjects.length ? `, also ${o.otherProjects.join(", ")}` : "";
          return (
            <Pressable
              key={o.projectId}
              accessibilityRole="tab"
              aria-selected={selected}
              accessibilityLabel={`${o.projectName} (${o.repo}${also})`}
              onPress={() => onSelect(o)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: selected ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 13 }}>
                {o.projectName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
