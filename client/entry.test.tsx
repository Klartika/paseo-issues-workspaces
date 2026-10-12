// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@getpaseo/plugin/client", async () => (await import("./test-host")).clientModule);
vi.mock("@getpaseo/plugin/client/react-native", async () => (await import("./test-host")).reactNativeModule);
vi.mock("@getpaseo/plugin/client/ui", () => ({
  SidebarRow: (props: { icon: unknown; active: boolean; onPress: () => void }) => {
    sidebarRows.push(props);
    return null;
  },
}));

const sidebarRows: { icon: unknown; active: boolean; onPress: () => void }[] = [];
const { default: contribute } = await import("../index.client");

function fakeClient() {
  const added: Record<string, any[]> = {};
  const record = (kind: string) => (contribution: unknown) => {
    (added[kind] ??= []).push(contribution);
    return () => {};
  };
  const client = {
    addScreen: record("screen"),
    addSidebarHeaderItem: record("sidebar"),
    addSettingsScreen: record("settings"),
    addCommandCenterItem: record("command"),
  };
  return { client: client as any, added };
}

afterEach(cleanup);

describe("index.client", () => {
  const { client, added } = fakeClient();
  contribute(client);

  it("titles everything GitHub Issues", () => {
    expect(added.screen.map((s) => s.title)).toEqual(["GitHub Issues"]);
    expect(added.sidebar.map((s) => s.title)).toEqual(["GitHub Issues"]);
    expect(added.settings.map((s) => s.title)).toEqual(["GitHub Issues"]);
    expect(added.command.map((c) => c.title)).toEqual(["GitHub Issues"]);
  });

  it("shows GitHub's open issue icon in the sidebar and opens the issues screen", () => {
    const openScreen = vi.fn();
    const { Component } = added.sidebar[0];
    render(<Component currentScreen={{ screenId: "issues", params: {} }} openScreen={openScreen} />);

    const row = sidebarRows.at(-1)!;
    expect(row.icon).toBe("CircleDot");
    expect(row.active).toBe(true);
    row.onPress();
    expect(openScreen).toHaveBeenCalledWith({ screenId: "issues" });
  });

  it("opens the screen from the Command Center", () => {
    const openScreen = vi.fn();
    added.command[0].onSelect({ openScreen });
    expect(openScreen).toHaveBeenCalledWith({ screenId: "issues" });
    expect(added.settings[0].id).toBe("preferences");
  });

  it("uses GitHub's open issue icon for the settings page and the Command Center", () => {
    expect(added.settings[0].icon).toBe("CircleDot");
    expect(added.command.map((c) => c.icon)).toEqual(["CircleDot"]);
  });
});
