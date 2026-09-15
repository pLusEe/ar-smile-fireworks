import type {
  ExpressionState,
  HeadCollider,
} from "./faceTracker";

type Spark = {
  active: boolean;
  color: string;
  collided: boolean;
  gravity: number;
  life: number;
  maxLife: number;
  radius: number;
  trailCount: number;
  trailIndex: number;
  trailX: number[];
  trailY: number[];
  velocityX: number;
  velocityY: number;
  x: number;
  y: number;
};

type WaterChannel = {
  active: boolean;
  branchDirection: number;
  branchLength: number;
  mergeAt: number;
  merged: boolean;
  radius: number;
  seed: number;
  speed: number;
  startX: number;
  startY: number;
  travelled: number;
  travelLimit: number;
};

export type PerformanceSnapshot = {
  activeParticles: number;
  effectFps: number;
  reducedLoad: boolean;
};

export type EffectsEngine = {
  destroy: () => void;
  getPerformanceSnapshot: () => PerformanceSnapshot;
  setPaused: (paused: boolean) => void;
  setShowTracking: (show: boolean) => void;
  setTracking: (
    collider: HeadCollider | null,
    landmarks: ReadonlyArray<{ x: number; y: number }>,
    expression: ExpressionState,
    sourceWidth: number,
    sourceHeight: number,
  ) => void;
  start: () => void;
};

const MAX_SPARKS = 180;
const MAX_WATER_CHANNELS = 4;
const TRAIL_POINTS = 16;
const COLD_WHITE = "#F3F8FF";
const WARM_GOLD = "#FFD58A";
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397,
  365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58,
  132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

function rotate(x: number, y: number, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
}

function collideWithHead(
  spark: Spark,
  collider: HeadCollider,
  width: number,
  height: number,
) {
  const centerX = collider.centerX * width;
  const centerY = collider.centerY * height;
  const radiusX = collider.radiusX * width;
  const radiusY = collider.radiusY * height;
  const local = rotate(
    spark.x - centerX,
    spark.y - centerY,
    -collider.rotation,
  );
  const distance =
    (local.x * local.x) / (radiusX * radiusX) +
    (local.y * local.y) / (radiusY * radiusY);
  if (distance >= 1) {
    return false;
  }

  const gradientX = local.x / (radiusX * radiusX);
  const gradientY = local.y / (radiusY * radiusY);
  const gradientLength = Math.hypot(gradientX, gradientY) || 1;
  const normal = rotate(
    gradientX / gradientLength,
    gradientY / gradientLength,
    collider.rotation,
  );
  const projectedVelocity =
    spark.velocityX * normal.x + spark.velocityY * normal.y;
  spark.velocityX -= 1.65 * projectedVelocity * normal.x;
  spark.velocityY -= 1.65 * projectedVelocity * normal.y;

  const correctionScale = 1 / Math.sqrt(Math.max(distance, 0.001));
  const corrected = rotate(
    local.x * correctionScale,
    local.y * correctionScale,
    collider.rotation,
  );
  spark.x = centerX + corrected.x;
  spark.y = centerY + corrected.y;
  spark.velocityX += normal.x * 160;
  spark.velocityY += normal.y * 120;
  spark.collided = true;
  spark.trailCount = 1;
  spark.trailIndex = 0;
  spark.trailX[0] = spark.x;
  spark.trailY[0] = spark.y;
  return true;
}

function channelX(channel: WaterChannel, travelled: number) {
  const bend = Math.min(1, travelled / 70);
  return (
    channel.startX +
    (Math.sin(travelled * 0.018 + channel.seed) * 0.72 +
      Math.sin(travelled * 0.007 + channel.seed * 1.6) * 0.28) *
      14 *
      bend
  );
}

