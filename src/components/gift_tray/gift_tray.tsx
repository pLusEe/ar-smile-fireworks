import { useCallback, useEffect, useRef, useState } from "react";
import { liveGiftAsset } from "../../constants/assets";

export const GIFT_TRAY_EXIT_MS = 280;
const GIFT_TRAY_SLOT_IDS = ["lower", "upper"] as const;

type GiftTraySlotId = (typeof GIFT_TRAY_SLOT_IDS)[number];

export type GiftTrayItem<TItemId extends string | number, TScopeId extends string | number> = {
  aggregationKey?: string;
  itemId: TItemId;
  priority?: number;
  scopeId: TScopeId;
  viewerName: string;
  viewerAvatarSrc?: string;
  giftName: string;
  giftImageSrc: string;
  giftPrice: number;
  sendCount?: number;
};

export type GiftTrayState<TItemId extends string | number, TScopeId extends string | number> =
  GiftTrayItem<TItemId, TScopeId> & {
    trayId: number;
    slotId: GiftTraySlotId;
    count: number;
    cycle: number;
    tapCycle: number;
    expiresAt: number;
    exiting: boolean;
  };

type QueuedGiftTray<TItemId extends string | number, TScopeId extends string | number> =
  GiftTrayItem<TItemId, TScopeId> & {
    count: number;
    queuedAt: number;
  };

type GiftTrayQueueState<TItemId extends string | number, TScopeId extends string | number> = {
  active: Array<GiftTrayState<TItemId, TScopeId>>;
  queued: Array<QueuedGiftTray<TItemId, TScopeId>>;
};

type GiftTrayProps<TItemId extends string | number, TScopeId extends string | number> = {
  tray: GiftTrayState<TItemId, TScopeId>;
  className?: string;
  style?: React.CSSProperties;
};

type UseGiftTrayOptions = {
  durationMs?: number;
  exitMs?: number;
  maxQueueAgeMs?: number;
  maxQueuedItems?: number;
};

function isSameGiftTrayItem<TItemId extends string | number, TScopeId extends string | number>(
  first: Pick<
    GiftTrayItem<TItemId, TScopeId>,
    "aggregationKey" | "itemId" | "scopeId"
  >,
  second: Pick<
    GiftTrayItem<TItemId, TScopeId>,
    "aggregationKey" | "itemId" | "scopeId"
  >,
) {
  if (first.aggregationKey && second.aggregationKey) {
    return first.aggregationKey === second.aggregationKey;
  }
  return first.itemId === second.itemId && first.scopeId === second.scopeId;
}

function getGiftTrayPriority(
  item: Pick<GiftTrayItem<string | number, string | number>, "priority">,
) {
  return item.priority ?? 0;
}

export function getGiftTrayDurationMs(price: number) {
  if (price <= 70) {
    return 3000;
  }

  if (price <= 1750) {
    return 4000;
  }

  if (price <= 5200) {
    return 5000;
  }

  if (price <= 17500) {
    return 6000;
  }

  if (price <= 30000) {
    return 7000;
  }

  return 8000;
}

function getGiftTrayShellTone(price: number) {
  if (price >= 10000) {
    return {
      className: "border-[0.6px] border-transparent",
      style: {
        background:
          "linear-gradient(90deg, rgba(81,14,191,0.92) 0%, rgba(81,14,191,0.6) 45.313%, rgba(81,14,191,0.1) 100%) padding-box, linear-gradient(90deg, rgba(148,165,255,0.5) 0%, rgba(148,165,255,0.32) 48%, rgba(148,165,255,0.08) 100%) border-box",
      },
    };
  }

  if (price >= 500) {
    return {
      className: "border-[0.6px] border-transparent",
      style: {
        background:
          "linear-gradient(90deg, #1634c6 0%, rgba(22,52,198,0.6) 51.042%, rgba(22,52,198,0.1) 100%) padding-box, linear-gradient(90deg, rgba(148,165,255,0.5) 0%, rgba(148,165,255,0.32) 48%, rgba(148,165,255,0.08) 100%) border-box",
      },
    };
  }

  return {
    className: "bg-gradient-to-r from-[#262626] via-[rgba(38,38,38,0.6)] to-[rgba(38,38,38,0.1)]",
    style: undefined,
  };
}

