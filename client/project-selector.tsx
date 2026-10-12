import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { ProjectOption } from "./issue-list";

// Paseo's workspace tab row (workspace-desktop-tabs-row.tsx): a 36pt strip of 28pt chips.
const ROW_HEIGHT = 36;
const CHIP_HEIGHT = 28;
const ICON_SIZE = 14;

/** The project's Paseo icon; GitHub's repository icon when it has none or this client can't draw it. */
function ProjectIcon({
  icon,
  platform,
  color,
}: {
  icon: ProjectOption["icon"];
  platform: PluginScreenProps["layout"]["platform"];
  color: string;
}) {
  // Native Image cannot decode SVG.
  if (icon && (platform === "web" || icon.mimeType !== "image/svg+xml")) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: `data:${icon.mimeType};base64,${icon.data}` }}
        style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: 3 }}
      />
    );
  }
  return <Icon name="BookMarked" size={ICON_SIZE} color={color} />;
}

/** Picks the one project whose issues the screen shows, styled as Paseo's workspace tabs. */
export function ProjectSelector({
  options,
  selectedKey,
  onSelect,
  counts,
  theme,
  layout,
}: Pick<PluginScreenProps, "theme" | "layout"> & {
  options: ProjectOption[];
  selectedKey: string | null;
  onSelect: (option: ProjectOption) => void;
  /** Open issues assigned to me, by repository; absent until they arrive. */
  counts?: Record<string, number>;
}) {
  return (
    <View
      style={{
        height: ROW_HEIGHT,
        justifyContent: "center",
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Project"
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 4 }}
        >
          {options.map((o) => {
            const selected = o.key === selectedKey;
            const count = counts?.[o.repo];
            const also = o.otherProjects.length ? `, also ${o.otherProjects.join(", ")}` : "";
            const where = o.remote ? ` on ${o.remote.hostLabel}` : "";
            const assigned = count === undefined ? "" : `, ${count} assigned to you`;
            return (
              <Pressable
                key={o.key}
                accessibilityRole="tab"
                aria-selected={selected}
                accessibilityLabel={`${o.projectName} (${o.repo}${also})${where}${assigned}`}
                onPress={() => onSelect(o)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  height: CHIP_HEIGHT,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  borderRadius: 6,
                  backgroundColor: selected ? theme.colors.surface2 : hovered ? theme.colors.surface1 : "transparent",
                })}
              >
                <ProjectIcon icon={o.icon} platform={layout.platform} color={theme.colors.foregroundMuted} />
                <Text
                  numberOfLines={1}
                  style={{ color: selected ? theme.colors.foreground : theme.colors.foregroundMuted, fontSize: 13 }}
                >
                  {o.projectName}
                </Text>
                {o.remote ? (
                  <Text style={{ color: theme.colors.foregroundMuted, fontSize: 12 }}>{o.remote.hostLabel}</Text>
                ) : null}
                {count !== undefined ? (
                  <View
                    style={{
                      minWidth: 18,
                      paddingHorizontal: 5,
                      borderRadius: 9,
                      backgroundColor: selected ? theme.colors.surface0 : theme.colors.surface2,
                    }}
                  >
                    <Text style={{ color: theme.colors.foregroundMuted, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
                      {count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
