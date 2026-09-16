import type {
  ExpressionState,
  HeadCollider,
} from "./face_tracker";

type Particle = {
  active: boolean;
  collided: boolean;
  color: string;
  gravity: number;
  holdTime: number;
  kind: "rain" | "spark";
  life: number;
  maxDistance: number;
  maxLife: number;
  radius: number;
  sparkSprite: HTMLCanvasElement | null;
  settledTime: number;
  slideSpeed: number;
  startX: number;
  startY: number;
  trailCount: number;
  trailIndex: number;
  trailX: number[];
  trailY: number[];
  travelled: number;
  twinkle: number;
  velocityX: number;
  velocityY: number;
  waterBranchDirection: number;
  waterBranchLength: number;
  waterMergeAt: number;
  waterMerged: boolean;
  x: number;
  y: number;
};

type PendingFireworkBurst = {
  color: string;
  triggerAt: number;
  x: number;
  y: number;
};

export type ParticlePerformanceSnapshot = {
  activeParticles: number;
  effectFps: number;
  reducedLoad: boolean;
};

export type EffectsEngine = {
  destroy: () => void;
  getPerformanceSnapshot: () => ParticlePerformanceSnapshot;
  setPaused: (paused: boolean) => void;
  setShowTracking: (showTracking: boolean) => void;
  setTracking: (
    collider: HeadCollider | null,
    landmarks: ReadonlyArray<{ x: number; y: number }>,
    expression: ExpressionState,
    sourceWidth: number,
    sourceHeight: number,
  ) => void;
  start: () => void;
};

const MAX_PARTICLES = 220;
const FOG_RENDER_INTERVAL_MS = 50;
const FOG_RENDER_SCALE = 0.5;
const FIREWORK_TRAIL_POINT_COUNT = 16;
const FIREWORK_TRAIL_SAMPLE_DISTANCE = 5;
const LAUGH_FIREWORK_MIN_INTERVAL_MS = 480;
const LAUGH_FIREWORK_MAX_INTERVAL_MS = 820;
const FIREWORK_BACKDROP_MAX_OPACITY = 0.32;
const MAX_ACTIVE_RAIN_CHANNELS = 4;
const REDUCED_MAX_ACTIVE_RAIN_CHANNELS = 3;
const PERFORMANCE_SAMPLE_INTERVAL_MS = 500;
const FACE_OVAL_LANDMARK_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397,
  365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58,
  132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const FIREWORK_COLD_WHITE = "#F3F8FF";
const FIREWORK_WARM_ACCENT = "#FFD58A";

type FireworkShape = "dot" | "flower" | "star";

function rotatePoint(
  x: number,
  y: number,
  angle: number,
): { x: number; y: number } {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
}

function resolveEllipseCollision(
  particle: Particle,
  collider: HeadCollider,
  width: number,
  height: number,
): boolean {
  const centerX = collider.centerX * width;
  const centerY = collider.centerY * height;
  const radiusX = Math.max(18, collider.radiusX * width);
  const radiusY = Math.max(24, collider.radiusY * height);
  const local = rotatePoint(
    particle.x - centerX,
    particle.y - centerY,
    -collider.rotation,
  );
  const normalizedDistance =
    (local.x * local.x) / (radiusX * radiusX) +
    (local.y * local.y) / (radiusY * radiusY);

  if (normalizedDistance >= 1) {
    return false;
  }

  const gradientX = local.x / (radiusX * radiusX);
  const gradientY = local.y / (radiusY * radiusY);
  const gradientLength = Math.hypot(gradientX, gradientY) || 1;
  const localNormal = {
    x: gradientX / gradientLength,
    y: gradientY / gradientLength,
  };
  const normal = rotatePoint(
    localNormal.x,
    localNormal.y,
    collider.rotation,
  );
  const velocityAlongNormal =
    particle.velocityX * normal.x + particle.velocityY * normal.y;

  particle.velocityX -= 1.62 * velocityAlongNormal * normal.x;
  particle.velocityY -= 1.62 * velocityAlongNormal * normal.y;

  const scale = 1 / Math.sqrt(Math.max(normalizedDistance, 0.001));
  const corrected = rotatePoint(
    local.x * scale,
    local.y * scale,
    collider.rotation,
  );
  particle.x = centerX + corrected.x;
  particle.y = centerY + corrected.y;
  const sideDirection =
    particle.x < centerX ? -1 : particle.x > centerX ? 1 : normal.x;
  particle.velocityX += normal.x * 150 + sideDirection * 92;
  particle.velocityY += normal.y * 120;
  particle.collided = true;
  return true;
}

