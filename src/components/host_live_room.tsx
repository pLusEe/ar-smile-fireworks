import {
  TUXIconArrowTriangleRightFillLTR,
  TUXIconHeartFill,
} from "@byted-tiktok/tux-icons";
import { TUXText } from "@byted-tiktok/tux-web";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { EmptyDemoControls } from "./demo_control_handle";
import { GiftTray, useGiftTray } from "./gift_tray/gift_tray";
import { HostCameraBackground } from "./host_camera_background";
import {
  LiveAnnouncementBanner,
  useLiveAnnouncementCycle,
} from "./live_announcement";

type ChatMessage = {
  avatar?: string;
  badge?: boolean;
  level: string;
  message: string;
  username: string;
};

const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;

const HOST_ASSETS = {
  creatorAvatar: new URL(
    "../page/host_live/assets/figma-host-default/creator-avatar.png",
    import.meta.url,
  ).href,
  viewerOneOverlay: new URL(
    "../page/host_live/assets/figma-host-default/viewer-1-overlay.svg",
    import.meta.url,
  ).href,
  viewerOneStroke: new URL(
    "../page/host_live/assets/figma-host-default/viewer-1-stroke.svg",
    import.meta.url,
  ).href,
  viewerTwoOverlay: new URL(
    "../page/host_live/assets/figma-host-default/viewer-2-overlay.svg",
    import.meta.url,
  ).href,
  viewerTwoStroke: new URL(
    "../page/host_live/assets/figma-host-default/viewer-2-stroke.svg",
    import.meta.url,
  ).href,
  ranking: new URL(
    "../page/host_live/assets/figma-host-default/ranking-icon.svg",
    import.meta.url,
  ).href,
  liveFest: new URL(
    "../page/host_live/assets/figma-host-default/live-fest.png",
    import.meta.url,
  ).href,
  connection: new URL(
    "../page/host_live/assets/figma-host-default/connection-status.svg",
    import.meta.url,
  ).href,
  housePlay: new URL(
    "../page/host_live/assets/figma-host-default/house-play.svg",
    import.meta.url,
  ).href,
  power: new URL(
    "../page/host_live/assets/figma-host-default/power.svg",
    import.meta.url,
  ).href,
  heartLevel: new URL(
    "../page/host_live/assets/figma-host-default/heart-level.svg",
    import.meta.url,
  ).href,
  join: new URL(
    "../page/host_live/assets/figma-host-default/join.svg",
    import.meta.url,
  ).href,
  levelBackground: new URL(
    "../page/host_live/assets/figma-host-default/level-bg-45.svg",
    import.meta.url,
  ).href,
  levelIcon: new URL(
    "../page/host_live/assets/figma-host-default/level-icon-45.svg",
    import.meta.url,
  ).href,
  subscriberBackground: new URL(
    "../page/host_live/assets/figma-host-default/sub-bg.svg",
    import.meta.url,
  ).href,
  subscriberIcon: new URL(
    "../page/host_live/assets/figma-host-default/sub-icon.svg",
    import.meta.url,
  ).href,
  rank: new URL(
    "../page/host_live/assets/figma-host-default/rank-icon.svg",
    import.meta.url,
  ).href,
  moderator: new URL(
    "../page/host_live/assets/figma-host-default/moderator.svg",
    import.meta.url,
  ).href,
  commentOne: new URL(
    "../page/host_live/assets/figma-host-default/comment-avatar-1.png",
    import.meta.url,
  ).href,
  commentTwo: new URL(
    "../page/host_live/assets/figma-host-default/comment-avatar-2.png",
    import.meta.url,
  ).href,
  commentThree: new URL(
    "../page/host_live/assets/figma-host-default/comment-avatar-3.png",
    import.meta.url,
  ).href,
  cohost: new URL(
    "../page/host_live/assets/figma-host-default/cohost-real.svg",
    import.meta.url,
  ).href,
  multiLive: new URL(
    "../page/host_live/assets/figma-host-default/multi-live.svg",
    import.meta.url,
  ).href,
  interaction: new URL(
    "../page/host_live/assets/figma-host-default/interaction.svg",
    import.meta.url,
  ).href,
  share: new URL(
    "../page/host_live/assets/figma-host-default/share.svg",
    import.meta.url,
  ).href,
  enhance: new URL(
    "../page/host_live/assets/figma-host-default/enhance.svg",
    import.meta.url,
  ).href,
  more: new URL(
    "../page/host_live/assets/figma-host-default/more.svg",
    import.meta.url,
  ).href,
  trayAvatar: new URL(
    "../page/host_live/assets/figma-host-default/tray-avatar.png",
    import.meta.url,
  ).href,
  pancakeGift: new URL(
    "../page/host_live/assets/figma-host-default/pancake.png",
    import.meta.url,
  ).href,
  universeGift: new URL(
    "../page/host_live/assets/figma-host-default/universe.png",
    import.meta.url,
  ).href,
};

