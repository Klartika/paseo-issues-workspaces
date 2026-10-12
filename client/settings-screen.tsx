import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { usePaseo, useSettings } from "@getpaseo/plugin/client";
import { TextInput } from "@getpaseo/plugin/client/react-native";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "@getpaseo/plugin/client/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import {
  branchPrefixError,
  effectiveAgentPrompt,
  DEFAULT_AGENT_PROMPT,
  preferences,
  PROMPT_PLACEHOLDERS,
  type Preferences,
} from "../shared/issues";

const AUTOMATIC = "";

/** `provider/model` choices from the host's ready providers. */
function useAgentOptions() {
  const paseo = usePaseo();
  return useQuery({
    queryKey: ["providers.snapshot"],
    queryFn: async () => {
      const { entries } = await paseo.providers.snapshot();
      return entries
        .filter((p) => p.enabled !== false && p.status === "ready")
        .flatMap((p) =>
          (p.models ?? [])
            .filter((m) => m.isSelectable !== false)
            .map((m) => ({ value: `${p.provider}/${m.id}`, label: `${p.label ?? p.provider} · ${m.label}` })),
        );
    },
  });
}

export function SettingsScreen({ theme }: PluginSurfaceProps) {
  const agentOptions = useAgentOptions();
  const settings = useSettings(preferences);
  const errorStyle = { color: theme.colors.statusDanger };

  if (settings.status === "loading") return <ActivityIndicator color={theme.colors.foregroundMuted} />;
  if (settings.status === "error") return <Text style={errorStyle}>Could not load settings: {settings.error}</Text>;
  if (settings.status === "invalid") {
    return (
      <SettingsSection title="Settings">
        <SettingsCard>
          <SettingsAction
            label="Saved settings are invalid"
            hint={settings.error}
            actionLabel="Reset to defaults"
            disabled={settings.saving}
            onPress={() => void settings.reset()}
          />
        </SettingsCard>
      </SettingsSection>
    );
  }
  return (
    <PreferencesForm
      // A save from any client starts a fresh draft from the new values.
      key={settings.revision}
      values={settings.values}
      theme={theme}
      agentOptions={agentOptions.data ?? []}
      saving={settings.saving}
      saveError={settings.saveError}
      onSave={(values) => settings.save(values, settings.revision)}
    />
  );
}

function PreferencesForm({
  values,
  theme,
  agentOptions,
  saving,
  saveError,
  onSave,
}: {
  values: Preferences;
  theme: PluginSurfaceProps["theme"];
  agentOptions: { value: string; label: string }[];
  saving: boolean;
  saveError: string | null;
  onSave: (values: Preferences) => Promise<boolean>;
}) {
  const [branchPrefix, setBranchPrefix] = useState(values.branchPrefix);
  const [agent, setAgent] = useState(values.agent);
  const savedPrompt = effectiveAgentPrompt(values.agentPrompt);
  const [agentPrompt, setAgentPrompt] = useState(savedPrompt);
  const prefixError = branchPrefixError(branchPrefix);
  const changed =
    branchPrefix !== values.branchPrefix ||
    agent !== values.agent ||
    agentPrompt !== savedPrompt;
  // A saved agent the host no longer offers stays selectable, so opening settings never changes it.
  const options = [
    { value: AUTOMATIC, label: "Automatic: first ready provider, default model" },
    ...agentOptions,
    ...(agent && !agentOptions.some((o) => o.value === agent) ? [{ value: agent, label: agent }] : []),
  ];

  return (
    <>
      <SettingsSection title="New workspaces">
        <SettingsCard>
          <SettingsInput
            label="Branch prefix"
            hint={`Branches are named ${branchPrefix || ""}<number>-<title>, from the repository's default branch.`}
            placeholder="issue/"
            initialValue={values.branchPrefix}
            onChangeText={setBranchPrefix}
            error={prefixError ?? undefined}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection title="Create and start an agent">
        <SettingsCard>
          <SettingsSelect
            label="Agent"
            hint="The provider and model started in the new workspace."
            value={agent}
            options={options}
            onValueChange={setAgent}
          />
          <SettingsRow
            label="Agent prompt"
            hint={`Sent as the agent's first message. Placeholders: ${PROMPT_PLACEHOLDERS.map((p) => `{${p}}`).join(" ")}`}
          >
            <TextInput
              value={agentPrompt}
              onChangeText={setAgentPrompt}
              multiline
              placeholder={DEFAULT_AGENT_PROMPT}
              placeholderTextColor={theme.colors.foregroundMuted}
              accessibilityLabel="Agent prompt"
              style={{
                minHeight: 120,
                padding: 10,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 6,
                color: theme.colors.foreground,
                backgroundColor: theme.colors.surface1,
                fontSize: 13,
                textAlignVertical: "top",
              }}
            />
          </SettingsRow>
          <SettingsAction
            label="Default prompt"
            actionLabel="Restore"
            disabled={agentPrompt === DEFAULT_AGENT_PROMPT}
            onPress={() => setAgentPrompt(DEFAULT_AGENT_PROMPT)}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsCard>
        <SettingsAction
          label={saveError ? "Could not save" : "Save changes"}
          hint={saveError ?? undefined}
          actionLabel={saving ? "Saving…" : "Save"}
          disabled={saving || !changed || Boolean(prefixError)}
          onPress={() => void onSave({ ...values, branchPrefix, agent, agentPrompt })}
        />
      </SettingsCard>
    </>
  );
}
