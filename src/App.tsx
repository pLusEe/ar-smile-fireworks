import { useCallback, useEffect, useRef, useState } from "react";

import {
  createEffectsEngine,
  type EffectsEngine,
} from "./effectsEngine";
import {
  createFaceTracker,
  type ExpressionState,
  type FaceMetrics,
  type FaceTracker,
} from "./faceTracker";

type ExperienceStatus =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "running"
  | "error";

type Snapshot = FaceMetrics & {
  activeParticles: number;
  calibrationProgress: number;
  effectFps: number;
  expression: ExpressionState;
  faceDetected: boolean;
  inferenceFps: number;
  inferenceLatency: number;
  isCalibrated: boolean;
  isFrontal: boolean;
  reducedLoad: boolean;
};

const EMPTY_SNAPSHOT: Snapshot = {
  activeParticles: 0,
  calibrationProgress: 0,
  effectFps: 0,
  expression: "neutral",
  faceDetected: false,
  faceYawRatio: 0,
  inferenceFps: 0,
  inferenceLatency: 0,
  isCalibrated: false,
  isFrontal: false,
  mouthCornerLift: 0,
  mouthOpenRatio: 0,
  mouthWidthRatio: 0,
  reducedLoad: false,
};

const INFERENCE_INTERVAL_MS = 50;
const REDUCED_INFERENCE_INTERVAL_MS = 80;
const PERFORMANCE_SAMPLE_INTERVAL_MS = 500;
const UI_UPDATE_INTERVAL_MS = 120;

const CHAT_MESSAGES = [
  {
    color: "#7256d8",
    level: "45",
    message: "Welcome to the LIVE! Here you can connect with friends",
    name: "Aliveness",
  },
  {
    color: "#ff795e",
    level: "5",
    message: "What’s up bois",
    name: "Yves_SF",
  },
  {
    color: "#3f9ed8",
    level: "30",
    message: "You are an inspiration to us all",
    name: "ronweasly1",
  },
  {
    color: "#b2a2ff",
    level: "",
    message: "joined",
    name: "zero_taeyeon",
  },
  {
    color: "#ff795e",
    level: "5",
    message: "The stream looks amazing today",
    name: "Yves_SF",
  },
] as const;

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