const HOST_MESSAGES: ChatMessage[] = [
  {
    avatar: HOST_ASSETS.commentOne,
    badge: true,
    level: "45",
    message: "Welcome to TikTok LIVE! Here you can connect with friends",
    username: "Aliveness",
  },
  {
    avatar: HOST_ASSETS.commentTwo,
    badge: true,
    level: "5",
    message: "What’s up bois",
    username: "Yves_SF",
  },
  {
    avatar: HOST_ASSETS.commentThree,
    level: "30",
    message: "You are an inspiration to us all",
    username: "ronweasly1",
  },
  {
    level: "",
    message: "joined",
    username: "zero_taeyeon",
  },
  {
    avatar: HOST_ASSETS.commentTwo,
    level: "5",
    message: "The stream looks amazing today",
    username: "Yves_SF",
  },
  {
    level: "",
    message: "joined",
    username: "maya_live",
  },
  {
    avatar: HOST_ASSETS.commentOne,
    badge: true,
    level: "45",
    message: "Sending love from London!",
    username: "Aliveness",
  },
  {
    avatar: HOST_ASSETS.commentThree,
    level: "30",
    message: "Let’s go! 🔥",
    username: "ronweasly1",
  },
];

const HOST_GIFT_SCRIPT = [
  {
    itemId: "pancake",
    giftImageSrc: HOST_ASSETS.pancakeGift,
    giftName: "Pancake",
    giftPrice: 5,
    sendCount: 30,
  },
  {
    itemId: "universe",
    giftImageSrc: HOST_ASSETS.universeGift,
    giftName: "Universe",
    giftPrice: 34999,
    sendCount: 1,
  },
] as const;

const HOST_GIFT_VIEWERS = [
  {
    avatar: HOST_ASSETS.commentOne,
    id: "aliveness",
    username: "Aliveness",
  },
  {
    avatar: HOST_ASSETS.commentTwo,
    id: "yves-sf",
    username: "Yves_SF",
  },
  {
    avatar: HOST_ASSETS.commentThree,
    id: "ronweasly1",
    username: "ronweasly1",
  },
  {
    avatar: HOST_ASSETS.trayAvatar,
    id: "maya-live",
    username: "maya_live",
  },
] as const;

const HOST_LIVE_ANNOUNCEMENT_SCRIPT = [
  {
    id: "host-upgrade-1",
    text: "Yves_SF just upgraded to Lv.20",
  },
];

function getCanvasTransform() {
  if (typeof window === "undefined") {
    return "translate3d(-50%, -50%, 0)";
  }

  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const scale = Math.min(
    1,
    viewportWidth / CANVAS_WIDTH,
    viewportHeight / CANVAS_HEIGHT,
  );

  return `translate3d(-50%, -50%, 0) scale(${scale})`;
}

