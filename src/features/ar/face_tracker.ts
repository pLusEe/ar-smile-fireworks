import type {
  FaceLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const SMILE_HOLD_MS = 90;
const LAUGH_HOLD_MS = 90;
const LAUGH_COOLDOWN_MS = 900;
const BASELINE_CALIBRATION_MS = 800;
const BASELINE_RESET_AFTER_MISSING_MS = 2500;
const MAX_FRONTAL_YAW_RATIO = 0.24;

export type ExpressionState = "neutral" | "smile" | "laugh";

export type ExpressionThresholds = {
  laughMouthExit: number;
  laughMouthOpen: number;
  smileLiftEnter: number;
  smileLiftExit: number;
};

export const DEFAULT_EXPRESSION_THRESHOLDS: ExpressionThresholds = {
  laughMouthExit: 0.012,
  laughMouthOpen: 0.025,
  smileLiftEnter: 0.01,
  smileLiftExit: 0.003,
};

export type HeadCollider = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
};

export type FaceMetrics = {
  faceYawRatio: number;
  mouthCornerLift: number;
  mouthOpenRatio: number;
  mouthWidthRatio: number;
};

export type FaceTrackingFrame = {
  calibrationProgress: number;
  collider: HeadCollider | null;
  expression: ExpressionState;
  isCalibrated: boolean;
  isFrontal: boolean;
  landmarks: NormalizedLandmark[];
  metrics: FaceMetrics;
};

type ExpressionMachine = {
  candidate: ExpressionState;
  candidateSince: number;
  cooldownUntil: number;
  state: ExpressionState;
};

export type FaceTracker = {
  close: () => void;
  detect: (video: HTMLVideoElement, timestampMs: number) => FaceTrackingFrame;
};

const EMPTY_METRICS: FaceMetrics = {
  faceYawRatio: 0,
  mouthCornerLift: 0,
  mouthOpenRatio: 0,
  mouthWidthRatio: 0,
};

type Point = {
  x: number;
  y: number;
};

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function rotateAround(
  point: Point,
  origin: Point,
  angle: number,
): Point {
  const deltaX = point.x - origin.x;
  const deltaY = point.y - origin.y;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return {
    x: deltaX * cosine - deltaY * sine,
    y: deltaX * sine + deltaY * cosine,
  };
}

function readGeometryMetrics(
  landmarks: NormalizedLandmark[],
  sourceWidth: number,
  sourceHeight: number,
): FaceMetrics {
  const leftMouth = landmarks[61];
  const rightMouth = landmarks[291];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseTip = landmarks[1];

  if (
    !leftMouth ||
    !rightMouth ||
    !upperLip ||
    !lowerLip ||
    !leftEye ||
    !rightEye ||
    !noseTip
  ) {
    return EMPTY_METRICS;
  }

  const toPixels = (landmark: NormalizedLandmark): Point => ({
    x: landmark.x * sourceWidth,
    y: landmark.y * sourceHeight,
  });
  const leftMouthPoint = toPixels(leftMouth);
  const rightMouthPoint = toPixels(rightMouth);
  const upperLipPoint = toPixels(upperLip);
  const lowerLipPoint = toPixels(lowerLip);
  const leftEyePoint = toPixels(leftEye);
  const rightEyePoint = toPixels(rightEye);
  const noseTipPoint = toPixels(noseTip);
  const eyeCenter = {
    x: (leftEyePoint.x + rightEyePoint.x) / 2,
    y: (leftEyePoint.y + rightEyePoint.y) / 2,
  };
  const faceRotation = Math.atan2(
    rightEyePoint.y - leftEyePoint.y,
    rightEyePoint.x - leftEyePoint.x,
  );
  const levelAngle = -faceRotation;
  const leveledLeftMouth = rotateAround(
    leftMouthPoint,
    eyeCenter,
    levelAngle,
  );
  const leveledRightMouth = rotateAround(
    rightMouthPoint,
    eyeCenter,
    levelAngle,
  );
  const leveledUpperLip = rotateAround(
    upperLipPoint,
    eyeCenter,
    levelAngle,
  );
  const leveledLowerLip = rotateAround(
    lowerLipPoint,
    eyeCenter,
    levelAngle,
  );
  const mouthWidth = Math.max(
    1,
    distance(leveledLeftMouth, leveledRightMouth),
  );
  const eyeDistance = Math.max(1, distance(leftEyePoint, rightEyePoint));
  const mouthCenterY = (leveledUpperLip.y + leveledLowerLip.y) / 2;
  const cornerAverageY =
    (leveledLeftMouth.y + leveledRightMouth.y) / 2;

  return {
    faceYawRatio:
      Math.abs(noseTipPoint.x - eyeCenter.x) / eyeDistance,
    mouthCornerLift: (mouthCenterY - cornerAverageY) / mouthWidth,
    mouthOpenRatio:
      Math.abs(leveledLowerLip.y - leveledUpperLip.y) / mouthWidth,
    mouthWidthRatio: mouthWidth / eyeDistance,
  };
}