function deactivateParticle(particle: Particle) {
  particle.active = false;
  particle.life = 0;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomFireworkShape(): FireworkShape {
  const seed = Math.random();
  if (seed < 0.68) {
    return "dot";
  }
  return seed < 0.86 ? "flower" : "star";
}

function resetRainParticle(particle: Particle, width: number, height: number) {
  const sizeSeed = Math.random();
  const radius =
    sizeSeed < 0.56
      ? 2 + Math.random() * 2.4
      : sizeSeed < 0.9
        ? 4.4 + Math.random() * 3
        : 6.4 + Math.random() * 2;
  const travelSeed = Math.random();

  particle.active = true;
  particle.collided = false;
  particle.color = "rgba(255,255,255,0.5)";
  particle.holdTime = 0.08 + Math.random() * 0.75;
  particle.kind = "rain";
  particle.life = 14 + Math.random() * 10;
  particle.maxDistance =
    travelSeed < 0.58
      ? 28 + Math.random() * 86
      : travelSeed < 0.9
        ? 112 + Math.random() * height * 0.28
        : 220 + Math.random() * height * 0.5;
  particle.maxLife = particle.life;
  particle.radius = radius;
  particle.sparkSprite = null;
  particle.settledTime = 2.4 + Math.random() * 4.2;
  particle.slideSpeed = 38 + radius * (5.4 + Math.random() * 3.2);
  particle.startX = 24 + Math.random() * Math.max(1, width - 48);
  particle.startY = 12 + Math.random() * height * 0.58;
  particle.trailCount = 0;
  particle.trailIndex = 0;
  particle.travelled = 0;
  particle.twinkle = Math.random() * Math.PI * 2;
  particle.velocityX = 3 + Math.random() * 16;
  particle.velocityY = 0;
  particle.waterBranchDirection = Math.random() < 0.5 ? -1 : 1;
  particle.waterBranchLength = 18 + Math.random() * 28;
  particle.waterMergeAt = -1;
  particle.waterMerged = false;
  particle.x = particle.startX;
  particle.y = particle.startY;
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
    throw new Error("Canvas 2D is unavailable");
  }
  const fogCanvas = document.createElement("canvas");
  const fogContext = fogCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });
  if (!fogContext) {
    throw new Error("Fog canvas 2D is unavailable");
  }
  const wetGlassTexture = document.createElement("canvas");
  const wetGlassContext = wetGlassTexture.getContext("2d", {
    alpha: true,
  });
  if (!wetGlassContext) {
    throw new Error("Wet glass texture canvas 2D is unavailable");
  }
  const fireworkSprites = new Map<string, HTMLCanvasElement>();

  const traceFireworkShape = (
    spriteContext: CanvasRenderingContext2D,
    shape: FireworkShape,
    center: number,
    radius: number,
  ) => {
    spriteContext.beginPath();
    if (shape === "dot") {
      spriteContext.arc(center, center, radius, 0, Math.PI * 2);
      return;
    }
    if (shape === "flower") {
      const petalRadius = radius * 0.58;
      spriteContext.arc(
        center,
        center - radius * 0.48,
        petalRadius,
        0,
        Math.PI * 2,
      );
      spriteContext.arc(
        center + radius * 0.48,
        center,
        petalRadius,
        0,
        Math.PI * 2,
      );
      spriteContext.arc(
        center,
        center + radius * 0.48,
        petalRadius,
        0,
        Math.PI * 2,
      );
      spriteContext.arc(
        center - radius * 0.48,
        center,
        petalRadius,
        0,
        Math.PI * 2,
      );
      return;
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 4;
      const pointRadius = index % 2 === 0 ? radius : radius * 0.24;
      const x = center + Math.cos(angle) * pointRadius;
      const y = center + Math.sin(angle) * pointRadius;
      if (index === 0) {
        spriteContext.moveTo(x, y);
      } else {
        spriteContext.lineTo(x, y);
      }
    }
    spriteContext.closePath();
  };

  const getFireworkSprite = (
    color: string,
    shape: FireworkShape,
    sizeTier: number,
  ) => {
    const key = `${color}-${shape}-${sizeTier}`;
    const existingSprite = fireworkSprites.get(key);
    if (existingSprite) {
      return existingSprite;
    }

    const radius = 2.4 + sizeTier * 1.35;
    const spriteSize = Math.ceil(radius * 6);
    const center = spriteSize / 2;
    const sprite = document.createElement("canvas");
    sprite.width = spriteSize;
    sprite.height = spriteSize;
    const spriteContext = sprite.getContext("2d", { alpha: true });
    if (!spriteContext) {
      throw new Error("Firework sprite canvas 2D is unavailable");
    }

    spriteContext.fillStyle = color;
    spriteContext.globalAlpha = 0.14;
    traceFireworkShape(spriteContext, shape, center, radius * 1.9);
    spriteContext.fill();
    spriteContext.globalAlpha = 0.42;
    traceFireworkShape(spriteContext, shape, center, radius * 1.28);
    spriteContext.fill();
    spriteContext.globalAlpha = 1;
    traceFireworkShape(spriteContext, shape, center, radius);
    spriteContext.fill();
    spriteContext.fillStyle = "#FFFFFF";
    spriteContext.globalAlpha = 0.8;
    traceFireworkShape(spriteContext, shape, center, radius * 0.42);
    spriteContext.fill();
    fireworkSprites.set(key, sprite);
    return sprite;
  };

  const particles: Particle[] = Array.from(
    { length: MAX_PARTICLES },
    () => ({
      active: false,
      collided: false,
      color: "#FFFFFF",
      gravity: 310,
      holdTime: 0,
      kind: "rain",
      life: 0,
      maxDistance: 0,
      maxLife: 1,
      radius: 4,
      sparkSprite: null,
      settledTime: 0,
      slideSpeed: 0,
      startX: 0,
      startY: 0,
      trailCount: 0,
      trailIndex: 0,
      trailX: Array(FIREWORK_TRAIL_POINT_COUNT).fill(0),
      trailY: Array(FIREWORK_TRAIL_POINT_COUNT).fill(0),
      travelled: 0,
      twinkle: 0,
      velocityX: 0,
      velocityY: 0,
      waterBranchDirection: 1,
      waterBranchLength: 0,
      waterMergeAt: -1,
      waterMerged: false,
      x: 0,
      y: 0,
    }),
  );
  let collider: HeadCollider | null = null;
  let expression: ExpressionState = "neutral";
  let frameId = 0;
  let height = 1;
  let landmarks: ReadonlyArray<{ x: number; y: number }> = [];
  let effectFrameCount = 0;
  let effectFps = 0;
  let lastFogRenderedAt = 0;
  let lastPerformanceSampleAt = 0;
  let lastTimestamp = 0;
  let highFpsSampleCount = 0;
  let lowFpsSampleCount = 0;
  let nextLaughFireworkAt = 0;
  const pendingFireworkBursts: PendingFireworkBurst[] = [];
  let rainAccumulator = 0;
  let reducedLoad = false;
  let resizeObserver: ResizeObserver | null = null;
  let running = false;
  let showTracking = false;
  let wasRaining = false;
  let sourceHeight = 1;
  let sourceWidth = 1;
  let width = 1;
  let fogStrength = 0;
  let fireworkBackdropStrength = 0;

  const mapPoint = (point: { x: number; y: number }) => {
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const cropX = (renderedWidth - width) / 2;
    const cropY = (renderedHeight - height) / 2;
    const displayX = point.x * sourceWidth * scale - cropX;
    const displayY = point.y * sourceHeight * scale - cropY;

    return {
      x: width - displayX,
      y: displayY,
    };
  };

  const getDisplayCollider = (): HeadCollider | null => {
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

  const getFaceOvalPoints = () => {
    const points: Array<{ x: number; y: number }> = [];
    for (const index of FACE_OVAL_LANDMARK_INDICES) {
      const landmark = landmarks[index];
      if (!landmark) {
        return [];
      }
      points.push(mapPoint(landmark));
    }
    return points;
  };

  const traceSmoothClosedPath = (
    points: ReadonlyArray<{ x: number; y: number }>,
  ) => {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) {
      return;
    }

    context.beginPath();
    context.moveTo(
      (last.x + first.x) / 2,
      (last.y + first.y) / 2,
    );
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const nextPoint = points[(index + 1) % points.length];
      if (!point || !nextPoint) {
        continue;
      }
      context.quadraticCurveTo(
        point.x,
        point.y,
        (point.x + nextPoint.x) / 2,
        (point.y + nextPoint.y) / 2,
      );
    }
    context.closePath();
  };

  const clearHeadFromFog = () => {
    const faceOval = getFaceOvalPoints();
    if (faceOval.length < FACE_OVAL_LANDMARK_INDICES.length) {
      return;
    }

    const minY = Math.min(...faceOval.map((point) => point.y));
    const maxY = Math.max(...faceOval.map((point) => point.y));
    const faceHeight = maxY - minY;
    const center = faceOval.reduce(
      (sum, point) => ({
        x: sum.x + point.x / faceOval.length,
        y: sum.y + point.y / faceOval.length,
      }),
      { x: 0, y: 0 },
    );
    const headOutline = faceOval.map((point) => {
      const upperProgress = Math.max(
        0,
        1 - (point.y - minY) / Math.max(1, faceHeight * 0.46),
      );
      const upperInfluence = Math.pow(upperProgress, 1.45);
      return {
        x:
          center.x +
          (point.x - center.x) *
            (1 + upperInfluence * 0.11),
        y: point.y - faceHeight * 0.34 * upperInfluence,
      };
    });
    const featheredOutline = headOutline.map((point) => ({
      x: center.x + (point.x - center.x) * 1.1,
      y:
        center.y +
        (point.y - center.y) * 1.08 -
        faceHeight * 0.015,
    }));

    context.save();
    context.globalCompositeOperation = "destination-out";
    context.filter = "blur(22px)";
    context.fillStyle = `rgba(0,0,0,${0.84 * fogStrength})`;
    traceSmoothClosedPath(featheredOutline);
    context.fill();
    context.filter = "none";
    context.fillStyle = "rgba(0,0,0,1)";
    traceSmoothClosedPath(headOutline);
    context.fill();
    context.restore();
  };

  const renderWetGlassTexture = () => {
    const textureWidth = wetGlassTexture.width;
    const textureHeight = wetGlassTexture.height;
    const random = createSeededRandom(
      Math.round(textureWidth * 31 + textureHeight * 17),
    );

    wetGlassContext.clearRect(0, 0, textureWidth, textureHeight);

    wetGlassContext.save();
    wetGlassContext.filter = "blur(18px)";
    for (let index = 0; index < 18; index += 1) {
      const x = random() * textureWidth;
      const y = random() * textureHeight;
      const radiusX = 32 + random() * 90;
      const radiusY = 24 + random() * 74;
      const patch = wetGlassContext.createRadialGradient(
        x,
        y,
        0,
        x,
        y,
        Math.max(radiusX, radiusY),
      );
      patch.addColorStop(0, "rgba(255,255,255,0.12)");
      patch.addColorStop(0.55, "rgba(255,255,255,0.045)");
      patch.addColorStop(1, "rgba(255,255,255,0)");
      wetGlassContext.fillStyle = patch;
      wetGlassContext.beginPath();
      wetGlassContext.ellipse(
        x,
        y,
        radiusX,
        radiusY,
        random() * Math.PI,
        0,
        Math.PI * 2,
      );
      wetGlassContext.fill();
    }
    wetGlassContext.restore();

    const dropletCount = Math.round(
      Math.min(150, (textureWidth * textureHeight) / 2100),
    );
    for (let index = 0; index < dropletCount; index += 1) {
      const x = random() * textureWidth;
      const y = random() * textureHeight;
      const sizeSeed = random();
      const radius =
        sizeSeed < 0.78
          ? 0.45 + random() * 1.15
          : sizeSeed < 0.96
            ? 1.7 + random() * 2.2
            : 4.2 + random() * 3.8;
      const stretch = 1 + random() * Math.min(1.1, radius * 0.14);

      const shadow = wetGlassContext.createRadialGradient(
        x + radius * 0.25,
        y + radius * 0.4,
        radius * 0.15,
        x,
        y,
        radius * 1.25,
      );
      shadow.addColorStop(0, "rgba(0,0,0,0)");
      shadow.addColorStop(0.72, "rgba(0,0,0,0.025)");
      shadow.addColorStop(1, "rgba(0,0,0,0.13)");
      wetGlassContext.fillStyle = shadow;
      wetGlassContext.beginPath();
      wetGlassContext.ellipse(
        x,
        y,
        radius,
        radius * stretch,
        0,
        0,
        Math.PI * 2,
      );
      wetGlassContext.fill();

      const highlight = wetGlassContext.createRadialGradient(
        x - radius * 0.32,
        y - radius * 0.42,
        0,
        x,
        y,
        radius,
      );
      highlight.addColorStop(0, "rgba(255,255,255,0.72)");
      highlight.addColorStop(0.26, "rgba(255,255,255,0.2)");
      highlight.addColorStop(1, "rgba(255,255,255,0)");
      wetGlassContext.fillStyle = highlight;
      wetGlassContext.beginPath();
      wetGlassContext.ellipse(
        x,
        y,
        radius,
        radius * stretch,
        0,
        0,
        Math.PI * 2,
      );
      wetGlassContext.fill();
    }
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, bounds.width);
    const nextHeight = Math.max(1, bounds.height);
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.round(nextWidth * devicePixelRatio);
    canvas.height = Math.round(nextHeight * devicePixelRatio);
    fogCanvas.width = Math.max(
      1,
      Math.round(nextWidth * FOG_RENDER_SCALE),
    );
    fogCanvas.height = Math.max(
      1,
      Math.round(nextHeight * FOG_RENDER_SCALE),
    );
    wetGlassTexture.width = Math.max(1, Math.round(nextWidth));
    wetGlassTexture.height = Math.max(1, Math.round(nextHeight));
    renderWetGlassTexture();
    context.setTransform(
      devicePixelRatio,
      0,
      0,
      devicePixelRatio,
      0,
      0,
    );
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
    context.strokeStyle =
      expression === "laugh"
        ? "#FFED28"
        : expression === "smile"
          ? "#25F4EE"
          : "rgba(255,255,255,0.9)";
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

    context.fillStyle = "rgba(37,244,238,0.7)";
    const stride = Math.max(1, Math.floor(landmarks.length / 72));
    for (let index = 0; index < landmarks.length; index += stride) {
      const landmark = landmarks[index];
      if (!landmark) {
        continue;
      }
      const displayPoint = mapPoint(landmark);
      context.beginPath();
      context.arc(
        displayPoint.x,
        displayPoint.y,
        1.4,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  };

  const takeParticle = () =>
    particles.find((particle) => !particle.active) ?? null;

  const getActiveRainParticles = () =>
    particles.filter(
      (particle) =>
        particle.active &&
        particle.kind === "rain" &&
        particle.travelled < particle.maxDistance,
    );

  const resetFireworkTrail = (particle: Particle) => {
    particle.trailCount = 1;
    particle.trailIndex = 0;
    particle.trailX[0] = particle.x;
    particle.trailY[0] = particle.y;
  };

  const appendFireworkTrail = (particle: Particle) => {
    const lastX = particle.trailX[particle.trailIndex] ?? particle.x;
    const lastY = particle.trailY[particle.trailIndex] ?? particle.y;
    if (
      Math.hypot(particle.x - lastX, particle.y - lastY) <
      FIREWORK_TRAIL_SAMPLE_DISTANCE
    ) {
      return;
    }

    particle.trailIndex =
      (particle.trailIndex + 1) % FIREWORK_TRAIL_POINT_COUNT;
    particle.trailX[particle.trailIndex] = particle.x;
    particle.trailY[particle.trailIndex] = particle.y;
    particle.trailCount = Math.min(
      FIREWORK_TRAIL_POINT_COUNT,
      particle.trailCount + 1,
    );
  };

  const emitRain = () => {
    const maxRainChannels = reducedLoad
      ? REDUCED_MAX_ACTIVE_RAIN_CHANNELS
      : MAX_ACTIVE_RAIN_CHANNELS;
    if (getActiveRainParticles().length >= maxRainChannels) {
      return;
    }
    const particle = takeParticle();
    if (particle) {
      resetRainParticle(particle, width, height);
      const mergeCandidate = particles.find(
        (candidate) =>
          candidate !== particle &&
          candidate.active &&
          candidate.kind === "rain" &&
          candidate.radius < particle.radius &&
          candidate.travelled < candidate.maxDistance,
      );
      if (mergeCandidate && particle.radius >= 4.4) {
        particle.startX =
          mergeCandidate.x + (Math.random() - 0.5) * 18;
        particle.startY = Math.max(
          12,
          mergeCandidate.y - 38 - Math.random() * 28,
        );
        particle.x = particle.startX;
        particle.y = particle.startY;
        particle.velocityX =
          (mergeCandidate.x - particle.startX) * 0.28;
        particle.slideSpeed *= 1.12;
      }
    }
  };

  const emitSpark = (
    x: number,
    y: number,
    angle: number,
    speed: number,
    color: string,
    gravity: number,
    life: number,
    radius: number,
  ) => {
    const particle = takeParticle();
    if (!particle) {
      return;
    }

    particle.active = true;
    particle.collided = false;
    particle.color =
      Math.random() < 0.08 ? FIREWORK_WARM_ACCENT : color;
    particle.gravity = gravity;
    particle.kind = "spark";
    particle.life = life;
    particle.maxLife = life;
    particle.radius = radius;
    const sizeTier = radius >= 3.6 ? 2 : radius >= 2.5 ? 1 : 0;
    particle.sparkSprite = getFireworkSprite(
      particle.color,
      randomFireworkShape(),
      sizeTier,
    );
    particle.twinkle = Math.random() * Math.PI * 2;
    particle.velocityX = Math.cos(angle) * speed;
    particle.velocityY = Math.sin(angle) * speed;
    particle.x = x;
    particle.y = y;
    resetFireworkTrail(particle);
  };

  const emitFireworkBurst = (
    centerX: number,
    centerY: number,
    color: string,
    coreSparkCount: number,
    fallingSparkCount: number,
  ) => {
    for (let index = 0; index < coreSparkCount; index += 1) {
      const angle =
        (index / coreSparkCount) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.42;
      const speed = 88 + Math.random() * 72;
      emitSpark(
        centerX,
        centerY,
        angle,
        speed,
        color,
        105 + Math.random() * 70,
        2 + Math.random() * 0.6,
        2.2 + Math.random() * 2,
      );
    }

    for (let index = 0; index < fallingSparkCount; index += 1) {
      const angle =
        (index / fallingSparkCount) * Math.PI * 2 +
        (Math.random() - 0.5) * 0.34;
      const speed = 148 + Math.random() * 96;
      emitSpark(
        centerX,
        centerY,
        angle,
        speed,
        color,
        220 + Math.random() * 65,
        1.8 + Math.random() * 0.6,
        1.6 + Math.random() * 1.6,
      );
    }
  };

  const emitPendingFireworkBursts = (timestamp: number) => {
    while (
      pendingFireworkBursts[0] &&
      pendingFireworkBursts[0].triggerAt <= timestamp
    ) {
      const burst = pendingFireworkBursts.shift();
      if (!burst) {
        continue;
      }
      emitFireworkBurst(
        burst.x,
        burst.y,
        burst.color,
        8 + Math.floor(Math.random() * 5),
        3 + Math.floor(Math.random() * 2),
      );
    }
  };

  const emitLaughFirework = (
    timestamp: number,
    displayCollider: HeadCollider | null,
  ) => {
    if (expression !== "laugh") {
      nextLaughFireworkAt = 0;
      return;
    }
    if (nextLaughFireworkAt > timestamp) {
      return;
    }

    const headCenterX = displayCollider
      ? displayCollider.centerX * width
      : width * 0.5;
    const headTop = displayCollider
      ? (displayCollider.centerY - displayCollider.radiusY) * height
      : height * 0.48;
    const burstY = Math.min(
      height * 0.18,
      Math.max(72, headTop - height * 0.3),
    );
    emitFireworkBurst(
      Math.min(
        width - 42,
        Math.max(
          42,
          headCenterX + (Math.random() - 0.5) * width * 0.72,
        ),
      ),
      burstY + height * (0.015 + Math.random() * 0.105),
      FIREWORK_COLD_WHITE,
      (reducedLoad ? 6 : 8) + Math.floor(Math.random() * 4),
      (reducedLoad ? 2 : 3) + Math.floor(Math.random() * 2),
    );
    nextLaughFireworkAt =
      timestamp +
      LAUGH_FIREWORK_MIN_INTERVAL_MS +
      Math.random() *
        (LAUGH_FIREWORK_MAX_INTERVAL_MS -
          LAUGH_FIREWORK_MIN_INTERVAL_MS);
  };

  const render = (timestamp: number) => {
    if (!running) {
      return;
    }

    effectFrameCount += 1;
    if (lastPerformanceSampleAt === 0) {
      lastPerformanceSampleAt = timestamp;
    } else if (
      timestamp - lastPerformanceSampleAt >=
      PERFORMANCE_SAMPLE_INTERVAL_MS
    ) {
      const sampleSeconds =
        (timestamp - lastPerformanceSampleAt) / 1000;
      effectFps = Math.round(effectFrameCount / sampleSeconds);
      effectFrameCount = 0;
      lastPerformanceSampleAt = timestamp;
      if (effectFps < 30) {
        lowFpsSampleCount += 1;
        highFpsSampleCount = 0;
        if (lowFpsSampleCount >= 2) {
          reducedLoad = true;
        }
      } else if (effectFps >= 48) {
        highFpsSampleCount += 1;
        lowFpsSampleCount = 0;
        if (highFpsSampleCount >= 4) {
          reducedLoad = false;
        }
      } else {
        lowFpsSampleCount = 0;
        highFpsSampleCount = 0;
      }
    }

    const deltaSeconds = Math.min(
      0.034,
      Math.max(0.001, (timestamp - lastTimestamp) / 1000 || 0.016),
    );
    lastTimestamp = timestamp;
    context.clearRect(0, 0, width, height);
    const displayCollider = getDisplayCollider();
    emitPendingFireworkBursts(timestamp);
    emitLaughFirework(timestamp, displayCollider);
    const shouldRain = expression === "smile";

    if (shouldRain && !wasRaining) {
      for (
        let index = 0;
        index < MAX_ACTIVE_RAIN_CHANNELS;
        index += 1
      ) {
        const particle = takeParticle();
        if (!particle) {
          break;
        }
        resetRainParticle(particle, width, height);
        particle.holdTime = 0;
        particle.travelled = Math.min(
          particle.maxDistance,
          34 + Math.random() * 120,
        );
        particle.y = particle.startY + particle.travelled;
      }
    }
    wasRaining = shouldRain;

    const fogTarget = shouldRain ? 1 : 0;
    fogStrength +=
      (fogTarget - fogStrength) *
      Math.min(1, deltaSeconds * (fogTarget ? 1.6 : 0.9));

    if (fogStrength > 0.005) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
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
          timestamp - lastFogRenderedAt >=
          FOG_RENDER_INTERVAL_MS * (reducedLoad ? 1.6 : 1)
        ) {
          lastFogRenderedAt = timestamp;
          fogContext.clearRect(
            0,
            0,
            fogCanvas.width,
            fogCanvas.height,
          );
          fogContext.save();
          fogContext.filter =
            "blur(12px) saturate(0.82) contrast(0.94)";
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
        context.drawImage(
          fogCanvas,
          0,
          0,
          width,
          height,
        );
        context.globalAlpha = 1;
      }

      const fogGradient = context.createLinearGradient(0, 0, width, height);
      fogGradient.addColorStop(
        0,
        `rgba(246,246,242,${0.13 * fogStrength})`,
      );
      fogGradient.addColorStop(
        0.48,
        `rgba(235,235,232,${0.18 * fogStrength})`,
      );
      fogGradient.addColorStop(
        1,
        `rgba(250,250,247,${0.11 * fogStrength})`,
      );
      context.fillStyle = fogGradient;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.68 * fogStrength;
      context.drawImage(wetGlassTexture, 0, 0, width, height);
      context.globalAlpha = 1;

      clearHeadFromFog();
    }

    if (shouldRain) {
      rainAccumulator += deltaSeconds * 1.5;
      while (rainAccumulator >= 1) {
        emitRain();
        rainAccumulator -= 1;
      }
    } else {
      rainAccumulator = 0;
    }

    for (const particle of particles) {
      if (!particle.active) {
        continue;
      }

      if (particle.kind === "rain") {
        particle.life -= deltaSeconds;
        const age = 1 - particle.life / particle.maxLife;
        if (particle.travelled < particle.maxDistance) {
          if (particle.holdTime > 0) {
            particle.holdTime -= deltaSeconds;
          } else {
            const slipPulse =
              0.52 +
              Math.max(
                0,
                Math.sin(age * Math.PI * 9 + particle.twinkle),
              ) *
                1.3;
            const travelDelta =
              particle.slideSpeed * slipPulse * deltaSeconds;
            particle.travelled = Math.min(
              particle.maxDistance,
              particle.travelled + travelDelta,
            );
            particle.y = particle.startY + particle.travelled;
            if (
              particle.travelled < particle.maxDistance &&
              Math.random() < deltaSeconds * 0.46
            ) {
              particle.holdTime = 0.08 + Math.random() * 0.52;
            }
          }
        } else {
          particle.settledTime -= deltaSeconds;
        }
        const pathXAt = (travelled: number) => {
          const bendStrength = Math.min(1, travelled / 72);
          return (
            particle.startX +
            (Math.sin(travelled * 0.018 + particle.twinkle) * 0.72 +
              Math.sin(
                travelled * 0.007 + particle.twinkle * 1.6,
              ) *
                0.28) *
              particle.velocityX *
              bendStrength
          );
        };
        particle.x = pathXAt(particle.travelled);
        if (
          !particle.waterMerged &&
          particle.radius >= 4.4 &&
          particle.travelled > 24
        ) {
          const mergeTarget = particles.find(
            (candidate) =>
              candidate !== particle &&
              candidate.active &&
              candidate.kind === "rain" &&
              candidate.radius < particle.radius &&
              candidate.travelled < candidate.maxDistance &&
              Math.abs(candidate.x - particle.x) <
                particle.radius + candidate.radius + 10 &&
              Math.abs(candidate.y - particle.y) < 24,
          );
          if (mergeTarget) {
            particle.waterMerged = true;
            particle.waterMergeAt = particle.travelled;
            particle.waterBranchDirection =
              mergeTarget.x < particle.x ? -1 : 1;
            particle.waterBranchLength = Math.min(
              42,
              16 +
                Math.abs(mergeTarget.x - particle.x) +
                mergeTarget.radius * 1.6,
            );
            particle.radius = Math.min(
              8.4,
              particle.radius + mergeTarget.radius * 0.22,
            );
            particle.slideSpeed *= 1.16;
            particle.maxDistance = Math.min(
              height * 0.82,
              particle.maxDistance +
                Math.max(
                  18,
                  (mergeTarget.maxDistance - mergeTarget.travelled) *
                    0.32,
                ),
            );
            deactivateParticle(mergeTarget);
          }
        }
        if (
          particle.life <= 0 ||
          particle.settledTime <= 0 ||
          particle.y > height + 24
        ) {
          deactivateParticle(particle);
          continue;
        }

        const settleFade =
          particle.travelled >= particle.maxDistance
            ? Math.min(1, particle.settledTime)
            : 1;
        const traceWaterPath = () => {
          const segmentLength = 10;
          const points = [
            {
              x: particle.startX,
              y: particle.startY,
            },
          ];
          for (
            let travelled = segmentLength;
            travelled < particle.travelled;
            travelled += segmentLength
          ) {
            points.push({
              x: pathXAt(travelled),
              y: particle.startY + travelled,
            });
          }
          points.push({
            x: particle.x,
            y: particle.y,
          });

          const firstPoint = points[0];
          if (!firstPoint) {
            return;
          }
          context.beginPath();
          context.moveTo(firstPoint.x, firstPoint.y);
          for (
            let index = 1;
            index < points.length - 1;
            index += 1
          ) {
            const point = points[index];
            const nextPoint = points[index + 1];
            if (!point || !nextPoint) {
              continue;
            }
            context.quadraticCurveTo(
              point.x,
              point.y,
              (point.x + nextPoint.x) / 2,
              (point.y + nextPoint.y) / 2,
            );
          }
          context.lineTo(particle.x, particle.y);
        };
        const traceWaterBranch = () => {
          if (!particle.waterMerged || particle.waterMergeAt < 0) {
            return false;
          }
          const mergeX = pathXAt(particle.waterMergeAt);
          const mergeY = particle.startY + particle.waterMergeAt;
          const branchEndX =
            mergeX +
            particle.waterBranchDirection *
              particle.waterBranchLength;
          const branchEndY =
            mergeY - particle.waterBranchLength * 0.48;
          context.beginPath();
          context.moveTo(branchEndX, branchEndY);
          context.quadraticCurveTo(
            mergeX +
              particle.waterBranchDirection *
                particle.waterBranchLength *
                0.36,
            mergeY - particle.waterBranchLength * 0.16,
            mergeX,
            mergeY,
          );
          return true;
        };
        context.save();
        context.globalCompositeOperation = "destination-out";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.globalAlpha = Math.min(
          1,
          fogStrength * 1.5 * settleFade,
        );

        context.strokeStyle = "rgba(0,0,0,0.22)";
        context.lineWidth = particle.radius * 2.55;
        traceWaterPath();
        context.stroke();
        if (traceWaterBranch()) {
          context.lineWidth = particle.radius * 1.35;
          context.stroke();
        }

        context.strokeStyle = "rgba(0,0,0,0.78)";
        context.lineWidth =
          particle.radius *
          (0.68 +
            0.5 *
              (particle.travelled /
                Math.max(1, particle.maxDistance)));
        traceWaterPath();
        context.stroke();
        if (traceWaterBranch()) {
          context.lineWidth = particle.radius * 0.62;
          context.stroke();
        }

        context.restore();
        continue;
      }

      particle.velocityX *= Math.pow(0.988, deltaSeconds * 60);
      particle.velocityY =
        particle.velocityY * Math.pow(0.99, deltaSeconds * 60) +
        particle.gravity * deltaSeconds;
      particle.x += particle.velocityX * deltaSeconds;
      particle.y += particle.velocityY * deltaSeconds;
      particle.life -= deltaSeconds;
      if (displayCollider) {
        const collisionHit = resolveEllipseCollision(
          particle,
          displayCollider,
          width,
          height,
        );
        if (collisionHit) {
          resetFireworkTrail(particle);
        }
      }
      if (particle.life <= 0) {
        deactivateParticle(particle);
        continue;
      }
      appendFireworkTrail(particle);
    }

    const hasActiveFirework =
      expression === "laugh" ||
      pendingFireworkBursts.length > 0 ||
      particles.some(
        (particle) => particle.active && particle.kind === "spark",
      );
    const backdropTarget = hasActiveFirework ? 1 : 0;
    fireworkBackdropStrength +=
      (backdropTarget - fireworkBackdropStrength) *
      Math.min(1, deltaSeconds * (backdropTarget ? 7.5 : 4));
    if (fireworkBackdropStrength > 0.005) {
      const fireworkBackdrop = context.createLinearGradient(
        0,
        0,
        0,
        height * 0.68,
      );
      fireworkBackdrop.addColorStop(
        0,
        `rgba(0,0,0,${
          FIREWORK_BACKDROP_MAX_OPACITY * fireworkBackdropStrength
        })`,
      );
      fireworkBackdrop.addColorStop(
        0.48,
        `rgba(0,0,0,${0.17 * fireworkBackdropStrength})`,
      );
      fireworkBackdrop.addColorStop(1, "rgba(0,0,0,0)");
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.fillStyle = fireworkBackdrop;
      context.fillRect(0, 0, width, height * 0.68);
    }

    context.globalAlpha = 1;
    context.save();
    context.globalCompositeOperation = "source-over";
    for (const particle of particles) {
      if (
        !particle.active ||
        particle.kind !== "spark" ||
        particle.trailCount < 2
      ) {
        continue;
      }
      const lifeProgress = particle.life / particle.maxLife;
      const lifeAlpha = Math.min(1, lifeProgress * 2.4);
      const oldestIndex =
        (particle.trailIndex -
          particle.trailCount +
          1 +
          FIREWORK_TRAIL_POINT_COUNT) %
        FIREWORK_TRAIL_POINT_COUNT;
      context.fillStyle = particle.color;
      for (
        let trailOrder = 0;
        trailOrder < particle.trailCount - 1;
        trailOrder += 1
      ) {
        const trailIndex =
          (oldestIndex + trailOrder) % FIREWORK_TRAIL_POINT_COUNT;
        const trailProgress =
          (trailOrder + 1) / particle.trailCount;
        context.globalAlpha =
          lifeAlpha * Math.pow(trailProgress, 1.45) * 0.56;
        context.beginPath();
        context.arc(
          particle.trailX[trailIndex] ?? particle.x,
          particle.trailY[trailIndex] ?? particle.y,
          Math.max(
            0.85,
            particle.radius * (0.2 + trailProgress * 0.26),
          ),
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
    context.restore();
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const particle of particles) {
      if (
        !particle.active ||
        particle.kind !== "spark" ||
        !particle.sparkSprite
      ) {
        continue;
      }
      const lifeProgress = particle.life / particle.maxLife;
      const sparkScale = 0.22 + lifeProgress * 0.78;
      const breathe =
        0.9 +
        Math.sin(timestamp * 0.012 + particle.twinkle) * 0.1;
      const headScale = (0.62 + sparkScale * 0.38) * breathe;
      const spriteWidth =
        particle.sparkSprite.width * headScale;
      const spriteHeight =
        particle.sparkSprite.height * headScale;
      context.globalAlpha =
        Math.min(1, lifeProgress * 2.4) *
        (particle.collided ? 1 : 0.92);
      context.drawImage(
        particle.sparkSprite,
        particle.x - spriteWidth / 2,
        particle.y - spriteHeight / 2,
        spriteWidth,
        spriteHeight,
      );
    }
    context.restore();
    drawTracking(displayCollider);
    frameId = window.requestAnimationFrame(render);
  };

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  return {
    destroy: () => {
      running = false;
      window.cancelAnimationFrame(frameId);
      pendingFireworkBursts.length = 0;
      nextLaughFireworkAt = 0;
      resizeObserver?.disconnect();
      context.clearRect(0, 0, width, height);
    },
    getPerformanceSnapshot: () => ({
      activeParticles: particles.reduce(
        (count, particle) => count + Number(particle.active),
        0,
      ),
      effectFps,
      reducedLoad,
    }),
    setPaused: (paused) => {
      if (paused) {
        running = false;
        window.cancelAnimationFrame(frameId);
        return;
      }
      if (!running) {
        running = true;
        lastTimestamp = performance.now();
        lastPerformanceSampleAt = lastTimestamp;
        effectFrameCount = 0;
        frameId = window.requestAnimationFrame(render);
      }
    },
    setShowTracking: (nextShowTracking) => {
      showTracking = nextShowTracking;
    },
    setTracking: (
      nextCollider,
      nextLandmarks,
      nextExpression,
      nextSourceWidth,
      nextSourceHeight,
    ) => {
      collider = nextCollider;
      if (expression !== "laugh" && nextExpression === "laugh") {
        nextLaughFireworkAt = performance.now();
      } else if (nextExpression !== "laugh") {
        nextLaughFireworkAt = 0;
      }
      expression = nextExpression;
      landmarks = nextLandmarks;
      sourceWidth = Math.max(1, nextSourceWidth);
      sourceHeight = Math.max(1, nextSourceHeight);
    },
    start: () => {
      if (running) {
        return;
      }
      running = true;
      lastTimestamp = performance.now();
      lastPerformanceSampleAt = lastTimestamp;
      effectFrameCount = 0;
      frameId = window.requestAnimationFrame(render);
    },
  };
}
