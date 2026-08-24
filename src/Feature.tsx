import { useEffect, useMemo, useRef, useState } from "react";
import {
  MeshDialog,
  useFileShare,
  useFlashlight,
  useFullscreen,
  useImageCapture,
  usePeerCapabilities,
  useRoomLifecycle,
  useScheduledCue,
  useWakeLock,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type ParticlesCue = { torch: boolean; capture: boolean; durationMs: number };
type Props = { room: YRoom | null; config: MeshConfig };
type GalleryImage = {
  id: string;
  name: string;
  url: string;
  mine: boolean;
  authorId: string;
  sessionId: string;
  capturedAt: number;
  shared: boolean;
};

const MAX_SHARED_PHOTOS = 12;
const MAX_SHARED_BYTES = 800 * 1024;

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

function cueFilename(id: string, peerId: string) {
  return `particles-${id.slice(0, 8)}-${peerId.slice(0, 12)}.jpg`;
}

function compactId(value: string) {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

function capturedLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

/** Mobile-first, small-room rehearsal client. A 50–200 device show needs a relay. */
export function Feature({ room, config }: Props) {
  const [armed, setArmed] = useState(false);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(true);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [flashing, setFlashing] = useState(false);
  const [notice, setNotice] = useState("Arm this phone to join the rehearsal.");
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const firedCue = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const capabilitySignature = useRef("");
  const galleryUrls = useRef(new Map<string, string>());
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => () => galleryUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

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
  const roomLifecycle = useRoomLifecycle(room);
  const photoShare = useFileShare(room, {
    mapName: "particles:photos:v1",
    maxBytes: MAX_SHARED_BYTES,
    yieldEveryChunks: 4,
  });
  const cue = useScheduledCue(room, "particles:cue:v2", {
    // The old awareness-median clock could move after writing a cue and change its deadline.
    minLeadMs: 1_000,
    maxLeadMs: 30_000,
    graceMs: 2_000,
    tickMs: 25,
    isPayload: isParticlesCue,
  });

  useEffect(() => {
    const next = {
      screen: armed,
      camera: armed && captureEnabled && camera.ready,
      torch: armed && torchEnabled && torch.supported,
    };
    const signature = JSON.stringify(next);
    if (capabilitySignature.current === signature) return;
    capabilitySignature.current = signature;
    capabilities.setMine(next);
  }, [armed, camera.ready, capabilities, captureEnabled, torch.supported, torchEnabled]);

  useEffect(() => {
    let active = true;
    const completeFiles = photoShare.files
      .filter((file) => file.complete)
      .slice(-MAX_SHARED_PHOTOS)
      .reverse();
    void Promise.all(
      completeFiles.map(async (file) => {
        let url = galleryUrls.current.get(file.id);
        if (!url) {
          const blob = await photoShare.blobOf(file.id);
          if (!blob) return null;
          url = URL.createObjectURL(blob);
          galleryUrls.current.set(file.id, url);
        }
        return {
          id: file.id,
          name: file.manifest.name,
          url,
          mine: file.manifest.deviceId
            ? file.manifest.deviceId === room?.deviceId
            : file.manifest.by === room?.peerId,
          authorId: file.manifest.deviceId ?? file.manifest.by,
          sessionId: file.manifest.by,
          capturedAt: file.manifest.at,
          shared: true,
        } satisfies GalleryImage;
      }),
    ).then((items) => {
      if (!active) return;
      const next = items.reduce<GalleryImage[]>((collected, item) => {
        if (item) collected.push(item);
        return collected;
      }, []);
      const included = new Set(next.map((item) => item.id));
      galleryUrls.current.forEach((url, id) => {
        if (!included.has(id)) {
          URL.revokeObjectURL(url);
          galleryUrls.current.delete(id);
        }
      });
      setGallery(next);
    });
    return () => {
      active = false;
    };
  }, [photoShare, room?.peerId]);

  const captureForCue = async (event: NonNullable<typeof cue.cue>) => {
    if (!event.payload.capture || !captureEnabled) return;
    const image = await camera.captureBlob(0.5);
    if (!image) {
      setNotice(camera.error ?? "This phone could not capture a camera frame.");
      return;
    }
    if (!shareEnabled) {
      const id = `local-${event.id}`;
      const url = URL.createObjectURL(image.blob);
      galleryUrls.current.set(id, url);
      setGallery((previous) =>
        [
          {
            id,
            name: "Local frame",
            url,
            mine: true,
            authorId: room?.deviceId ?? "local",
            sessionId: room?.peerId ?? "local",
            capturedAt: image.capturedAt,
            shared: false,
          },
          ...previous.filter((photo) => photo.id !== id),
        ].slice(0, MAX_SHARED_PHOTOS),
      );
      setNotice("Frame captured only on this phone.");
      return;
    }
    if (photoShare.files.length >= MAX_SHARED_PHOTOS) {
      setNotice(`Frame not shared: this rehearsal roll already has ${MAX_SHARED_PHOTOS} photos.`);
      return;
    }
    try {
      await photoShare.send(image.blob, {
        name: cueFilename(event.id, room?.peerId ?? "local"),
        id: `${event.id}:${room?.peerId ?? "local"}`,
      });
      setNotice("Frame captured and shared with this rehearsal room.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice(`Frame captured, but sharing failed: ${message}`);
    }
  };

  useEffect(() => {
    if (cue.state !== "due" || !cue.cue || firedCue.current === cue.cue.id) return;
    firedCue.current = cue.cue.id;
    const event = cue.cue;
    const canTorch = event.payload.torch && torchEnabled && torch.supported;
    setFlashing(true);
    setNotice(`Cue fired · ${cue.latenessMs ?? 0} ms late on this phone.`);
    if (canTorch) void torch.setOn(true);
    void captureForCue(event);
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
    shareEnabled,
    torch,
    torch.supported,
    torchEnabled,
  ]);

  const arm = async () => {
    setArmed(true);
    setNotice("Armed. Use Camera participation only after agreeing to share each capture.");
    if (wakeLock.supported) await wakeLock.acquire();
  };

  const schedule = (capture: boolean) => {
    if (!armed) {
      setNotice("Arm this phone first.");
      return;
    }
    if (!room) {
      setNotice(
        "Room is still initializing. Wait for the connection before scheduling a shared cue.",
      );
      return;
    }
    if (room.provider && roomLifecycle.status !== "connected") {
      setNotice(
        "Room is not connected yet. Reconnect or wait until the room is online before triggering everyone.",
      );
      return;
    }
    try {
      const ok = cue.scheduleIn(
        { torch: torchEnabled && torch.supported, capture, durationMs: 160 },
        delaySeconds * 1_000,
      );
      setNotice(
        ok
          ? `Cue locked for ${delaySeconds.toFixed(1)} seconds from now.`
          : "Cue could not be scheduled. Check the room connection and try again.",
      );
    } catch (error) {
      setNotice(`Cue error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const peerCapabilities = [...capabilities.peers.values()];
  const cameraReady =
    peerCapabilities.filter((peer) => peer.camera).length +
    Number(armed && captureEnabled && camera.ready);
  const torchReady =
    peerCapabilities.filter((peer) => peer.torch).length +
    Number(armed && torchEnabled && torch.supported);
  const sessions = room ? room.peerCount + 1 : 1;
  const sessionNoun = sessions === 1 ? "session" : "sessions";
  const sessionLabel = `${sessions} live ${sessionNoun}`;
  const displayedGallery = useMemo(() => gallery.slice(0, MAX_SHARED_PHOTOS), [gallery]);
  const sharedPhotoCount = photoShare.files.filter((file) => file.complete).length;
  const selectedIndex = Math.max(
    0,
    displayedGallery.findIndex((photo) => photo.id === selectedPhotoId),
  );
  const selectedPhoto = selectedPhotoId ? (displayedGallery[selectedIndex] ?? null) : null;
  const selectOffset = (offset: number) => {
    if (!displayedGallery.length) return;
    const next = (selectedIndex + offset + displayedGallery.length) % displayedGallery.length;
    setSelectedPhotoId(displayedGallery[next]?.id ?? null);
  };

  return (
    <main ref={stageRef} className={`particles-stage ${flashing ? "is-flashing" : ""}`}>
      <div className="particles-flash" aria-hidden="true" />
      <header className="particles-topbar">
        <div>
          <p className="particles-kicker">Shared light / photo moment</p>
          <h1 id="particles-title">{config.appName}</h1>
        </div>
        <span className="particles-room" aria-label={sessionLabel}>
          <b>{sessions}</b> {sessionNoun}
        </span>
      </header>

      <section className="particles-console" aria-labelledby="particles-title">
        {!armed ? (
          <div className="particles-arm">
            <p>
              A single white-screen burst, synchronized for a small rehearsal. Each phone chooses
              whether it participates with its camera.
            </p>
            <button type="button" className="particles-primary" onClick={() => void arm()}>
              Arm this phone
            </button>
          </div>
        ) : (
          <>
            <div className="particles-readiness" aria-label="Room readiness">
              <span>
                <b>{sessions}</b> live {sessionNoun}
              </span>
              <span>
                <b>{cameraReady}</b> camera-ready
              </span>
              <span>
                <b>{torchReady}</b> torch-ready
              </span>
              <span>
                <b>{sharedPhotoCount}</b> room photos
              </span>
            </div>
            <div className="particles-controls">
              <label className="particles-range">
                <span>Moment in</span>
                <output>{delaySeconds.toFixed(1)} s</output>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  value={delaySeconds}
                  aria-label="Moment in"
                  onChange={(event) => setDelaySeconds(Number(event.target.value))}
                />
              </label>
              <div className="particles-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={captureEnabled}
                    onChange={(event) => setCaptureEnabled(event.target.checked)}
                  />
                  This phone takes a photo
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={captureEnabled && shareEnabled}
                    disabled={!captureEnabled}
                    onChange={(event) => setShareEnabled(event.target.checked)}
                  />
                  Share it with the room
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={torchEnabled}
                    onChange={(event) => setTorchEnabled(event.target.checked)}
                  />
                  Use torch if available
                </label>
              </div>
            </div>
            <div className="particles-actions">
              <button
                type="button"
                className="particles-secondary"
                onClick={() => schedule(false)}
                disabled={cue.state === "scheduled"}
              >
                Test light
              </button>
              <button
                type="button"
                className="particles-primary"
                onClick={() => schedule(true)}
                disabled={cue.state === "scheduled"}
              >
                Trigger moment
              </button>
              <button
                type="button"
                className="particles-icon-button"
                onClick={() => void fullscreen.toggle()}
                aria-label={fullscreen.active ? "Exit fullscreen" : "Enter fullscreen"}
              >
                ⛶
              </button>
            </div>
            {room && room.provider && roomLifecycle.status !== "connected" && (
              <button
                type="button"
                className="particles-reconnect"
                onClick={() => {
                  const retried = roomLifecycle.reconnect();
                  setNotice(
                    retried
                      ? "Reconnecting room… trigger is enabled once the signaling connection returns."
                      : "This browser could not start a room reconnect. Check its network/VPN settings.",
                  );
                }}
              >
                {roomLifecycle.status === "joining" ? "Room joining… reconnect" : "Reconnect room"}
              </button>
            )}
            {cue.state === "scheduled" && (
              <div className="particles-countdown-wrap">
                <p className="particles-countdown" aria-live="polite">
                  {((cue.remainingMs ?? 0) / 1_000).toFixed(1)}
                </p>
                <button type="button" className="particles-cancel" onClick={cue.cancel}>
                  Cancel
                </button>
              </div>
            )}
            {captureEnabled && (
              <div className="particles-camera">
                <video ref={camera.videoRef} playsInline muted aria-label="Rear camera preview" />
                <p>{camera.ready ? "Camera participating" : (camera.error ?? "Opening camera…")}</p>
              </div>
            )}
          </>
        )}
        <p className="particles-notice" role="status" aria-live="polite">
          {notice}
        </p>
      </section>

      <section className="particles-gallery" aria-label="Shared rehearsal frames">
        <div className="particles-gallery-heading">
          <p>Rehearsal roll</p>
          <span>small rooms · {MAX_SHARED_PHOTOS} photos max</span>
        </div>
        {displayedGallery.length ? (
          <div className="particles-gallery-strip">
            {displayedGallery.map((photo) => (
              <button
                type="button"
                className="particles-photo"
                key={photo.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                aria-label={`View ${photo.mine ? "your" : "shared"} photo from ${compactId(photo.authorId)}`}
              >
                <img src={photo.url} alt="Cue capture" />
                <span>{photo.mine ? "this device" : compactId(photo.authorId)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="particles-gallery-empty">
            Captured frames from opted-in phones appear here.
          </p>
        )}
      </section>
      <MeshDialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) setSelectedPhotoId(null);
        }}
        title={
          selectedPhoto
            ? `Frame ${selectedIndex + 1} of ${displayedGallery.length}`
            : "Frame viewer"
        }
        description={
          selectedPhoto
            ? `${selectedPhoto.shared ? "Shared" : "Local"} · ${capturedLabel(selectedPhoto.capturedAt)}`
            : undefined
        }
        className="particles-viewer"
        footer={
          selectedPhoto ? (
            <>
              <button
                type="button"
                className="particles-secondary"
                onClick={() => selectOffset(-1)}
                disabled={displayedGallery.length < 2}
              >
                Previous
              </button>
              <button
                type="button"
                className="particles-secondary"
                onClick={() => selectOffset(1)}
                disabled={displayedGallery.length < 2}
              >
                Next
              </button>
              <a
                className="particles-download"
                href={selectedPhoto.url}
                download={selectedPhoto.name}
              >
                Download
              </a>
            </>
          ) : undefined
        }
      >
        {selectedPhoto && (
          <div
            className="particles-viewer-frame"
            onPointerDown={(event) => {
              swipeStartX.current = event.clientX;
            }}
            onPointerUp={(event) => {
              const startX = swipeStartX.current;
              swipeStartX.current = null;
              if (startX === null || Math.abs(event.clientX - startX) < 45) return;
              selectOffset(event.clientX < startX ? 1 : -1);
            }}
          >
            <img
              src={selectedPhoto.url}
              alt={`Cue frame from device ${compactId(selectedPhoto.authorId)}`}
            />
            <dl className="particles-viewer-meta">
              <div>
                <dt>Device</dt>
                <dd>
                  {compactId(selectedPhoto.authorId)}
                  {selectedPhoto.mine ? " · this browser" : ""}
                </dd>
              </div>
              <div>
                <dt>Session</dt>
                <dd>{compactId(selectedPhoto.sessionId)}</dd>
              </div>
              <div>
                <dt>Captured</dt>
                <dd>{capturedLabel(selectedPhoto.capturedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </MeshDialog>
      <footer className="particles-footnote">
        Keep the screen visible and use one burst only. Gallery sharing is intentionally limited to
        a small rehearsal room; the 50–200 phone installation requires the dedicated relay and
        collector path in mesh-common issue #87.
      </footer>
    </main>
  );
}
