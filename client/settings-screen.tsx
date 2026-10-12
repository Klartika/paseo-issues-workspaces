import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useSettings } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsInput, SettingsSection } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { branchPrefixError, preferences, type Preferences } from "../shared/issues";

export function SettingsScreen({ theme }: PluginSurfaceProps) {
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
      saving={settings.saving}
      saveError={settings.saveError}
      onSave={(values) => settings.save(values, settings.revision)}
    />
  );
}

function PreferencesForm({
  values,
  saving,
  saveError,
  onSave,
}: {
  values: Preferences;
  saving: boolean;
  saveError: string | null;
  onSave: (values: Preferences) => Promise<boolean>;
}) {
  const [branchPrefix, setBranchPrefix] = useState(values.branchPrefix);
  const prefixError = branchPrefixError(branchPrefix);
  const changed = branchPrefix !== values.branchPrefix;

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
      <SettingsCard>
        <SettingsAction
          label={saveError ? "Could not save" : "Save changes"}
          hint={saveError ?? undefined}
          actionLabel={saving ? "Saving…" : "Save"}
          disabled={saving || !changed || Boolean(prefixError)}
          onPress={() => void onSave({ ...values, branchPrefix })}
        />
      </SettingsCard>
    </>
  );
}
