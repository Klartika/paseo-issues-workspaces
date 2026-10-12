import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ProjectOption } from "./issue-list";

/** Picks the one project whose issues the screen shows. */
export function ProjectSelector({
  options,
  selectedKey,
  onSelect,
  theme,
}: Pick<PluginScreenProps, "theme"> & {
  options: ProjectOption[];
  selectedKey: string | null;
  onSelect: (option: ProjectOption) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View accessibilityRole="tablist" accessibilityLabel="Project" style={{ flexDirection: "row", gap: 6 }}>
        {options.map((o) => {
          const selected = o.key === selectedKey;
          const also = o.otherProjects.length ? `, also ${o.otherProjects.join(", ")}` : "";
          const where = o.remote ? ` on ${o.remote.hostLabel}` : "";
          return (
            <Pressable
              key={o.key}
              accessibilityRole="tab"
              aria-selected={selected}
              accessibilityLabel={`${o.projectName} (${o.repo}${also})${where}`}
              onPress={() => onSelect(o)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
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
              {o.remote ? (
                <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{o.remote.hostLabel}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
