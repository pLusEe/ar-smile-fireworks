import { useEffect, useRef, useState } from "react";

const upgradeBackground = new URL(
  "../../assets/live_room/upgrade-bg.svg",
  import.meta.url,
).href;
const upgradeArrow = new URL(
  "../../assets/live_room/upgrade-arrow.svg",
  import.meta.url,
).href;
const upgradeDiamond = new URL(
  "../../assets/live_room/upgrade-diamond.svg",
  import.meta.url,
).href;

const INITIAL_DELAY_MS = 3_200;
const INTERVAL_MS = 9_000;
const DISPLAY_DURATION_MS = 4_580;

export type LiveAnnouncement = {
  id: string;
  text: string;
};

type ActiveAnnouncement = LiveAnnouncement & {
  cycle: number;
};

export function useLiveAnnouncementCycle(script: LiveAnnouncement[]) {
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<ActiveAnnouncement | null>(null);
  const nextIndexRef = useRef(0);
  const cycleRef = useRef(0);

  useEffect(() => {
    if (script.length === 0) {
      return;
    }

    let hideTimer: number | null = null;
    let nextTimer: number | null = null;

    const showNext = () => {
      const announcement = script[nextIndexRef.current % script.length];
      nextIndexRef.current += 1;
      cycleRef.current += 1;
      setActiveAnnouncement({
        ...announcement,
        cycle: cycleRef.current,
      });
      hideTimer = window.setTimeout(() => {
        setActiveAnnouncement(null);
      }, DISPLAY_DURATION_MS);
      nextTimer = window.setTimeout(showNext, INTERVAL_MS);
    };

    nextTimer = window.setTimeout(showNext, INITIAL_DELAY_MS);

    return () => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      if (nextTimer !== null) {
        window.clearTimeout(nextTimer);
      }
    };
  }, [script]);

  return activeAnnouncement;
}

export function LiveAnnouncementBanner({
  announcement,
}: {
  announcement: ActiveAnnouncement;
}) {
  return (
    <div
      key={announcement.cycle}
      aria-hidden="true"
      className="live-announcement pointer-events-none relative flex h-[24px] w-[227px] items-center overflow-hidden"
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
    </div>
  );
}
