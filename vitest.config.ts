import { defineConfig } from "vitest/config";

export default defineConfig({
  // Screen tests render React Native components through react-native-web in jsdom.
  resolve: { alias: [{ find: /^react-native$/, replacement: "react-native-web" }] },
  test: {
    include: ["{client,server,shared}/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