export function createEffectsEngine(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
): EffectsEngine {
  const context = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });
  if (!context) {
    throw new Error("Canvas 2D is unavailable.");
  }

  const fogCanvas = document.createElement("canvas");
  const fogContext = fogCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });
  if (!fogContext) {
    throw new Error("Fog canvas 2D is unavailable.");
  }

  const sparks: Spark[] = Array.from({ length: MAX_SPARKS }, () => ({
    active: false,
    color: COLD_WHITE,
    collided: false,
    gravity: 160,
    life: 0,
    maxLife: 1,
    radius: 2,
    trailCount: 0,
    trailIndex: 0,
    trailX: Array(TRAIL_POINTS).fill(0),
    trailY: Array(TRAIL_POINTS).fill(0),
    velocityX: 0,
    velocityY: 0,
    x: 0,
    y: 0,
  }));
  const waterChannels: WaterChannel[] = Array.from(
    { length: MAX_WATER_CHANNELS },
    () => ({
      active: false,
      branchDirection: 1,
      branchLength: 0,
      mergeAt: -1,
      merged: false,
      radius: 4,
      seed: 0,
      speed: 50,
      startX: 0,
      startY: 0,
      travelled: 0,
      travelLimit: 180,
    }),
  );

  let collider: HeadCollider | null = null;
  let effectFps = 0;
  let expression: ExpressionState = "neutral";
  let fogStrength = 0;
  let frameCount = 0;
  let frameId = 0;
  let height = 1;
  let highFpsSamples = 0;
  let landmarks: ReadonlyArray<{ x: number; y: number }> = [];
  let lastFogAt = 0;
  let lastFrameAt = 0;
  let lastPerformanceAt = 0;
  let lowFpsSamples = 0;
  let nextFireworkAt = 0;
  let nextWaterAt = 0;
  let reducedLoad = false;
  let running = false;
  let showTracking = false;
  let sourceHeight = 1;
  let sourceWidth = 1;
  let width = 1;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    fogCanvas.width = Math.max(1, Math.round(width * 0.5));
    fogCanvas.height = Math.max(1, Math.round(height * 0.5));
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const mapPoint = (point: { x: number; y: number }) => {
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropX = (sourceWidth * scale - width) / 2;
    const cropY = (sourceHeight * scale - height) / 2;
    return {
      x: width - (point.x * sourceWidth * scale - cropX),
      y: point.y * sourceHeight * scale - cropY,
    };
  };

  const getDisplayCollider = () => {
    if (!collider) {
      return null;
    }
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const center = mapPoint({
      x: collider.centerX,
      y: collider.centerY,
    });
    return {
      centerX: center.x / width,
      centerY: center.y / height,
      radiusX: (collider.radiusX * sourceWidth * scale) / width,
      radiusY: (collider.radiusY * sourceHeight * scale) / height,
      rotation: -collider.rotation,
    };
  };

  const clearHeadFromFog = () => {
    const points = FACE_OVAL.map((index) => landmarks[index])
      .filter(Boolean)
      .map(mapPoint);
    if (points.length !== FACE_OVAL.length) {
      return;
    }

    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const faceHeight = maxY - minY;
    const center = points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / points.length,
        y: sum.y + point.y / points.length,
      }),
      { x: 0, y: 0 },
    );
    const outline = points.map((point) => {
      const topInfluence = Math.pow(
        Math.max(
          0,
          1 - (point.y - minY) / Math.max(1, faceHeight * 0.46),
        ),
        1.45,
      );
      return {
        x:
          center.x +
          (point.x - center.x) * (1 + topInfluence * 0.11),
        y: point.y - faceHeight * 0.34 * topInfluence,
      };
    });
    const trace = (scale: number) => {
      const first = outline[0];
      const last = outline.at(-1);
      if (!first || !last) {
        return;
      }
      context.beginPath();
      context.moveTo(
        center.x + ((last.x + first.x) / 2 - center.x) * scale,
        center.y + ((last.y + first.y) / 2 - center.y) * scale,
      );
      for (let index = 0; index < outline.length; index += 1) {
        const point = outline[index];
        const next = outline[(index + 1) % outline.length];
        if (!point || !next) {
          continue;
        }
        context.quadraticCurveTo(
          center.x + (point.x - center.x) * scale,
          center.y + (point.y - center.y) * scale,
          center.x +
            ((point.x + next.x) / 2 - center.x) * scale,
          center.y +
            ((point.y + next.y) / 2 - center.y) * scale,
        );
      }
      context.closePath();
    };

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.filter = "blur(22px)";
    context.fillStyle = `rgba(0,0,0,${0.84 * fogStrength})`;
    trace(1.1);
    context.fill();
    context.filter = "none";
    context.fillStyle = "#000";
    trace(1);
    context.fill();
    context.restore();
  };

  const resetWaterChannel = (channel: WaterChannel) => {
    const existing = waterChannels.find(
      (candidate) =>
        candidate !== channel &&
        candidate.active &&
        candidate.radius < 4.5,
    );
    const radiusSeed = Math.random();
    channel.active = true;
    channel.radius =
      radiusSeed < 0.45
        ? 2.4 + Math.random() * 1.4
        : radiusSeed < 0.88
          ? 4.2 + Math.random() * 1.8
          : 6.2 + Math.random() * 1.6;
    channel.startX = existing
      ? existing.startX + (Math.random() - 0.5) * 18
      : 24 + Math.random() * (width - 48);
    channel.startY = existing
      ? Math.max(12, existing.startY - 42 - Math.random() * 24)
      : 20 + Math.random() * height * 0.48;
    channel.travelled = 0;
    channel.travelLimit = 100 + Math.random() * height * 0.48;
    channel.speed = 44 + channel.radius * (6 + Math.random() * 3);
    channel.seed = Math.random() * Math.PI * 2;
    channel.merged = false;
    channel.mergeAt = -1;
    channel.branchDirection = Math.random() < 0.5 ? -1 : 1;
    channel.branchLength = 20 + Math.random() * 28;
  };

  const emitSpark = (
    x: number,
    y: number,
    angle: number,
    speed: number,
    falling: boolean,
  ) => {
    const spark = sparks.find((candidate) => !candidate.active);
    if (!spark) {
      return;
    }
    spark.active = true;
    spark.collided = false;
    spark.color = Math.random() < 0.08 ? WARM_GOLD : COLD_WHITE;
    spark.gravity = falling ? 230 : 120;
    spark.life = falling
      ? 1.8 + Math.random() * 0.55
      : 2.1 + Math.random() * 0.6;
    spark.maxLife = spark.life;
    spark.radius = falling
      ? 1.4 + Math.random() * 1.2
      : 2 + Math.random() * 1.7;
    spark.velocityX = Math.cos(angle) * speed;
    spark.velocityY = Math.sin(angle) * speed;
    spark.x = x;
    spark.y = y;
    spark.trailCount = 1;
    spark.trailIndex = 0;
    spark.trailX[0] = x;
    spark.trailY[0] = y;
  };

  const burst = (displayCollider: HeadCollider | null) => {
    const centerX = displayCollider
      ? displayCollider.centerX * width
      : width * 0.5;
    const headTop = displayCollider
      ? (displayCollider.centerY - displayCollider.radiusY) * height
      : height * 0.48;
    const x = Math.min(
      width - 42,
      Math.max(42, centerX + (Math.random() - 0.5) * width * 0.72),
    );
    const y =
      Math.min(height * 0.18, Math.max(72, headTop - height * 0.3)) +
      height * (0.015 + Math.random() * 0.1);
    const coreCount = (reducedLoad ? 7 : 10) + Math.floor(Math.random() * 4);
    const fallingCount =
      (reducedLoad ? 2 : 3) + Math.floor(Math.random() * 2);

    for (let index = 0; index < coreCount; index += 1) {
      const angle =
        (index / coreCount) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.35;
      emitSpark(x, y, angle, 90 + Math.random() * 80, false);
    }
    for (let index = 0; index < fallingCount; index += 1) {
      const angle =
        (index / fallingCount) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.3;
      emitSpark(x, y, angle, 150 + Math.random() * 90, true);
    }
  };

  const drawTracking = (displayCollider: HeadCollider | null) => {
    if (!showTracking || !displayCollider) {
      return;
    }
    context.save();
    context.translate(
      displayCollider.centerX * width,
      displayCollider.centerY * height,
    );
    context.rotate(displayCollider.rotation);
    context.strokeStyle = "rgba(255,255,255,0.82)";
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.beginPath();
    context.ellipse(
      0,
      0,
      displayCollider.radiusX * width,
      displayCollider.radiusY * height,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  };

  const render = (timestamp: number) => {
    if (!running) {
      return;
    }

    frameCount += 1;
    if (lastPerformanceAt === 0) {
      lastPerformanceAt = timestamp;
    } else if (timestamp - lastPerformanceAt >= 500) {
      effectFps = Math.round(
        frameCount / ((timestamp - lastPerformanceAt) / 1000),
      );
      frameCount = 0;
      lastPerformanceAt = timestamp;
      if (effectFps < 30) {
        lowFpsSamples += 1;
        highFpsSamples = 0;
        if (lowFpsSamples >= 2) {
          reducedLoad = true;
        }
      } else if (effectFps >= 48) {
        highFpsSamples += 1;
        lowFpsSamples = 0;
        if (highFpsSamples >= 4) {
          reducedLoad = false;
        }
      } else {
        lowFpsSamples = 0;
        highFpsSamples = 0;
      }
    }

    const deltaSeconds = Math.min(
      0.034,
      Math.max(0.001, (timestamp - lastFrameAt) / 1000 || 0.016),
    );
    lastFrameAt = timestamp;
    context.clearRect(0, 0, width, height);
    const displayCollider = getDisplayCollider();
    const raining = expression === "smile";

    fogStrength +=
      (Number(raining) - fogStrength) *
      Math.min(1, deltaSeconds * (raining ? 1.6 : 0.9));
    if (fogStrength > 0.005) {
      const videoWidth = video.videoWidth || sourceWidth;
      const videoHeight = video.videoHeight || sourceHeight;
      const coverScale = Math.max(
        width / videoWidth,
        height / videoHeight,
      );
      const cropWidth = width / coverScale;
      const cropHeight = height / coverScale;
      const cropX = (videoWidth - cropWidth) / 2;
      const cropY = (videoHeight - cropHeight) / 2;

      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        timestamp - lastFogAt >= (reducedLoad ? 80 : 50)
      ) {
        lastFogAt = timestamp;
        fogContext.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
        fogContext.save();
        fogContext.filter = "blur(12px) saturate(0.82) contrast(0.94)";
        fogContext.translate(fogCanvas.width, 0);
        fogContext.scale(-1, 1);
        fogContext.drawImage(
          video,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          fogCanvas.width,
          fogCanvas.height,
        );
        fogContext.restore();
      }

      context.globalAlpha = fogStrength;
      context.drawImage(fogCanvas, 0, 0, width, height);
      const haze = context.createLinearGradient(0, 0, width, height);
      haze.addColorStop(0, `rgba(246,246,242,${0.12 * fogStrength})`);
      haze.addColorStop(0.5, `rgba(235,235,232,${0.17 * fogStrength})`);
      haze.addColorStop(1, `rgba(250,250,247,${0.1 * fogStrength})`);
      context.globalAlpha = 1;
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);
      clearHeadFromFog();
    }

    const activeWater = waterChannels.filter((channel) => channel.active);
    const waterLimit = reducedLoad ? 3 : MAX_WATER_CHANNELS;
    if (raining && activeWater.length < waterLimit && timestamp >= nextWaterAt) {
      const channel = waterChannels.find((candidate) => !candidate.active);
      if (channel) {
        resetWaterChannel(channel);
      }
      nextWaterAt = timestamp + 500 + Math.random() * 650;
    }

    for (const channel of waterChannels) {
      if (!channel.active) {
        continue;
      }
      channel.travelled += channel.speed * deltaSeconds;
      const x = channelX(channel, channel.travelled);
      const y = channel.startY + channel.travelled;

      if (!channel.merged && channel.radius >= 4.2) {
        const target = waterChannels.find(
          (candidate) =>
            candidate !== channel &&
            candidate.active &&
            candidate.radius < channel.radius &&
            Math.abs(
              channelX(candidate, candidate.travelled) - x,
            ) < 18 &&
            Math.abs(
              candidate.startY + candidate.travelled - y,
            ) < 26,
        );
        if (target) {
          channel.merged = true;
          channel.mergeAt = channel.travelled;
          channel.branchDirection =
            channelX(target, target.travelled) < x ? -1 : 1;
          channel.radius = Math.min(
            7.8,
            channel.radius + target.radius * 0.2,
          );
          channel.speed *= 1.16;
          channel.travelLimit += Math.max(
            18,
            (target.travelLimit - target.travelled) * 0.3,
          );
          target.active = false;
        }
      }

      if (channel.travelled >= channel.travelLimit || y > height + 20) {
        channel.active = false;
        continue;
      }

      const tracePath = () => {
        context.beginPath();
        context.moveTo(channel.startX, channel.startY);
        for (
          let travelled = 10;
          travelled < channel.travelled;
          travelled += 10
        ) {
          context.lineTo(
            channelX(channel, travelled),
            channel.startY + travelled,
          );
        }
        context.lineTo(x, y);
      };

      context.save();
      context.globalCompositeOperation = "destination-out";
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalAlpha = Math.min(1, fogStrength * 1.5);
      context.strokeStyle = "rgba(0,0,0,0.22)";
      context.lineWidth = channel.radius * 2.4;
      tracePath();
      context.stroke();
      context.strokeStyle = "rgba(0,0,0,0.78)";
      context.lineWidth = channel.radius * 0.94;
      tracePath();
      context.stroke();

      if (channel.merged && channel.mergeAt >= 0) {
        const mergeX = channelX(channel, channel.mergeAt);
        const mergeY = channel.startY + channel.mergeAt;
        context.beginPath();
        context.moveTo(
          mergeX + channel.branchDirection * channel.branchLength,
          mergeY - channel.branchLength * 0.46,
        );
        context.quadraticCurveTo(
          mergeX + channel.branchDirection * channel.branchLength * 0.34,
          mergeY - channel.branchLength * 0.14,
          mergeX,
          mergeY,
        );
        context.lineWidth = channel.radius * 0.62;
        context.stroke();
      }
      context.restore();
    }

    if (expression === "laugh" && timestamp >= nextFireworkAt) {
      burst(displayCollider);
      nextFireworkAt =
        timestamp + 500 + Math.random() * (reducedLoad ? 520 : 320);
    } else if (expression !== "laugh") {
      nextFireworkAt = 0;
    }

    for (const spark of sparks) {
      if (!spark.active) {
        continue;
      }
      spark.velocityX *= Math.pow(0.988, deltaSeconds * 60);
      spark.velocityY =
        spark.velocityY * Math.pow(0.99, deltaSeconds * 60) +
        spark.gravity * deltaSeconds;
      spark.x += spark.velocityX * deltaSeconds;
      spark.y += spark.velocityY * deltaSeconds;
      spark.life -= deltaSeconds;
      if (displayCollider) {
        collideWithHead(spark, displayCollider, width, height);
      }
      if (
        spark.life <= 0 ||
        spark.x < -40 ||
        spark.x > width + 40 ||
        spark.y > height + 40
      ) {
        spark.active = false;
        continue;
      }

      const lastX = spark.trailX[spark.trailIndex] ?? spark.x;
      const lastY = spark.trailY[spark.trailIndex] ?? spark.y;
      if (Math.hypot(spark.x - lastX, spark.y - lastY) >= 5) {
        spark.trailIndex = (spark.trailIndex + 1) % TRAIL_POINTS;
        spark.trailX[spark.trailIndex] = spark.x;
        spark.trailY[spark.trailIndex] = spark.y;
        spark.trailCount = Math.min(TRAIL_POINTS, spark.trailCount + 1);
      }
    }

    const hasFireworks =
      expression === "laugh" || sparks.some((spark) => spark.active);
    if (hasFireworks) {
      const backdrop = context.createLinearGradient(
        0,
        0,
        0,
        height * 0.68,
      );
      backdrop.addColorStop(0, "rgba(0,0,0,0.32)");
      backdrop.addColorStop(0.48, "rgba(0,0,0,0.17)");
      backdrop.addColorStop(1, "rgba(0,0,0,0)");
      context.globalCompositeOperation = "source-over";
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height * 0.68);
    }

    context.globalCompositeOperation = "lighter";
    for (const spark of sparks) {
      if (!spark.active) {
        continue;
      }
      const lifeProgress = spark.life / spark.maxLife;
      const oldestIndex =
        (spark.trailIndex - spark.trailCount + 1 + TRAIL_POINTS) %
        TRAIL_POINTS;
      context.fillStyle = spark.color;
      for (
        let order = 0;
        order < spark.trailCount - 1;
        order += 1
      ) {
        const trailIndex = (oldestIndex + order) % TRAIL_POINTS;
        const progress = (order + 1) / spark.trailCount;
        context.globalAlpha =
          Math.min(1, lifeProgress * 2.4) *
          Math.pow(progress, 1.45) *
          0.56;
        context.beginPath();
        context.arc(
          spark.trailX[trailIndex] ?? spark.x,
          spark.trailY[trailIndex] ?? spark.y,
          Math.max(0.8, spark.radius * (0.2 + progress * 0.26)),
          0,
          Math.PI * 2,
        );
        context.fill();
      }

      context.globalAlpha = Math.min(1, lifeProgress * 2.4);
      context.beginPath();
      context.arc(
        spark.x,
        spark.y,
        spark.radius * (0.42 + lifeProgress * 0.58),
        0,
        Math.PI * 2,
      );
      context.fill();
      if (spark.collided) {
        context.fillStyle = "#FFFFFF";
        context.globalAlpha *= 0.55;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius * 1.35, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    drawTracking(displayCollider);
    frameId = requestAnimationFrame(render);
  };

  return {
    destroy: () => {
      running = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      context.clearRect(0, 0, width, height);
    },
    getPerformanceSnapshot: () => ({
      activeParticles:
        sparks.reduce(
          (count, spark) => count + Number(spark.active),
          0,
        ) +
        waterChannels.reduce(
          (count, channel) => count + Number(channel.active),
          0,
        ),
      effectFps,
      reducedLoad,
    }),
    setPaused: (paused) => {
      if (paused) {
        running = false;
        cancelAnimationFrame(frameId);
      } else if (!running) {
        running = true;
        lastFrameAt = performance.now();
        lastPerformanceAt = lastFrameAt;
        frameCount = 0;
        frameId = requestAnimationFrame(render);
      }
    },
    setShowTracking: (show) => {
      showTracking = show;
    },
    setTracking: (
      nextCollider,
      nextLandmarks,
      nextExpression,
      nextSourceWidth,
      nextSourceHeight,
    ) => {
      collider = nextCollider;
      landmarks = nextLandmarks;
      expression = nextExpression;
      sourceWidth = Math.max(1, nextSourceWidth);
      sourceHeight = Math.max(1, nextSourceHeight);
    },
    start: () => {
      if (running) {
        return;
      }
      running = true;
      lastFrameAt = performance.now();
      lastPerformanceAt = lastFrameAt;
      frameCount = 0;
      frameId = requestAnimationFrame(render);
    },
  };
}
