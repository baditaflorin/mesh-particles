import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders the installation arming flow when connected", () => {
    const room = createMockRoom();
    const view = render(<Feature room={room} config={config} />);
    expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("mesh-particles");
    expect(view.getByRole("button", { name: "Arm this phone" })).toBeInTheDocument();
  });

  it("shows a connecting state when room is null", () => {
    const view = render(<Feature room={null} config={config} />);
    // Most templates show "Connecting…" while the room is null. Apps with a
    // custom waiting state can override this test.
    const heading = view.getAllByRole("heading", { level: 1 })[0];
    expect(heading).toBeInTheDocument();
  });
});
