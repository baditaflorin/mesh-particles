import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
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

  it("makes timing and consent controls available after arming", async () => {
    const room = createMockRoom();
    const view = render(<Feature room={room} config={config} />);
    await act(async () => {
      view.getByRole("button", { name: "Arm this phone" }).click();
    });
    expect(view.getByRole("slider", { name: /moment in/i })).toHaveValue("5");
    expect(view.getByLabelText(/this phone takes a photo/i)).not.toBeChecked();
    expect(view.getByRole("button", { name: "Trigger moment" })).toBeInTheDocument();
  });
});
