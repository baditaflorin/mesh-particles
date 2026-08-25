import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-particles",
  displayName: "Particles",
  visualProfile: "studio",
  // The stage owns the first viewport. MeshShell keeps its invite/settings
  // actions as a safe overlay while the stage reserves a dedicated top row.
  shellLayout: "overlay",
  description:
    "Installation rehearsal: synchronized screen light, opt-in camera capture, and a small shared photo roll.",
  accentHex: "#d5e4a5",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