export function useCanvasTransform() {
  const [transform, setTransform] = useState(getCanvasTransform);

  useEffect(() => {
    const update = () => setTransform(getCanvasTransform());
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return transform;
}

function ViewerMedal({
  avatar,
  label,
  overlay,
  stroke,
}: {
  avatar: string;
  label: string;
  overlay: string;
  stroke: string;
}) {
  return (
    <span className="relative -mr-[6px] h-[24px] w-[24px] overflow-hidden rounded-full">
      <img alt="" className="absolute inset-0 h-full w-full object-cover" src={avatar} />
      <img alt="" className="absolute inset-0 h-full w-full" src={overlay} />
      <TUXText
        as="span"
        className="absolute inset-x-0 bottom-0 text-center"
        color="#ffffff"
        size={9}
        weight={700}
      >
        {label}
      </TUXText>
      <img alt="" className="absolute inset-0 h-full w-full" src={stroke} />
    </span>
  );
}

function ViewerRanking() {
  return (
    <div className="flex h-[36px] shrink-0 items-center justify-end px-[4px]">
      <ViewerMedal
        avatar={HOST_ASSETS.commentOne}
        label="2K+"
        overlay={HOST_ASSETS.viewerOneOverlay}
        stroke={HOST_ASSETS.viewerOneStroke}
      />
      <ViewerMedal
        avatar={HOST_ASSETS.commentTwo}
        label="167"
        overlay={HOST_ASSETS.viewerTwoOverlay}
        stroke={HOST_ASSETS.viewerTwoStroke}
      />
      <TUXText
        as="span"
        className="relative z-0 inline-flex h-[24px] items-center rounded-full bg-[rgba(51,51,51,0.4)] px-[8px]"
        color="rgba(255,255,255,0.75)"
        size={11}
        weight={600}
      >
        278
      </TUXText>
    </div>
  );
}

export function HostTopArea() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-[44px] z-20 h-[114px]">
      <div className="flex h-[36px] items-center justify-between pl-[12px]">
        <div className="flex h-[36px] items-center rounded-[20px] bg-[rgba(51,51,51,0.4)] pr-[4px]">
          <img
            alt=""
            className="h-[36px] w-[36px] rounded-full object-cover"
            src={HOST_ASSETS.creatorAvatar}
          />
          <div className="ml-[4px] flex flex-col">
            <TUXText as="span" color="#ffffff" size={13} weight={700}>
              Theodore_88
            </TUXText>
            <TUXText
              as="span"
              className="flex items-center gap-[2px]"
              color="rgba(255,255,255,0.75)"
              size={11}
              weight={500}
            >
              <TUXIconHeartFill size={10} />
              127.4K
            </TUXText>
          </div>
          <span
            className="ml-[8px] flex h-[28px] min-w-[56px] items-center justify-center gap-[4px] rounded-full px-[8px] text-[12px] font-medium text-[#f55d51]"
            style={{ backgroundColor: "#ffffff" }}
          >
            <img
              alt=""
              className="h-[17px] w-[20px]"
              src={HOST_ASSETS.heartLevel}
            />
            12
          </span>
        </div>

        <div className="flex h-[36px] items-center">
          <ViewerRanking />
          <button
            aria-label="结束直播"
            className="pointer-events-auto flex h-[36px] w-[40px] items-center justify-center pr-[4px]"
            type="button"
          >
            <img
              alt=""
              className="h-[20px] w-[20px]"
              src={HOST_ASSETS.power}
            />
          </button>
        </div>
      </div>

      <div className="flex h-[36px] items-center justify-between py-[6px] pl-[12px]">
        <div className="flex h-[24px] items-center gap-[2px] rounded-[10px] bg-[rgba(51,51,51,0.4)] px-[4px]">
          <img alt="" className="h-[12px] w-[12px]" src={HOST_ASSETS.ranking} />
          <TUXText as="span" color="#ffffff" size={12} weight={600}>
            League A2 top 80%
          </TUXText>
        </div>
        <div className="flex h-[24px] items-start pr-[12px]">
          <div className="flex h-[24px] w-[106px] items-center overflow-hidden rounded-[8px] bg-[rgba(51,51,51,0.4)]">
            <TUXText
              as="span"
              className="flex-1 text-center"
              color="#ffffff"
              size={12}
              weight={600}
            >
              LIVE Fest
            </TUXText>
            <img
              alt=""
              className="h-[24px] w-[38px] object-contain"
              src={HOST_ASSETS.liveFest}
            />
          </div>
        </div>
      </div>

      <div className="relative h-[40px]">
        <div className="absolute right-0 top-0 flex h-[24px] w-[58px] items-center gap-[2px] overflow-hidden rounded-l-[10px] bg-[rgba(51,51,51,0.4)] py-[2px] pl-[2px] pr-[4px]">
          <span className="relative h-[16px] w-[16px] shrink-0">
            <img
              alt=""
              className="absolute left-[4px] top-[4px] h-[8px] w-[8px]"
              src={HOST_ASSETS.connection}
            />
          </span>
          <span className="relative h-[16px] w-[16px] shrink-0">
            <img
              alt=""
              className="absolute left-px top-px h-[14px] w-[14px]"
              src={HOST_ASSETS.housePlay}
            />
          </span>
          <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center text-[rgba(255,255,255,0.75)]">
            <TUXIconArrowTriangleRightFillLTR size={16} />
          </span>
        </div>
      </div>
    </header>
  );
}

function HostLevelBadge({ level }: { level: string }) {
  return (
    <span className="relative inline-block h-[14px] w-[32px] shrink-0">
      <img
        alt=""
        className="absolute inset-0 h-full w-full"
        src={HOST_ASSETS.levelBackground}
      />
      <img
        alt=""
        className="absolute left-[2px] top-0 h-[14px] w-[14px]"
        src={HOST_ASSETS.levelIcon}
      />
      <TUXText
        as="span"
        className="absolute left-[24px] top-[7px] -translate-x-1/2 -translate-y-1/2"
        color="#ffffff"
        size={10}
        weight={700}
      >
        {level}
      </TUXText>
    </span>
  );
}

