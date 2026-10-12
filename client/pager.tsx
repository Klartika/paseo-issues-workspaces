import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { Pressable, Text, View } from "react-native";
import { pageItems } from "./issue-list";

/** GitHub's pagination bar: Previous, page numbers, Next. Renders nothing for a single page. */
export function Pager({
  page,
  pageCount,
  onChange,
  compact,
  theme,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Narrow layouts show "Page 2 of 9" instead of the number list. */
  compact: boolean;
  theme: PluginScreenProps["theme"];
}) {
  if (pageCount <= 1) return null;
  const cell = {
    minWidth: 32,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center" as const,
  };
  const text = { color: theme.colors.foreground, fontSize: 14 };
  const muted = { color: theme.colors.foregroundMuted, fontSize: 14 };

  const step = (label: string, target: number, icon: "ChevronLeft" | "ChevronRight") => {
    const disabled = target < 1 || target > pageCount;
    const color = disabled ? theme.colors.foregroundMuted : theme.colors.accent;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} page`}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => onChange(target)}
        style={[cell, { flexDirection: icon === "ChevronLeft" ? "row" : "row-reverse", gap: 4 }]}
      >
        <Icon name={icon} size={16} color={color} />
        <Text style={{ color, fontSize: 14 }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Pagination"
      style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 4 }}
    >
      {step("Previous", page - 1, "ChevronLeft")}
      {compact ? (
        <Text style={[muted, { paddingHorizontal: 8 }]}>
          Page {page} of {pageCount}
        </Text>
      ) : (
        pageItems(page, pageCount).map((item, i) =>
          item === "gap" ? (
            <Text key={`gap-${i}`} style={[muted, { paddingHorizontal: 4 }]}>
              …
            </Text>
          ) : (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`Page ${item}`}
              aria-selected={item === page}
              onPress={() => onChange(item)}
              style={[cell, item === page ? { backgroundColor: theme.colors.accent } : null]}
            >
              <Text style={item === page ? [text, { color: theme.colors.accentForeground, fontWeight: "600" }] : text}>
                {item}
              </Text>
            </Pressable>
          ),
        )
      )}
      {step("Next", page + 1, "ChevronRight")}
    </View>
  );
}
