import { useEffect, useMemo, useRef, useState } from "react";
import {
  createClockSync,
  useFlashlight,
  useFullscreen,
  useImageCapture,
  usePeerCapabilities,
  useScheduledCue,
  useWakeLock,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type ParticlesCue = { torch: boolean; capture: boolean; durationMs: number };
type Props = { room: YRoom | null; config: MeshConfig };

const isParticlesCue = (value: unknown): value is ParticlesCue => {
  if (typeof value !== "object" || value === null) return false;
  const cue = value as Partial<ParticlesCue>;
  return (
    typeof cue.torch === "boolean" &&
    typeof cue.capture === "boolean" &&
    typeof cue.durationMs === "number" &&
    Number.isFinite(cue.durationMs) &&
    cue.durationMs >= 80 &&
    cue.durationMs <= 800
  );
};

/** Rehearsal-scale installation client. It intentionally stays screen-first. */
export function Feature({ room, config }: Props) {
  const [armed, setArmed] = useState(false);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(true);
  const [flashing, setFlashing] = useState(false);
  const [lastShot, setLastShot] = useState<string | null>(null);
  const [notice, setNotice] = useState("Arm this device before the rehearsal.");
  const stageRef = useRef<HTMLElement | null>(null);
  const firedCue = useRef<string | null>(null);
  const timers = useRef<number[]>([]);

  const clock = useMemo(() => createClockSync(room?.provider ?? null), [room?.provider]);
  useEffect(() => () => clock.destroy(), [clock]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const camera = useImageCapture({
    armed: armed && captureEnabled,
    facing: "environment",
    width: 1280,
    height: 720,
  });
  const torch = useFlashlight(camera.stream);
  const wakeLock = useWakeLock();
  const fullscreen = useFullscreen(stageRef);
  const capabilities = usePeerCapabilities(room);
  const cue = useScheduledCue(room, "particles:cue", {
    clock,
    minLeadMs: 2_500,
    maxLeadMs: 15_000,
    graceMs: 2_000,
    tickMs: 25,
    isPayload: isParticlesCue,
  });

  useEffect(() => {
    capabilities.setMine({
      screen: armed,
      camera: armed && captureEnabled && camera.ready,
      torch: armed && torchEnabled && torch.supported,
    });
  }, [armed, camera.ready, capabilities, captureEnabled, torch.supported, torchEnabled]);

  useEffect(() => {
    if (cue.state !== "due" || !cue.cue || firedCue.current === cue.cue.id) return;
    firedCue.current = cue.cue.id;
    const event = cue.cue;
    const canTorch = event.payload.torch && torchEnabled && torch.supported;
    setFlashing(true);
    setNotice(`Cue fired · ${cue.latenessMs ?? 0}ms local arrival.`);
    if (canTorch) void torch.setOn(true);
    if (event.payload.capture && captureEnabled) {
      const image = camera.capture(0.7);
      if (image) setLastShot(image.dataUrl);
    }
    timers.current.push(
      window.setTimeout(() => {
        setFlashing(false);
        if (canTorch) void torch.setOn(false);
      }, event.payload.durationMs),
    );
  }, [
    camera,
    captureEnabled,
    cue.cue,
    cue.latenessMs,
    cue.state,
    torch,
    torch.supported,
    torchEnabled,
  ]);

  const arm = async () => {
    setArmed(true);
    setNotice("Armed. Screen flash is ready; camera and torch remain opt-in.");
    if (wakeLock.supported) await wakeLock.acquire();
  };

  const schedule = (delayMs: number) => {
    if (!armed) {
      setNotice("Arm this device first.");
      return;
    }
    const ok = cue.scheduleIn(
      {
        torch: torchEnabled && torch.supported,
        capture: captureEnabled && camera.ready,
        durationMs: 180,
      },
      delayMs,
    );
    setNotice(
      ok
        ? `Cue scheduled in ${(delayMs / 1000).toFixed(1)} seconds.`
        : "Cue could not be scheduled. Check the room connection.",
    );
  };

  const peerCapabilities = [...capabilities.peers.values()];
  const cameraReady =
    peerCapabilities.filter((peer) => peer.camera).length +
    Number(armed && captureEnabled && camera.ready);
  const torchReady =
    peerCapabilities.filter((peer) => peer.torch).length +
    Number(armed && torchEnabled && torch.supported);

  return (
    <main ref={stageRef} className={`particles-stage ${flashing ? "is-flashing" : ""}`}>
      <div className="particles-flash" aria-hidden="true" />
      <section className="particles-hero" aria-labelledby="particles-title">
        <p className="particles-kicker">Installation rehearsal · screen-first</p>
        <h1 id="particles-title">{config.appName}</h1>
        <p className="particles-intro">
          One shared light cue, many held phones. The white screen is the dependable collective
          flash; rear-camera capture and torch are explicitly opted into per device.
        </p>
      </section>

      <section className="particles-panel" aria-label="Installation controls">
        <div className="particles-stats">
          <span>
            <strong>{room ? room.peerCount + 1 : 1}</strong> phones present
          </span>
          <span>
            <strong>{cameraReady}</strong> cameras ready
          </span>
          <span>
            <strong>{torchReady}</strong> torches available
          </span>
        </div>

        {!armed ? (
          <div className="particles-arm">
            <p>
              One visible burst only. Do not use for repeated strobing; place every phone on power
              before a field rehearsal.
            </p>
            <button type="button" className="particles-primary" onClick={() => void arm()}>
              Arm this phone
            </button>
          </div>
        ) : (
          <>
            <div className="particles-options">
              <label>
                <input
                  type="checkbox"
                  checked={captureEnabled}
                  onChange={(event) => setCaptureEnabled(event.target.checked)}
                />
                Capture a local rear-camera frame at the cue
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={torchEnabled}
                  onChange={(event) => setTorchEnabled(event.target.checked)}
                />
                Add hardware torch when this device supports it
              </label>
            </div>
            {captureEnabled && (
              <div className="particles-camera">
                <video ref={camera.videoRef} playsInline muted aria-label="Rear camera preview" />
                <p>
                  {camera.ready
                    ? "Camera ready. The capture stays local on this phone."
                    : (camera.error ??
                      "Allow rear-camera access to include this phone in the capture.")}
                </p>
              </div>
            )}
            <div className="particles-actions">
              <button
                type="button"
                className="particles-secondary"
                onClick={() => schedule(2_500)}
                disabled={cue.state === "scheduled"}
              >
                Test cue · 2.5 s
              </button>
              <button
                type="button"
                className="particles-primary"
                onClick={() => schedule(5_000)}
                disabled={cue.state === "scheduled"}
              >
                Trigger moment · 5 s
              </button>
              <button
                type="button"
                className="particles-secondary"
                onClick={() => void fullscreen.toggle()}
              >
                {fullscreen.active ? "Exit fullscreen" : "Fullscreen"}
              </button>
            </div>
            {cue.state === "scheduled" && (
              <p className="particles-countdown">
                Cue in {((cue.remainingMs ?? 0) / 1000).toFixed(1)} seconds
              </p>
            )}
            {cue.state === "scheduled" && (
              <button type="button" className="particles-cancel" onClick={cue.cancel}>
                Cancel pending cue
              </button>
            )}
          </>
        )}

        <p className="particles-notice" role="status" aria-live="polite">
          {notice}
        </p>
        <p className="particles-note">
          Rehearsal transport is direct peer mesh. It is intentionally capped by practice, not by
          wishful thinking: the 50–200 device exhibition path needs the coordinator relay tracked in
          mesh-common issue #87.
        </p>
      </section>

      {lastShot && (
        <aside className="particles-shot">
          <img src={lastShot} alt="Latest local cue capture" />
          <a href={lastShot} download="mesh-particles-local-capture.jpg">
            Download this local frame
          </a>
        </aside>
      )}
    </main>
  );
}