function desiredExpression(
  metrics: FaceMetrics,
  currentState: ExpressionState,
  timestampMs: number,
  cooldownUntil: number,
  thresholds: ExpressionThresholds,
): ExpressionState {
  if (
    currentState === "laugh" &&
    metrics.mouthCornerLift >= thresholds.smileLiftExit &&
    metrics.mouthOpenRatio >= thresholds.laughMouthExit
  ) {
    return "laugh";
  }

  if (
    timestampMs >= cooldownUntil &&
    metrics.mouthCornerLift >= thresholds.smileLiftEnter &&
    metrics.mouthOpenRatio >= thresholds.laughMouthOpen
  ) {
    return "laugh";
  }

  if (metrics.mouthCornerLift >= thresholds.smileLiftEnter) {
    return "smile";
  }

  if (
    currentState === "smile" &&
    metrics.mouthCornerLift >= thresholds.smileLiftExit
  ) {
    return "smile";
  }

  return "neutral";
}

function updateExpressionMachine(
  machine: ExpressionMachine,
  metrics: FaceMetrics,
  timestampMs: number,
  thresholds: ExpressionThresholds,
) {
  const desired = desiredExpression(
    metrics,
    machine.state,
    timestampMs,
    machine.cooldownUntil,
    thresholds,
  );

  if (desired === machine.state) {
    machine.candidate = machine.state;
    machine.candidateSince = timestampMs;
    return machine.state;
  }

  if (machine.candidate !== desired) {
    machine.candidate = desired;
    machine.candidateSince = timestampMs;
  }

  const holdDuration =
    desired === "laugh"
      ? LAUGH_HOLD_MS
      : desired === "smile"
        ? SMILE_HOLD_MS
        : 120;

  if (timestampMs - machine.candidateSince < holdDuration) {
    return machine.state;
  }

  machine.state = desired;
  machine.candidate = desired;
  machine.candidateSince = timestampMs;
  if (desired === "laugh") {
    machine.cooldownUntil = timestampMs + LAUGH_COOLDOWN_MS;
  }

  return machine.state;
}

function estimateHeadCollider(
  landmarks: NormalizedLandmark[],
): HeadCollider | null {
  if (landmarks.length === 0) {
    return null;
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) {
    return null;
  }
  const headTop = Math.max(0, minY - height * 0.35);
  const headBottom = maxY;
  const headHeight = headBottom - headTop;

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const rotation =
    leftEye && rightEye
      ? Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
      : 0;

  return {
    centerX: (minX + maxX) / 2,
    centerY: (headTop + headBottom) / 2,
    radiusX: width * 0.59,
    radiusY: headHeight * 0.54,
    rotation,
  };
}