function HostSubscriberBadge() {
  return (
    <span className="relative inline-block h-[14px] w-[46px] shrink-0">
      <img
        alt=""
        className="absolute inset-0 h-full w-full"
        src={HOST_ASSETS.subscriberBackground}
      />
      <img
        alt=""
        className="absolute left-[2px] top-0 h-[14px] w-[14px]"
        src={HOST_ASSETS.subscriberIcon}
      />
      <TUXText
        as="span"
        className="absolute left-[18px] top-[7px] -translate-y-1/2"
        color="#ffffff"
        size={10}
        weight={700}
      >
        AFKE
      </TUXText>
    </span>
  );
}

function HostMessageRow({ message }: { message: ChatMessage }) {
  if (!message.avatar) {
    return (
      <div className="flex h-[28px] shrink-0 items-center gap-[6px]">
        <img alt="" className="h-[28px] w-[28px]" src={HOST_ASSETS.join} />
        <TUXText as="span" color="#ffffff" size={14} weight={500}>
          <span className="text-[rgba(255,255,255,0.7)]">
            {message.username}{" "}
          </span>
          joined
        </TUXText>
      </div>
    );
  }

  return (
    <div className="flex w-full gap-[6px]">
      <img
        alt=""
        className="h-[28px] w-[28px] shrink-0 rounded-full object-cover"
        src={message.avatar}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex h-[18px] items-center gap-[4px] whitespace-nowrap">
          <HostLevelBadge level={message.level} />
          {message.badge ? <HostSubscriberBadge /> : null}
          <TUXText
            as="span"
            className="truncate"
            color="rgba(255,255,255,0.75)"
            size={14}
            weight={500}
          >
            {message.username}
          </TUXText>
          {message.badge ? (
            <>
              <TUXText
                as="span"
                className="flex h-[14px] items-center rounded-[4px] bg-[rgba(254,44,85,0.4)] px-[3px]"
                color="#ffffff"
                size={10}
                weight={700}
              >
                <img
                  alt=""
                  className="mr-px h-[12px] w-[12px]"
                  src={HOST_ASSETS.rank}
                />
                No.1
              </TUXText>
              <span className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.36)]">
                <img
                  alt=""
                  className="h-[10px] w-[10px]"
                  src={HOST_ASSETS.moderator}
                />
              </span>
            </>
          ) : null}
        </div>
        <TUXText
          as="p"
          className="[text-shadow:0_1px_2px_rgba(0,0,0,0.4)]"
          color="#ffffff"
          size={14}
          weight={500}
        >
          {message.message}
        </TUXText>
      </div>
    </div>
  );
}