export function GiftTray<TItemId extends string | number, TScopeId extends string | number>({
  tray,
  className,
  style,
}: GiftTrayProps<TItemId, TScopeId>) {
  const shellTone = getGiftTrayShellTone(tray.giftPrice);

  return (
    <div
      className={`gift-tray ${tray.exiting ? "gift-tray--exit" : ""} flex items-end gap-[4px] rounded-[40px] ${className ?? ""}`}
      style={style}
      aria-live="polite"
      data-gift-tray
    >
      <div className="flex h-[42px] w-[224px] items-end gap-[1px] rounded-[40px]">
        <div
          className={`gift-tray-shell flex h-[40px] w-[170px] shrink-0 items-center gap-[4px] rounded-[51px] py-[3px] pl-[4px] pr-[10px] ${shellTone.className} ${tray.exiting ? "gift-tray-shell--settled" : ""}`}
          style={shellTone.style}
        >
          <div className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full border border-[rgba(255,255,255,0.28)] bg-[rgba(255,255,255,0.12)]">
            <img
              alt=""
              className="absolute inset-0 h-full w-full max-w-none rounded-full object-cover"
              src={tray.viewerAvatarSrc ?? liveGiftAsset("tray-avatar.png")}
            />
          </div>
          <div className="flex w-[74px] shrink-0 flex-col gap-px overflow-hidden whitespace-nowrap leading-none">
            <span className="truncate font-[var(--app-font-sans)] text-[12px] font-medium leading-[1.3] tracking-[0.1608px] text-[rgba(255,255,255,0.92)] [text-shadow:0_1px_1px_rgba(0,0,0,0.1)]">
              {tray.viewerName}
            </span>
            <span className="truncate font-[var(--app-font-sans)] text-[10px] font-normal leading-[1.3] tracking-[0.2287px] text-[rgba(255,255,255,0.6)]">
              sent {tray.giftName}
            </span>
          </div>
          <div className="relative h-[40px] w-[40px] shrink-0 overflow-visible">
            <img alt="" className="absolute left-1/2 top-1/2 h-[38px] w-[38px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" src={tray.giftImageSrc} />
          </div>
        </div>
        <div className="ml-[-2px] flex h-[26px] w-[50px] shrink-0 items-end overflow-visible">
          <div
            key={`gift-tray-count-${tray.cycle}-${tray.tapCycle}`}
            className={`gift-tray-count flex items-end ${tray.tapCycle === 0 ? "gift-tray-count--entry" : "gift-tray-count--tap"}`}
          >
            <span className="mr-[-3px] flex h-[21.517px] w-[16.413px] shrink-0 items-center justify-center">
              <span className="gift-tray-count-skew gift-tray-count-text block h-[21.965px] w-[12px] text-center font-[var(--app-font-display)] text-[17px] font-bold leading-[22px] tracking-[0.34px] [text-shadow:0_1px_1px_rgba(0,0,0,0.3)]" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>
                x
              </span>
            </span>
            <span className="flex h-[26px] w-[39.333px] shrink-0 items-center justify-center">
              <span className="gift-tray-count-skew gift-tray-count-text block h-[26.541px] w-[34px] font-[var(--app-font-display)] text-[24px] font-bold leading-[28px] [text-shadow:0_1px_1px_rgba(0,0,0,0.3)]" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>
                {tray.count}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useGiftTray<TItemId extends string | number, TScopeId extends string | number>({
  durationMs,
  exitMs = GIFT_TRAY_EXIT_MS,
  maxQueueAgeMs = Number.POSITIVE_INFINITY,
  maxQueuedItems = Number.POSITIVE_INFINITY,
}: UseGiftTrayOptions = {}) {
  const trayCycleRef = useRef(0);
  const showTimerRefs = useRef(new Map<number, number>());
  const exitTimerRefs = useRef(new Map<number, number>());
  const [queueState, setQueueState] = useState<GiftTrayQueueState<TItemId, TScopeId>>({
    active: [],
    queued: [],
  });

  const clearGiftTrayTimers = () => {
    showTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    showTimerRefs.current.clear();

    exitTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    exitTimerRefs.current.clear();
  };

  const clearGiftTray = useCallback(() => {
    clearGiftTrayTimers();
    setQueueState({ active: [], queued: [] });
  }, []);

  const createActiveTray = (
    item: QueuedGiftTray<TItemId, TScopeId>,
    slotId: GiftTraySlotId,
    now: number,
  ): GiftTrayState<TItemId, TScopeId> => ({
    ...item,
    trayId: trayCycleRef.current,
    slotId,
    cycle: trayCycleRef.current,
    tapCycle: 0,
    expiresAt: now + (durationMs ?? getGiftTrayDurationMs(item.giftPrice)),
    exiting: false,
  });

  const fillOpenSlots = (
    active: Array<GiftTrayState<TItemId, TScopeId>>,
    queued: Array<QueuedGiftTray<TItemId, TScopeId>>,
    now: number,
  ) => {
    const nextActive = [...active];
    const nextQueued = queued
      .filter((item) => now - item.queuedAt <= maxQueueAgeMs)
      .sort(
        (first, second) =>
          getGiftTrayPriority(second) - getGiftTrayPriority(first) ||
          second.queuedAt - first.queuedAt,
      );

    for (const slotId of GIFT_TRAY_SLOT_IDS) {
      if (nextQueued.length === 0 || nextActive.some((tray) => tray.slotId === slotId)) {
        continue;
      }

      const nextItem = nextQueued.shift();

      if (!nextItem) {
        break;
      }

      trayCycleRef.current += 1;
      nextActive.push(createActiveTray(nextItem, slotId, now));
    }

    return {
      active: nextActive,
      queued: nextQueued,
    };
  };

  const showGiftTray = useCallback((item: GiftTrayItem<TItemId, TScopeId>) => {
    const now = Date.now();
    const sendCount = item.sendCount ?? 1;

    setQueueState((currentState) => {
      const freshQueued = currentState.queued.filter(
        (queuedItem) => now - queuedItem.queuedAt <= maxQueueAgeMs,
      );
      const activeIndex = currentState.active.findIndex((tray) => !tray.exiting && isSameGiftTrayItem(tray, item));

      if (activeIndex >= 0) {
        const nextActive = currentState.active.map((tray, index) =>
          index === activeIndex
            ? {
                ...tray,
                ...item,
                count: tray.count + sendCount,
                tapCycle: tray.tapCycle + 1,
                expiresAt:
                  now + (durationMs ?? getGiftTrayDurationMs(item.giftPrice)),
                exiting: false,
              }
            : tray,
        );

        return {
          active: nextActive,
          queued: freshQueued,
        };
      }

      const queuedIndex = freshQueued.findIndex((queuedTray) => isSameGiftTrayItem(queuedTray, item));

      if (queuedIndex >= 0) {
        return {
          active: currentState.active,
          queued: freshQueued.map((queuedTray, index) =>
            index === queuedIndex
              ? {
                 ...queuedTray,
                 ...item,
                  count: queuedTray.count + sendCount,
                  queuedAt: now,
                }
              : queuedTray,
          ),
        };
      }

      const nextQueuedItem = {
        ...item,
        count: sendCount,
        queuedAt: now,
      };
      const lowestPriorityActive = [...currentState.active]
        .filter((tray) => !tray.exiting)
        .sort(
          (first, second) =>
            getGiftTrayPriority(first) - getGiftTrayPriority(second),
        )[0];

      if (
        lowestPriorityActive &&
        currentState.active.length >= GIFT_TRAY_SLOT_IDS.length &&
        getGiftTrayPriority(nextQueuedItem) >
          getGiftTrayPriority(lowestPriorityActive)
      ) {
        trayCycleRef.current += 1;
        const replacement = createActiveTray(
          nextQueuedItem,
          lowestPriorityActive.slotId,
          now,
        );
        return {
          active: currentState.active.map((tray) =>
            tray.trayId === lowestPriorityActive.trayId ? replacement : tray,
          ),
          queued: freshQueued,
        };
      }

      const nextQueued = [...freshQueued, nextQueuedItem]
        .sort(
          (first, second) =>
            getGiftTrayPriority(second) - getGiftTrayPriority(first) ||
            second.queuedAt - first.queuedAt,
        )
        .slice(0, maxQueuedItems);
      return fillOpenSlots(currentState.active, nextQueued, now);
    });
  }, [durationMs, maxQueueAgeMs, maxQueuedItems]);

  useEffect(() => {
    clearGiftTrayTimers();

    queueState.active.forEach((tray) => {
      if (tray.exiting) {
        const exitTimer = window.setTimeout(() => {
          setQueueState((currentState) => {
            const remainingActive = currentState.active.filter((activeTray) => activeTray.trayId !== tray.trayId);

            return fillOpenSlots(remainingActive, currentState.queued, Date.now());
          });
          exitTimerRefs.current.delete(tray.trayId);
        }, exitMs);

        exitTimerRefs.current.set(tray.trayId, exitTimer);
        return;
      }

      const showTimer = window.setTimeout(() => {
        setQueueState((currentState) => ({
          ...currentState,
          active: currentState.active.map((activeTray) =>
            activeTray.trayId === tray.trayId && activeTray.expiresAt === tray.expiresAt
              ? { ...activeTray, exiting: true }
              : activeTray,
          ),
        }));
        showTimerRefs.current.delete(tray.trayId);
      }, Math.max(0, tray.expiresAt - Date.now()));

      showTimerRefs.current.set(tray.trayId, showTimer);
    });

    return clearGiftTrayTimers;
  }, [
    exitMs,
    maxQueueAgeMs,
    maxQueuedItems,
    queueState.active,
    queueState.queued,
  ]);

  useEffect(() => clearGiftTrayTimers, []);

  return {
    trays: queueState.active,
    tray: queueState.active[0] ?? null,
    clearGiftTray,
    showGiftTray,
  };
}
