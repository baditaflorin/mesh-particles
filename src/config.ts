import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-particles",
  description:
    "Installation rehearsal: synchronized screen light, optional torch, and local multi-angle capture.",
  accentHex: "#d7b3ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
