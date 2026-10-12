import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { Icon, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DEFAULT_QUERY } from "../shared/issues";

type Theme = PluginScreenProps["theme"];

/**
 * GitHub's issue search box. `is:issue state:open` is always part of the search but is
 * not shown, so the box holds only the user's own qualifiers.
 */
export function SearchBar({
  query,
  onSearch,
  theme,
}: {
  query: string;
  onSearch: (query: string) => void;
  theme: Theme;
}) {
  // null shows the active query; typing starts a draft until it is submitted.
  const [draft, setDraft] = useState<string | null>(null);
  // A new query from elsewhere, such as saved settings arriving, replaces whatever was being typed.
  useEffect(() => setDraft(null), [query]);
  const text = draft ?? query;
  const s = useMemo(
    () => ({
      row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
      box: {
        flex: 1,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 6,
        backgroundColor: theme.colors.surface1,
      },
      input: { flex: 1, paddingVertical: 7, fontSize: 14, color: theme.colors.foreground },
      reset: { color: theme.colors.accent, fontSize: 13 },
    }),
    [theme],
  );

  const submit = (next: string) => {
    setDraft(null);
    onSearch(next.replace(/\s+/g, " ").trim());
  };

  return (
    <View style={s.row}>
      <View style={s.box}>
        <Icon name="Search" size={16} color={theme.colors.foregroundMuted} />
        <TextInput
          value={text}
          onChangeText={setDraft}
          onSubmitEditing={() => submit(text)}
          placeholder="Search all issues"
          placeholderTextColor={theme.colors.foregroundMuted}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search issues. Open issues only."
          style={s.input}
        />
        {text ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => submit("")} hitSlop={8}>
            <Icon name="X" size={14} color={theme.colors.foregroundMuted} />
          </Pressable>
        ) : null}
      </View>
      {query !== DEFAULT_QUERY ? (
        <Pressable accessibilityRole="button" onPress={() => submit(DEFAULT_QUERY)}>
          <Text style={s.reset}>Assigned to me</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