export async function createFaceTracker(): Promise<FaceTracker> {
  const { FaceLandmarker, FilesetResolver } = await import(
    "@mediapipe/tasks-vision"
  );
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  const commonOptions = {
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5,
      numFaces: 1,
      outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
    runningMode: "VIDEO" as const,
  };
  let landmarker: FaceLandmarker;

  try {
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        delegate: "GPU",
        modelAssetPath: MODEL_URL,
      },
      canvas: document.createElement("canvas"),
      ...commonOptions,
    });
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        delegate: "CPU",
        modelAssetPath: MODEL_URL,
      },
      ...commonOptions,
    });
  }

  const machine: ExpressionMachine = {
    candidate: "neutral",
    candidateSince: 0,
    cooldownUntil: 0,
    state: "neutral",
  };
  let baselineCornerLift = 0;
  let baselineMouthOpen = 0;
  let baselineSampleCount = 0;
  let baselineStartedAt = 0;
  let faceMissingSince = 0;
  let isCalibrated = false;
  const resetCalibration = () => {
    baselineCornerLift = 0;
    baselineMouthOpen = 0;
    baselineSampleCount = 0;
    baselineStartedAt = 0;
    isCalibrated = false;
  };

  const resetExpressionMachine = (timestampMs: number) => {
    machine.candidate = "neutral";
    machine.candidateSince = timestampMs;
    machine.state = "neutral";
  };

  return {
    close: () => landmarker.close(),
    detect: (video, timestampMs) => {
      const result = landmarker.detectForVideo(video, timestampMs);
      const landmarks = result.faceLandmarks[0] ?? [];
      const rawMetrics =
        landmarks.length > 0
          ? readGeometryMetrics(
              landmarks,
              video.videoWidth,
              video.videoHeight,
            )
          : EMPTY_METRICS;

      if (landmarks.length === 0) {
        resetExpressionMachine(timestampMs);
        if (faceMissingSince === 0) {
          faceMissingSince = timestampMs;
        } else if (
          timestampMs - faceMissingSince >=
          BASELINE_RESET_AFTER_MISSING_MS
        ) {
          resetCalibration();
        }
        return {
          calibrationProgress: 0,
          collider: null,
          expression: "neutral",
          isCalibrated,
          isFrontal: false,
          landmarks,
          metrics: EMPTY_METRICS,
        };
      }

      faceMissingSince = 0;
      const isFrontal = rawMetrics.faceYawRatio <= MAX_FRONTAL_YAW_RATIO;

      if (!isCalibrated) {
        resetExpressionMachine(timestampMs);
        if (!isFrontal) {
          baselineCornerLift = 0;
          baselineMouthOpen = 0;
          baselineSampleCount = 0;
          baselineStartedAt = 0;
        } else {
          if (baselineStartedAt === 0) {
            baselineStartedAt = timestampMs;
          }
          baselineCornerLift += rawMetrics.mouthCornerLift;
          baselineMouthOpen += rawMetrics.mouthOpenRatio;
          baselineSampleCount += 1;
          if (
            timestampMs - baselineStartedAt >=
              BASELINE_CALIBRATION_MS &&
            baselineSampleCount >= 6
          ) {
            baselineCornerLift /= baselineSampleCount;
            baselineMouthOpen /= baselineSampleCount;
            isCalibrated = true;
          }
        }
      }

      const metrics: FaceMetrics = {
        faceYawRatio: rawMetrics.faceYawRatio,
        mouthCornerLift: isCalibrated
          ? rawMetrics.mouthCornerLift - baselineCornerLift
          : 0,
        mouthOpenRatio: isCalibrated
          ? Math.max(0, rawMetrics.mouthOpenRatio - baselineMouthOpen)
          : 0,
        mouthWidthRatio: rawMetrics.mouthWidthRatio,
      };
      const expression =
        isCalibrated && isFrontal
          ? updateExpressionMachine(
              machine,
              metrics,
              timestampMs,
              DEFAULT_EXPRESSION_THRESHOLDS,
            )
          : "neutral";
      if (!isFrontal) {
        resetExpressionMachine(timestampMs);
      } else if (
        isCalibrated &&
        expression === "neutral" &&
        metrics.mouthCornerLift <
          DEFAULT_EXPRESSION_THRESHOLDS.smileLiftExit * 0.7 &&
        metrics.mouthOpenRatio <
          DEFAULT_EXPRESSION_THRESHOLDS.laughMouthExit * 0.7
      ) {
        baselineCornerLift +=
          (rawMetrics.mouthCornerLift - baselineCornerLift) * 0.004;
        baselineMouthOpen +=
          (rawMetrics.mouthOpenRatio - baselineMouthOpen) * 0.004;
      }

      return {
        calibrationProgress: isCalibrated
          ? 1
          : baselineStartedAt > 0
            ? Math.min(
                1,
                (timestampMs - baselineStartedAt) /
                  BASELINE_CALIBRATION_MS,
              )
            : 0,
        collider: estimateHeadCollider(landmarks),
        expression,
        isCalibrated,
        isFrontal,
        landmarks,
        metrics,
      };
    },
  };
}
