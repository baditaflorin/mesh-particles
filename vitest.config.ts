import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // file:../mesh-common can resolve React from its own node_modules,
    // creating duplicate instances and "useState of null" errors when
    // mesh-common hooks (PersonalQR, useQRScanner) are rendered in unit tests.
    dedupe: ["react", "react-dom", "yjs", "y-webrtc", "@radix-ui/react-dialog"],
    alias: [
      {
        find: /^react$/,
        replacement: fileURLToPath(new URL("./node_modules/react/index.js", import.meta.url)),
      },
      {
        find: /^react-dom$/,
        replacement: fileURLToPath(new URL("./node_modules/react-dom/index.js", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
