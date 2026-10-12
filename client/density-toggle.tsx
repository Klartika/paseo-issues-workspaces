import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, View } from "react-native";
import type { Density } from "../shared/issues";

type Theme = PluginScreenProps["theme"];

/** GitHub's two list densities. */
export function DensityToggle({
  density,
  onChange,
  theme,
}: {
  density: Density;
  onChange: (density: Density) => void;
  theme: Theme;
}) {
  const options: { value: Density; icon: string; label: string }[] = [
    { value: "comfortable", icon: "Rows2", label: "Comfortable" },
    { value: "compact", icon: "Rows4", label: "Compact" },
  ];
  return (
    <View
      style={{ flexDirection: "row", borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6 }}
    >
      {options.map((o, i) => {
        const selected = o.value === density;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={`${o.label} density`}
            aria-selected={selected}
            onPress={() => onChange(o.value)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 8,
              backgroundColor: selected ? theme.colors.surface2 : "transparent",
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: theme.colors.border,
            }}
          >
            <Icon name={o.icon} size={16} color={selected ? theme.colors.foreground : theme.colors.foregroundMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