export function HostMessages() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextMessageIndexRef = useRef(6);
  const nextGiftIndexRef = useRef(0);
  const nextGiftViewerIndexRef = useRef(0);
  const { trays, showGiftTray } = useGiftTray<string, string>({
    durationMs: 3_000,
    maxQueueAgeMs: 1_200,
    maxQueuedItems: 2,
  });
  const { activeAnnouncement, clearAnnouncement } = useLiveAnnouncementCycle(
    HOST_LIVE_ANNOUNCEMENT_SCRIPT,
  );
  const [messages, setMessages] = useState(() =>
    HOST_MESSAGES.slice(0, 6).map((message, index) => ({
      id: index,
      message,
    })),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessages((current) => {
        const scriptIndex =
          nextMessageIndexRef.current % HOST_MESSAGES.length;
        const nextMessage = {
          id: nextMessageIndexRef.current,
          message: HOST_MESSAGES[scriptIndex],
        };
        nextMessageIndexRef.current += 1;
        return [...current, nextMessage].slice(-16);
      });
    }, 2200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      behavior: nextMessageIndexRef.current > 4 ? "smooth" : "auto",
      top: node.scrollHeight,
    });
  }, [messages]);

  useEffect(() => {
    const showNextGift = () => {
      const gift =
        HOST_GIFT_SCRIPT[nextGiftIndexRef.current % HOST_GIFT_SCRIPT.length];
      const viewer =
        HOST_GIFT_VIEWERS[
          nextGiftViewerIndexRef.current % HOST_GIFT_VIEWERS.length
        ];
      nextGiftIndexRef.current += 1;
      nextGiftViewerIndexRef.current += 1;
      showGiftTray({
        ...gift,
        scopeId: viewer.id,
        viewerAvatarSrc: viewer.avatar,
        viewerName: viewer.username,
      });
    };

    const firstGiftTimer = window.setTimeout(showNextGift, 300);
    const secondGiftTimer = window.setTimeout(showNextGift, 900);
    const giftTimer = window.setInterval(showNextGift, 6500);

    return () => {
      window.clearTimeout(firstGiftTimer);
      window.clearTimeout(secondGiftTimer);
      window.clearInterval(giftTimer);
    };
  }, [showGiftTray]);

  return (
    <section className="pointer-events-none absolute inset-x-[12px] bottom-[78px] z-20 flex h-[352px] flex-col gap-[8px]">
      <div aria-label="动态礼物消息" className="relative h-[92px] shrink-0">
        {trays.map((tray) => (
          <GiftTray
            key={tray.trayId}
            className={`absolute left-0 ${
              tray.slotId === "upper" ? "top-0" : "top-[48px]"
            }`}
            tray={tray}
          />
        ))}
      </div>
      <div aria-label="滚动直播评论" className="relative min-h-0 flex-1">
        {activeAnnouncement ? (
          <div className="absolute left-0 top-0 z-10 h-[24px] w-full overflow-hidden">
            <LiveAnnouncementBanner
              announcement={activeAnnouncement}
              onComplete={clearAnnouncement}
            />
          </div>
        ) : null}
        <div
          className="absolute inset-x-0 bottom-0 overflow-hidden transition-[height] duration-[280ms] ease-[cubic-bezier(0.2,0.85,0.25,1)]"
          style={{
            height: activeAnnouncement ? "220px" : "252px",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, #000 22%, #000 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, #000 22%, #000 100%)",
          }}
        >
          <div
            ref={scrollRef}
            className="absolute inset-x-0 bottom-0 h-[252px] overflow-hidden [overflow-anchor:none]"
          >
            <div className="flex min-h-full flex-col justify-end gap-[12px]">
              {messages.map(({ id, message }) => (
                <HostMessageRow key={id} message={message} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HostToolButton({
  children,
  icon,
  label,
  showBackground = true,
}: {
  children?: ReactNode;
  icon: string;
  label: string;
  showBackground?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`relative h-[38px] w-[38px] shrink-0 rounded-full active:scale-95 ${
        showBackground ? "bg-[rgba(84,84,84,0.4)]" : "bg-transparent"
      }`}
      type="button"
    >
      {children ?? (
        <img
          alt=""
          className="absolute left-[7px] top-[7px] h-[24px] w-[24px] object-contain"
          src={icon}
        />
      )}
    </button>
  );
}

export function HostToolbar() {
  return (
    <div className="absolute inset-x-0 bottom-[34px] z-20 flex h-[38px] items-start justify-between">
      <div className="flex gap-[6px] pl-[12px]">
        <HostToolButton
          icon={HOST_ASSETS.cohost}
          label="Co-host"
          showBackground={false}
        >
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            src={HOST_ASSETS.cohost}
          />
        </HostToolButton>
        <HostToolButton icon={HOST_ASSETS.multiLive} label="Multi LIVE" />
      </div>
      <div className="flex gap-[6px] pr-[12px]">
        <HostToolButton icon={HOST_ASSETS.interaction} label="Interaction" />
        <HostToolButton icon={HOST_ASSETS.share} label="Share" />
        <HostToolButton icon={HOST_ASSETS.enhance} label="Enhance" />
        <HostToolButton icon={HOST_ASSETS.more} label="More" />
      </div>
    </div>
  );
}

export default function HostLiveRoom() {
  const transform = useCanvasTransform();
  const hostCameraVideoRef = useRef<HTMLVideoElement>(null);

  return (
    <main className="relative h-full min-h-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 h-[844px] w-[390px] origin-center overflow-hidden bg-black font-[var(--app-font-sans)] text-white shadow-[0_0_80px_rgba(0,0,0,0.42)]"
        data-live-room-role="host"
        style={{ color: "#ffffff", transform }}
      >
        <HostCameraBackground videoRef={hostCameraVideoRef} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[160px] bg-gradient-to-b from-[rgba(0,0,0,0.34)] via-[rgba(0,0,0,0.12)] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[310px] bg-gradient-to-b from-transparent via-[rgba(0,0,0,0.12)] to-[rgba(0,0,0,0.34)]" />
        <HostTopArea />
        <HostMessages />
        <HostToolbar />
        <EmptyDemoControls />
      </div>
    </main>
  );
}
