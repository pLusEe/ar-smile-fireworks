import {
  TUXButton,
  TUXSwitch,
  TUXText,
} from "@byted-tiktok/tux-web";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { DemoControlHandle } from "../../components/demo_control_handle";
import {
  HostMessages,
  HostToolbar,
  HostTopArea,
  useCanvasTransform,
} from "../../components/host_live_room";
import { ThemeScope } from "../../context/theme";
import { useOverlayStyle } from "../../hooks/useOverlayStyle";
import {
  createFaceTracker,
  type ExpressionState,
  type FaceMetrics,
  type FaceTracker,
} from "./face_tracker";
import {
  createDebugParticleEngine,
  type DebugParticleEngine,
} from "./particle_engine";

type ExperienceStatus =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "running"
  | "error";

type DebugSnapshot = FaceMetrics & {
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

const INITIAL_SNAPSHOT: DebugSnapshot = {
  activeParticles: 0,
  calibrationProgress: 0,
  effectFps: 0,
  expression: "neutral",
  faceYawRatio: 0,
  faceDetected: false,
  inferenceLatency: 0,
  isCalibrated: false,
  isFrontal: false,
  mouthCornerLift: 0,
  mouthOpenRatio: 0,
  mouthWidthRatio: 0,
  inferenceFps: 0,
  reducedLoad: false,
};

const INFERENCE_INTERVAL_MS = 50;
const REDUCED_INFERENCE_INTERVAL_MS = 80;
const UI_UPDATE_INTERVAL_MS = 120;
const PERFORMANCE_SAMPLE_INTERVAL_MS = 500;

const EXPRESSION_LABELS: Record<ExpressionState, string> = {
  laugh: "Laugh",
  neutral: "Neutral",
  smile: "Smile",
};

function formatScore(score: number) {
  return score.toFixed(2);
}

function DebugMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-[10px]">
      <TUXText color="UIText3" typographyPreset="SmallText1-Regular">
        {label}
      </TUXText>
      <TUXText color="UIText1" typographyPreset="P2-Semibold">
        {value}
      </TUXText>
    </div>
  );
}

function DisplaySetting({
  checked,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-[40px] items-center justify-between gap-[12px]">
      <TUXText color="UIText2" typographyPreset="P2-Regular">
        {label}
      </TUXText>
      <TUXSwitch
        checked={checked}
        name={name}
        onChange={(_, nextChecked) => onChange(nextChecked)}
        sizePreset="small"
        value="enabled"
      />
    </div>
  );
}