function CircleIcon({
  label,
  symbol,
}: {
  label: string;
  symbol: string;
}) {
  return (
    <button aria-label={label} className="tool-button" type="button">
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}

function LiveRoomHud() {
  return (
    <>
      <div className="top-shade" />
      <div className="bottom-shade" />

      <header className="host-top">
        <div className="host-row">
          <div className="host-profile">
            <div className="host-avatar">T</div>
            <div className="host-copy">
              <strong>Theodore_88</strong>
              <span>♥ 127.4K</span>
            </div>
            <span className="heart-level">♥ 12</span>
          </div>
          <div className="viewer-cluster">
            <span className="viewer-medal viewer-medal-one">2K+</span>
            <span className="viewer-medal viewer-medal-two">167</span>
            <span className="viewer-count">278</span>
            <button aria-label="End live" className="close-live" type="button">
              ×
            </button>
          </div>
        </div>

        <div className="ranking-row">
          <span className="league-pill">♛ League A2 top 80%</span>
          <span className="live-fest-pill">
            LIVE Fest <b>✦</b>
          </span>
        </div>

        <div className="connection-pill">
          <span>▥</span>
          <span>⌂</span>
          <span>›</span>
        </div>
      </header>

      <section className="live-feed" aria-label="Live chat">
        <div className="gift-tray gift-tray-primary">
          <span className="gift-avatar">A</span>
          <span className="gift-copy">
            <strong>Aliveness</strong>
            <small>sent Pancake</small>
          </span>
          <span className="gift-symbol">✦</span>
          <strong className="gift-count">×30</strong>
        </div>
        <div className="gift-tray gift-tray-secondary">
          <span className="gift-avatar">Y</span>
          <span className="gift-copy">
            <strong>Yves_SF</strong>
            <small>sent Universe</small>
          </span>
          <span className="gift-symbol">◉</span>
          <strong className="gift-count">×1</strong>
        </div>

        <div className="chat-list">
          {CHAT_MESSAGES.map((message, index) => (
            <div className="chat-row" key={`${message.name}-${index}`}>
              <span
                className="chat-avatar"
                style={{ backgroundColor: message.color }}
              >
                {message.name.slice(0, 1)}
              </span>
              <div className="chat-copy">
                <div className="chat-meta">
                  {message.level ? (
                    <span className="level-badge">◆ {message.level}</span>
                  ) : null}
                  <span>{message.name}</span>
                </div>
                <p>{message.message}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <nav className="live-toolbar" aria-label="Live controls">
        <div>
          <CircleIcon label="Co-host" symbol="♧" />
          <CircleIcon label="Multi LIVE" symbol="▦" />
        </div>
        <div>
          <CircleIcon label="Interaction" symbol="✦" />
          <CircleIcon label="Share" symbol="↗" />
          <CircleIcon label="Enhance" symbol="✣" />
          <CircleIcon label="More" symbol="•••" />
        </div>
      </nav>
    </>
  );
}

function expressionLabel(snapshot: Snapshot, status: ExperienceStatus) {
  if (status === "error") {
    return "Error";
  }
  if (status !== "running") {
    return "Loading";
  }
  if (!snapshot.faceDetected) {
    return "No face";
  }
  if (!snapshot.isFrontal) {
    return "Face forward";
  }
  if (!snapshot.isCalibrated) {
    return `Calibrating ${Math.round(
      snapshot.calibrationProgress * 100,
    )}%`;
  }
  return snapshot.expression[0]?.toUpperCase() +
    snapshot.expression.slice(1);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<EffectsEngine | null>(null);
  const faceTrackerRef = useRef<FaceTracker | null>(null);
  const inferenceFrameRef = useRef(0);
  const inferenceFramesRef = useRef(0);
  const latestSnapshotRef = useRef<Snapshot>(EMPTY_SNAPSHOT);
  const lastInferenceAtRef = useRef(0);
  const lastPerformanceAtRef = useRef(0);
  const lastUiAtRef = useRef(0);
  const requestRef = useRef(0);
  const showTrackingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showFaceMetrics, setShowFaceMetrics] = useState(true);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<ExperienceStatus>("idle");
  const [stageTransform, setStageTransform] = useState(
    "translate3d(-50%, -50%, 0)",
  );

  const stop = useCallback(() => {
    requestRef.current += 1;
    cancelAnimationFrame(inferenceFrameRef.current);
    faceTrackerRef.current?.close();
    faceTrackerRef.current = null;
    effectsRef.current?.destroy();
    effectsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    const requestId = requestRef.current;
    setError("");
    setSnapshot(EMPTY_SNAPSHOT);
    latestSnapshotRef.current = EMPTY_SNAPSHOT;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support camera access.");
      }

      setStatus("requesting-camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          height: { ideal: 1280 },
          width: { ideal: 720 },
        },
      });
      if (requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        throw new Error("The AR canvas is not ready.");
      }
      video.srcObject = stream;
      await video.play();

      setStatus("loading-model");
      const [faceTracker, effects] = await Promise.all([
        createFaceTracker(),
        Promise.resolve(createEffectsEngine(canvas, video)),
      ]);
      if (requestId !== requestRef.current) {
        faceTracker.close();
        effects.destroy();
        return;
      }

      faceTrackerRef.current = faceTracker;
      effectsRef.current = effects;
      effects.setShowTracking(showTrackingRef.current);
      effects.start();
      setStatus("running");

      inferenceFramesRef.current = 0;
      lastInferenceAtRef.current = 0;
      lastPerformanceAtRef.current = performance.now();
      lastUiAtRef.current = 0;

      const loop = (timestamp: number) => {
        const tracker = faceTrackerRef.current;
        const engine = effectsRef.current;
        const activeVideo = videoRef.current;
        if (!tracker || !engine || !activeVideo) {
          return;
        }

        const enginePerformance = engine.getPerformanceSnapshot();
        const inferenceInterval = enginePerformance.reducedLoad
          ? REDUCED_INFERENCE_INTERVAL_MS
          : INFERENCE_INTERVAL_MS;
        if (
          !document.hidden &&
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          timestamp - lastInferenceAtRef.current >= inferenceInterval
        ) {
          lastInferenceAtRef.current = timestamp;
          const startedAt = performance.now();
          const frame = tracker.detect(activeVideo, timestamp);
          const inferenceLatency = performance.now() - startedAt;
          inferenceFramesRef.current += 1;

          engine.setTracking(
            frame.collider,
            frame.landmarks,
            frame.expression,
            activeVideo.videoWidth,
            activeVideo.videoHeight,
          );
          latestSnapshotRef.current = {
            ...latestSnapshotRef.current,
            ...frame.metrics,
            calibrationProgress: frame.calibrationProgress,
            expression: frame.expression,
            faceDetected: frame.collider !== null,
            inferenceLatency,
            isCalibrated: frame.isCalibrated,
            isFrontal: frame.isFrontal,
          };
        }

        const sampleDuration =
          timestamp - lastPerformanceAtRef.current;
        if (sampleDuration >= PERFORMANCE_SAMPLE_INTERVAL_MS) {
          latestSnapshotRef.current = {
            ...latestSnapshotRef.current,
            inferenceFps: Math.round(
              inferenceFramesRef.current / (sampleDuration / 1000),
            ),
            ...engine.getPerformanceSnapshot(),
          };
          inferenceFramesRef.current = 0;
          lastPerformanceAtRef.current = timestamp;
        }

        if (timestamp - lastUiAtRef.current >= UI_UPDATE_INTERVAL_MS) {
          lastUiAtRef.current = timestamp;
          setSnapshot({ ...latestSnapshotRef.current });
        }
        inferenceFrameRef.current = requestAnimationFrame(loop);
      };

      inferenceFrameRef.current = requestAnimationFrame(loop);
    } catch (caughtError) {
      if (requestId !== requestRef.current) {
        return;
      }
      stop();
      setStatus("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Camera or face tracking failed to start.",
      );
    }
  }, [stop]);

  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  useEffect(() => {
    const updateStageTransform = () => {
      const scale = Math.max(
        window.innerWidth / 390,
        window.innerHeight / 844,
      );
      setStageTransform(
        `translate3d(-50%, -50%, 0) scale(${scale})`,
      );
    };
    updateStageTransform();
    window.addEventListener("resize", updateStageTransform);
    window.visualViewport?.addEventListener(
      "resize",
      updateStageTransform,
    );
    return () => {
      window.removeEventListener("resize", updateStageTransform);
      window.visualViewport?.removeEventListener(
        "resize",
        updateStageTransform,
      );
    };
  }, []);

  useEffect(() => {
    showTrackingRef.current = showTracking;
    effectsRef.current?.setShowTracking(showTracking);
  }, [showTracking]);

  useEffect(() => {
    const onVisibilityChange = () => {
      effectsRef.current?.setPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
  }, []);

  const label = expressionLabel(snapshot, status);

  return (
    <main className="app-shell">
      <section
        className="phone-stage"
        aria-label="AR expression demo"
        style={{ transform: stageTransform }}
      >
        <video
          ref={videoRef}
          aria-label="Front camera"
          className="camera"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          aria-label="Rain, fireworks, and collision effects"
          className="effects"
        />

        <LiveRoomHud />

        <div className="debug-stack">
          {showFaceMetrics ? (
            <section className="debug-card" aria-label="Face metrics">
              <div className="debug-heading">
                <span>Face state</span>
                <strong data-state={snapshot.expression}>{label}</strong>
              </div>
              <Metric
                label="Mouth corner lift"
                value={snapshot.mouthCornerLift.toFixed(3)}
              />
              <Metric
                label="Mouth open ratio"
                value={snapshot.mouthOpenRatio.toFixed(3)}
              />
              <Metric
                label="Mouth width ratio"
                value={snapshot.mouthWidthRatio.toFixed(3)}
              />
            </section>
          ) : null}

          {showPerformance ? (
            <section className="debug-card" aria-label="Performance metrics">
              <Metric label="Effect FPS" value={`${snapshot.effectFps}`} />
              <Metric
                label="Inference FPS"
                value={`${snapshot.inferenceFps}`}
              />
              <Metric
                label="Inference latency"
                value={`${snapshot.inferenceLatency.toFixed(1)} ms`}
              />
              <Metric
                label="Active particles"
                value={`${snapshot.activeParticles}`}
              />
              <Metric
                label="Load mode"
                value={snapshot.reducedLoad ? "Reduced" : "Full"}
              />
            </section>
          ) : null}
        </div>

        {status === "error" ? (
          <section className="error-card">
            <strong>Camera unavailable</strong>
            <p>{error}</p>
            <button onClick={() => void start()} type="button">
              Try again
            </button>
          </section>
        ) : null}

        <button
          aria-expanded={settingsOpen}
          aria-label="Open display settings"
          className="settings-button"
          onClick={() => setSettingsOpen((open) => !open)}
          type="button"
        >
          ⚙
        </button>

        {settingsOpen ? (
          <section className="settings-panel" aria-label="Display settings">
            <div className="settings-heading">
              <strong>Display settings</strong>
              <button
                aria-label="Close display settings"
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <Toggle
              checked={showFaceMetrics}
              label="Face metrics"
              onChange={setShowFaceMetrics}
            />
            <Toggle
              checked={showPerformance}
              label="Performance"
              onChange={setShowPerformance}
            />
            <Toggle
              checked={showTracking}
              label="Head tracking"
              onChange={setShowTracking}
            />
          </section>
        ) : null}

      </section>
    </main>
  );
}
