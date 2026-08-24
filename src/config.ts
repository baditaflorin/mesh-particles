import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-particles",
  description:
    "Installation rehearsal: synchronized screen light, opt-in camera capture, and a small shared photo roll.",
  accentHex: "#d5e4a5",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
