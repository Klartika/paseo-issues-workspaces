import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { IssuesScreen } from "./client/issues-screen";
import { SettingsScreen } from "./client/settings-screen";

const TITLE = "GitHub Issues";
const ICON = "CircleDot";

function IssuesItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon={ICON}
      active={currentScreen?.screenId === "issues"}
      onPress={() => openScreen({ screenId: "issues" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "issues", title: TITLE, Component: IssuesScreen });
  client.addSidebarHeaderItem({ id: "issues", title: TITLE, Component: IssuesItem });
  client.addSettingsScreen({ id: "preferences", title: TITLE, icon: ICON, Component: SettingsScreen });
  client.addCommandCenterItem({
    id: "open-issues",
    title: TITLE,
    icon: ICON,
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: "issues" });
    },
  });
  return () => {};
}
