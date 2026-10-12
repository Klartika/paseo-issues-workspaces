import { Image } from "react-native";
import { TOOLS_ICON_PNG } from "./tools-icon-data";

// Lucide has no crossed tools, and its hammer and wrench are too short to cross corner to corner,
// so the sidebar draws the plugin's own mark, tinted like the Lucide icons around it.
export function ToolsIcon({ size, color }: { size: number; color: string }) {
  return (
    <Image
      source={{ uri: TOOLS_ICON_PNG }}
      style={{ width: size, height: size, tintColor: color }}
      accessibilityIgnoresInvertColors
    />
  );
}