export default function ArDebugPage() {
  useOverlayStyle({
    homeIndicator: "light",
    statusBar: "light",
    themeColor: "#000000",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasTransform = useCanvasTransform();
  const engineRef = useRef<DebugParticleEngine | null>(null);
  const faceTrackerRef = useRef<FaceTracker | null>(null);
  const inferenceFrameRef = useRef(0);
  const inferenceFramesRef = useRef(0);
  const latestSnapshotRef = useRef<DebugSnapshot>(INITIAL_SNAPSHOT);
  const lastInferenceAtRef = useRef(0);
  const lastPerformanceSampleAtRef = useRef(0);
  const lastUiUpdateAtRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const startRequestRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshot, setSnapshot] =
    useState<DebugSnapshot>(INITIAL_SNAPSHOT);
  const [status, setStatus] = useState<ExperienceStatus>("idle");
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [showFaceMetrics, setShowFaceMetrics] = useState(true);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const showTrackingRef = useRef(showTracking);

  const stopExperience = useCallback(() => {
    startRequestRef.current += 1;
    window.cancelAnimationFrame(inferenceFrameRef.current);
    faceTrackerRef.current?.close();
    faceTrackerRef.current = null;
    engineRef.current?.destroy();
    engineRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => stopExperience, [stopExperience]);

  const startExperience = useCallback(async () => {
    stopExperience();
    const startRequest = startRequestRef.current;
    setErrorMessage("");
    setSnapshot(INITIAL_SNAPSHOT);
    latestSnapshotRef.current = INITIAL_SNAPSHOT;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("当前浏览器不支持摄像头访问。");
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
      if (startRequest !== startRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        throw new Error("调试画布尚未准备好。");
      }

      video.srcObject = stream;
      await video.play();

      setStatus("loading-model");
      const faceTracker = await createFaceTracker();
      if (startRequest !== startRequestRef.current) {
        faceTracker.close();
        return;
      }
      const particleEngine = createDebugParticleEngine(
        canvas,
        video,
      );
      faceTrackerRef.current = faceTracker;
      engineRef.current = particleEngine;
      particleEngine.setShowTracking(showTrackingRef.current);
      particleEngine.start();
      setStatus("running");
      inferenceFramesRef.current = 0;
      lastInferenceAtRef.current = 0;
      lastPerformanceSampleAtRef.current = performance.now();
      lastUiUpdateAtRef.current = 0;

      const runInference = (timestamp: number) => {
        const activeTracker = faceTrackerRef.current;
        const activeEngine = engineRef.current;
        const activeVideo = videoRef.current;
        if (!activeTracker || !activeEngine || !activeVideo) {
          return;
        }
        const enginePerformance =
          activeEngine.getPerformanceSnapshot();
        const inferenceInterval = enginePerformance.reducedLoad
          ? REDUCED_INFERENCE_INTERVAL_MS
          : INFERENCE_INTERVAL_MS;

        if (
          !document.hidden &&
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          timestamp - lastInferenceAtRef.current >= inferenceInterval
        ) {
          lastInferenceAtRef.current = timestamp;
          const inferenceStartedAt = performance.now();
          const frame = activeTracker.detect(activeVideo, timestamp);
          const inferenceLatency =
            performance.now() - inferenceStartedAt;
          inferenceFramesRef.current += 1;
          activeEngine.setTracking(
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

        const performanceSampleDuration =
          timestamp - lastPerformanceSampleAtRef.current;
        if (
          performanceSampleDuration >= PERFORMANCE_SAMPLE_INTERVAL_MS
        ) {
          const sampleSeconds = performanceSampleDuration / 1000;
          latestSnapshotRef.current = {
            ...latestSnapshotRef.current,
            inferenceFps: Math.round(
              inferenceFramesRef.current / sampleSeconds,
            ),
            ...activeEngine.getPerformanceSnapshot(),
          };
          inferenceFramesRef.current = 0;
          lastPerformanceSampleAtRef.current = timestamp;
        }

        if (timestamp - lastUiUpdateAtRef.current >= UI_UPDATE_INTERVAL_MS) {
          lastUiUpdateAtRef.current = timestamp;
          setSnapshot({ ...latestSnapshotRef.current });
        }

        inferenceFrameRef.current =
          window.requestAnimationFrame(runInference);
      };

      inferenceFrameRef.current =
        window.requestAnimationFrame(runInference);
    } catch (error) {
      if (startRequest !== startRequestRef.current) {
        return;
      }
      stopExperience();
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "摄像头或人脸模型初始化失败。",
      );
    }
  }, [stopExperience]);

  useEffect(() => {
    void startExperience();
  }, [startExperience]);

  useEffect(() => {
    showTrackingRef.current = showTracking;
    engineRef.current?.setShowTracking(showTracking);
  }, [showTracking]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      engineRef.current?.setPaused(document.hidden);
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    return () =>
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
  }, []);

  const faceStatus =
    status === "running"
      ? snapshot.faceDetected
        ? !snapshot.isFrontal
          ? "Face forward"
          : !snapshot.isCalibrated
            ? `Calibrating ${Math.round(
                snapshot.calibrationProgress * 100,
              )}%`
            : EXPRESSION_LABELS[snapshot.expression]
        : "No face"
      : status === "error"
        ? "Error"
        : "Loading";

  return (
    <ThemeScope
      mode="dark"
      className="relative h-full min-h-0 overflow-hidden bg-[#000000]"
    >
      <main className="relative h-full min-h-0 overflow-hidden bg-[#000000] text-[#ffffff]">
        <div
          className="absolute left-1/2 top-1/2 h-[844px] w-[390px] origin-center overflow-hidden bg-[#000000] font-[var(--app-font-sans)] text-[#ffffff] shadow-[0_0_80px_rgba(0,0,0,0.42)]"
          data-live-room-role="host"
          style={{ color: "#ffffff", transform: canvasTransform }}
        >
          <video
            ref={videoRef}
            aria-label="AR 调试摄像头画面"
            className={`absolute inset-0 h-full w-full scale-x-[-1] object-cover transition-opacity duration-200 ${
              status === "idle" || status === "error"
                ? "opacity-25"
                : "opacity-100"
            }`}
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            aria-label="头部碰撞、雾面水痕与烟花画布"
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[11] h-[160px] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.34),rgba(0,0,0,0.12),transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[11] h-[310px] bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.12),rgba(0,0,0,0.34))]" />
          <HostTopArea />
          <HostMessages />
          <HostToolbar />

          <div className="pointer-events-none absolute left-[12px] top-[164px] z-30 flex w-[184px] flex-col gap-[8px]">
            {showFaceMetrics ? (
              <section
                aria-label="AR 识别调试数据"
                className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[rgba(0,0,0,0.28)] p-[10px] shadow-[0_6px_20px_rgba(0,0,0,0.12)] backdrop-blur-[8px]"
              >
                <div className="flex items-center justify-between gap-[10px]">
                  <TUXText color="UIText2" typographyPreset="P2-Regular">
                    脸部状态
                  </TUXText>
                  <div
                    className={`shrink-0 rounded-full px-[8px] py-[3px] ${
                      snapshot.expression === "laugh"
                        ? "bg-[#FFED28]"
                        : snapshot.expression === "smile"
                          ? "bg-[#25F4EE]"
                          : "bg-[rgba(255,255,255,0.15)]"
                    }`}
                  >
                    <TUXText
                      color={
                        snapshot.expression === "neutral"
                          ? "#ffffff"
                          : "#161823"
                      }
                      typographyPreset="P2-Semibold"
                    >
                      {faceStatus}
                    </TUXText>
                  </div>
                </div>

                <div className="mt-[9px] flex flex-col gap-[5px] border-t border-[rgba(255,255,255,0.08)] pt-[8px]">
                  <DebugMetric
                    label="嘴角上扬"
                    value={formatScore(snapshot.mouthCornerLift)}
                  />
                  <DebugMetric
                    label="张嘴比例"
                    value={formatScore(snapshot.mouthOpenRatio)}
                  />
                  <DebugMetric
                    label="嘴宽比例"
                    value={formatScore(snapshot.mouthWidthRatio)}
                  />
                </div>
              </section>
            ) : null}

            {showPerformance ? (
              <section
                aria-label="AR 性能数据"
                className="rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[rgba(0,0,0,0.28)] p-[10px] shadow-[0_6px_20px_rgba(0,0,0,0.12)] backdrop-blur-[8px]"
              >
                <div className="flex flex-col gap-[5px]">
                  <DebugMetric
                    label="Effect FPS"
                    value={`${snapshot.effectFps}`}
                  />
                  <DebugMetric
                    label="Inference FPS"
                    value={`${snapshot.inferenceFps}`}
                  />
                  <DebugMetric
                    label="Inference latency"
                    value={`${snapshot.inferenceLatency.toFixed(1)} ms`}
                  />
                  <DebugMetric
                    label="Active particles"
                    value={`${snapshot.activeParticles}`}
                  />
                  <DebugMetric
                    label="Load mode"
                    value={snapshot.reducedLoad ? "Reduced" : "Full"}
                  />
                </div>
              </section>
            ) : null}
          </div>

          {status === "error" ? (
            <section className="absolute inset-x-[20px] top-[300px] z-30 flex flex-col items-center gap-[12px] text-center">
              <div className="rounded-full bg-[rgba(0,0,0,0.55)] px-[14px] py-[8px] backdrop-blur-[12px]">
                <TUXText
                  color="UITextDangerDisplay"
                  typographyPreset="P2-Regular"
                >
                  {errorMessage}
                </TUXText>
              </div>
              <TUXButton
                block
                onClick={() => void startExperience()}
                shapePreset="normal"
                sizePreset="large"
                smoothRadius
                text="重新启动 AR"
              />
            </section>
          ) : null}

          <DemoControlHandle
            ariaLabel="显示设置面板"
            canvasHeight={844}
            dataContext="ar-display"
            isOpen={isControlPanelOpen}
            onOpenChange={setIsControlPanelOpen}
          >
            {({ panelDragHandleProps, panelRight, panelTop }) => (
              <ThemeScope
                mode="dark"
                className="pointer-events-auto absolute w-[272px] overflow-hidden border border-[rgba(255,255,255,0.1)] bg-[var(--tux-v2-color-ui-page-flat-2,#1f1f1f)] shadow-[0_12px_36px_rgba(0,0,0,0.42)]"
                style={{
                  borderRadius:
                    "var(--tux-v2-radius-container-level2-small, 16px)",
                  right: panelRight,
                  top: panelTop,
                }}
              >
                <div data-demo-control-surface>
                  <div
                    aria-label="拖动显示设置面板"
                    className="flex h-[38px] cursor-move touch-none select-none items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-[12px]"
                    {...panelDragHandleProps}
                  >
                    <TUXText color="UIText1" typographyPreset="P2-Semibold">
                      显示设置
                    </TUXText>
                    <span
                      aria-hidden="true"
                      className="h-[3px] w-[32px] rounded-full bg-[rgba(255,255,255,0.25)]"
                    />
                  </div>
                  <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.08)] px-[12px] py-[6px]">
                    <DisplaySetting
                      checked={showFaceMetrics}
                      label="显示脸部状态参数"
                      name="show-face-metrics"
                      onChange={setShowFaceMetrics}
                    />
                    <DisplaySetting
                      checked={showPerformance}
                      label="显示性能 FPS"
                      name="show-performance"
                      onChange={setShowPerformance}
                    />
                    <DisplaySetting
                      checked={showTracking}
                      label="显示头部识别区域"
                      name="show-head-tracking"
                      onChange={setShowTracking}
                    />
                  </div>
                </div>
              </ThemeScope>
            )}
          </DemoControlHandle>
        </div>
      </main>
    </ThemeScope>
  );
}
