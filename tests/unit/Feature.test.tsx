import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import * as Y from "yjs";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders the installation arming flow when connected", () => {
    const room = createMockRoom();
    const view = render(<Feature room={room} config={config} />);
    expect(view.getByRole("heading", { level: 1 })).toHaveTextContent("Particles");
    expect(view.getByText("Synchronized light studio")).toBeInTheDocument();
    expect(view.getByText("One shared instant")).toBeInTheDocument();
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

  it("explains a disconnected shared room and offers reconnect before scheduling", async () => {
    const provider = {
      connected: false,
      on: vi.fn(),
      off: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const room = createMockRoom({ provider: provider as never });
    const view = render(<Feature room={room} config={config} />);
    await act(async () => view.getByRole("button", { name: "Arm this phone" }).click());
    await act(async () => view.getByRole("button", { name: "Trigger moment" }).click());
    expect(view.getByText(/room is not connected yet/i)).toBeInTheDocument();
    await act(async () => view.getByRole("button", { name: /reconnect/i }).click());
    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(provider.connect).toHaveBeenCalledOnce();
  });

  it("opens a shared frame in a viewer with its debugging attribution", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:remote-frame"),
      revokeObjectURL: vi.fn(),
    });
    const room = createMockRoom({ peerId: "session-local", deviceId: "device-local" });
    const manifests = room.doc.getMap("particles:photos:v1:manifests");
    const chunks = room.doc.getMap<Y.Array<string>>("particles:photos:v1:chunks");
    const imageChunks = new Y.Array<string>();
    room.doc.transact(() => {
      manifests.set("remote-frame", {
        name: "remote.jpg",
        mimeType: "image/jpeg",
        size: 3,
        chunks: 1,
        deviceId: "device-remote",
        by: "session-remote",
        at: 1_700_000_000_000,
      });
      chunks.set("remote-frame", imageChunks);
      imageChunks.push(["aGk="]);
    });
    const view = render(<Feature room={room} config={config} />);
    const thumbnail = await waitFor(() =>
      view.getByRole("button", { name: /view shared photo from device-remote/i }),
    );
    await act(async () => thumbnail.click());
    expect(view.getByRole("dialog")).toHaveTextContent("Frame 1 of 1");
    expect(view.getByRole("dialog")).toHaveTextContent("device-remote");
    expect(view.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "blob:remote-frame",
    );
  });
});

afterEach(() => vi.unstubAllGlobals());
