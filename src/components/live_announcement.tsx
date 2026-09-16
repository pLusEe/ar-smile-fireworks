import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";

const upgradeBackground = new URL(
  "../page/host_live/assets/figma-host-default/upgrade-bg.svg",
  import.meta.url,
).href;
const upgradeDiamond = new URL(
  "../page/host_live/assets/figma-host-default/upgrade-diamond.svg",
  import.meta.url,
).href;
const upgradeArrow = new URL(
  "../page/host_live/assets/figma-host-default/upgrade-arrow.svg",
  import.meta.url,
).href;

const ENTER_EASE = [0.16, 1, 0.3, 1] as const;
const EXIT_EASE = [0, 0, 0.58, 1] as const;
const ENTER_DURATION_S = 0.3;
const HOLD_DURATION_S = 4;
const EXIT_DURATION_S = 0.28;
const ENTER_OFFSET_X = -182;

export const LIVE_ANNOUNCEMENT_GAP = 8;
export const LIVE_ANNOUNCEMENT_INTERVAL_MS = 9000;
export const LIVE_ANNOUNCEMENT_INITIAL_DELAY_MS = 3200;

export type LiveAnnouncement = {
  id: string;
  text: string;
};

export type ActiveLiveAnnouncement = LiveAnnouncement & {
  cycleId: number;
};

export function useLiveAnnouncementCycle(
  script: LiveAnnouncement[],
  intervalMs = LIVE_ANNOUNCEMENT_INTERVAL_MS,
  initialDelayMs = LIVE_ANNOUNCEMENT_INITIAL_DELAY_MS,
) {
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<ActiveLiveAnnouncement | null>(null);
  const nextIndexRef = useRef(0);
  const cycleIdRef = useRef(0);

  useEffect(() => {
    if (script.length === 0) {
      return;
    }

    let timeoutId: number | null = null;

    const scheduleNext = (delayMs: number) => {
      timeoutId = window.setTimeout(() => {
        const nextAnnouncement = script[nextIndexRef.current % script.length];
        nextIndexRef.current += 1;
        cycleIdRef.current += 1;
        setActiveAnnouncement({
          ...nextAnnouncement,
          cycleId: cycleIdRef.current,
        });
        scheduleNext(intervalMs);
      }, delayMs);
    };

    scheduleNext(initialDelayMs);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [initialDelayMs, intervalMs, script]);

  const clearAnnouncement = useCallback(() => {
    setActiveAnnouncement(null);
  }, []);

  return {
    activeAnnouncement,
    clearAnnouncement,
  };
}

type LiveAnnouncementBannerProps = {
  announcement: ActiveLiveAnnouncement;
  className?: string;
  onComplete: () => void;
};

export function LiveAnnouncementBanner({
  announcement,
  className,
  onComplete,
}: LiveAnnouncementBannerProps) {
  const controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let disposed = false;
    let reducedMotionTimer: number | null = null;
    let holdTimer: number | null = null;

    const runAnimation = async () => {
      if (prefersReducedMotion) {
        controls.set({ opacity: 1, x: 0 });
        reducedMotionTimer = window.setTimeout(() => {
          if (!disposed) {
            onComplete();
          }
        }, HOLD_DURATION_S * 1000);
        return;
      }

      controls.set({ opacity: 0, x: ENTER_OFFSET_X });

      await controls.start({
        opacity: 1,
        x: 0,
        transition: {
          duration: ENTER_DURATION_S,
          ease: ENTER_EASE,
        },
      });

      await new Promise<void>((resolve) => {
        holdTimer = window.setTimeout(() => {
          holdTimer = null;
          resolve();
        }, HOLD_DURATION_S * 1000);
      });

      await controls.start({
        opacity: 0,
        transition: {
          duration: EXIT_DURATION_S,
          ease: EXIT_EASE,
        },
      });

      if (!disposed) {
        onComplete();
      }
    };

    runAnimation();

    return () => {
      disposed = true;
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
      }
      if (reducedMotionTimer !== null) {
        window.clearTimeout(reducedMotionTimer);
      }
    };
  }, [announcement.cycleId, controls, onComplete, prefersReducedMotion]);

  return (
    <motion.div
      aria-hidden="true"
      animate={controls}
      className={`pointer-events-none relative flex h-[24px] w-[227px] items-center overflow-hidden ${className ?? ""}`}
      initial={false}
      style={{ willChange: "transform, opacity" }}
    >
      <img
        alt=""
        className="absolute inset-0 h-full w-full"
        src={upgradeBackground}
      />
      <img
        alt=""
        className="absolute left-[8px] top-[4px] h-[16px] w-[16px]"
        src={upgradeArrow}
      />
      <span
        className="absolute left-[28px] top-[5px] text-[11px] font-medium leading-[14px] tracking-[0.195px]"
        style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
      >
        {announcement.text}
      </span>
      <img
        alt=""
        className="absolute left-[201px] top-[3px] h-[18px] w-[18px]"
        src={upgradeDiamond}
      />
    </motion.div>
  );
}
