import {
  TUXIconArrowTriangleRightFillLTR,
  TUXIconHeartFill,
} from "@byted-tiktok/tux-icons";
import { TUXText } from "@byted-tiktok/tux-web";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LiveAnnouncementBanner,
  useLiveAnnouncementCycle,
} from "./live_announcement";
import {
  ANNOUNCEMENT_SCRIPT,
  CHAT_SCRIPT,
  LIVE_ROOM_ASSETS,
  type ChatMessage,
} from "./live_room_data";

const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;

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
        avatar={LIVE_ROOM_ASSETS.commentOne}
        label="2K+"
        overlay={LIVE_ROOM_ASSETS.viewerOneOverlay}
        stroke={LIVE_ROOM_ASSETS.viewerOneStroke}
      />
      <ViewerMedal
        avatar={LIVE_ROOM_ASSETS.commentTwo}
        label="167"
        overlay={LIVE_ROOM_ASSETS.viewerTwoOverlay}
        stroke={LIVE_ROOM_ASSETS.viewerTwoStroke}
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

export function LiveRoomHeader() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-[44px] z-20 h-[114px]">
      <div className="flex h-[36px] items-center justify-between pl-[12px]">
        <div className="flex h-[36px] items-center rounded-[20px] bg-[rgba(51,51,51,0.4)] pr-[4px]">
          <img
            alt=""
            className="h-[36px] w-[36px] rounded-full object-cover"
            src={LIVE_ROOM_ASSETS.creatorAvatar}
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
              src={LIVE_ROOM_ASSETS.heartLevel}
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
              src={LIVE_ROOM_ASSETS.power}
            />
          </button>
        </div>
      </div>

      <div className="flex h-[36px] items-center justify-between py-[6px] pl-[12px]">
        <div className="flex h-[24px] items-center gap-[2px] rounded-[10px] bg-[rgba(51,51,51,0.4)] px-[4px]">
          <img alt="" className="h-[12px] w-[12px]" src={LIVE_ROOM_ASSETS.ranking} />
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
              src={LIVE_ROOM_ASSETS.liveFest}
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
              src={LIVE_ROOM_ASSETS.connection}
            />
          </span>
          <span className="relative h-[16px] w-[16px] shrink-0">
            <img
              alt=""
              className="absolute left-px top-px h-[14px] w-[14px]"
              src={LIVE_ROOM_ASSETS.housePlay}
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

function LevelBadge({ level }: { level: string }) {
  return (
    <span className="relative inline-block h-[14px] w-[32px] shrink-0">
      <img
        alt=""
        className="absolute inset-0 h-full w-full"
        src={LIVE_ROOM_ASSETS.levelBackground}
      />
      <img
        alt=""
        className="absolute left-[2px] top-0 h-[14px] w-[14px]"
        src={LIVE_ROOM_ASSETS.levelIcon}
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

function SubscriberBadge() {
  return (
    <span className="relative inline-block h-[14px] w-[46px] shrink-0">
      <img
        alt=""
        className="absolute inset-0 h-full w-full"
        src={LIVE_ROOM_ASSETS.subscriberBackground}
      />
      <img
        alt=""
        className="absolute left-[2px] top-0 h-[14px] w-[14px]"
        src={LIVE_ROOM_ASSETS.subscriberIcon}
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

function MessageRow({ message }: { message: ChatMessage }) {
  if (!message.avatar) {
    return (
      <div className="flex h-[28px] shrink-0 items-center gap-[6px]">
        <img alt="" className="h-[28px] w-[28px]" src={LIVE_ROOM_ASSETS.join} />
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
          <LevelBadge level={message.level} />
          {message.badge ? <SubscriberBadge /> : null}
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
                  src={LIVE_ROOM_ASSETS.rank}
                />
                No.1
              </TUXText>
              <span className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.36)]">
                <img
                  alt=""
                  className="h-[10px] w-[10px]"
                  src={LIVE_ROOM_ASSETS.moderator}
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

export function LiveRoomFeed() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextMessageIndexRef = useRef(6);
  const activeAnnouncement =
    useLiveAnnouncementCycle(ANNOUNCEMENT_SCRIPT);
  const [messages, setMessages] = useState(() =>
    CHAT_SCRIPT.slice(0, 6).map((message, index) => ({
      id: index,
      message,
    })),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessages((current) => {
        const scriptIndex =
          nextMessageIndexRef.current % CHAT_SCRIPT.length;
        const nextMessage = {
          id: nextMessageIndexRef.current,
          message: CHAT_SCRIPT[scriptIndex],
        };
        nextMessageIndexRef.current += 1;
        return [...current, nextMessage].slice(-16);
      });
    }, 2_200);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      behavior: nextMessageIndexRef.current > 6 ? "smooth" : "auto",
      top: node.scrollHeight,
    });
  }, [messages]);

  return (
    <section className="pointer-events-none absolute inset-x-[12px] bottom-[78px] z-20 h-[284px]">
      {activeAnnouncement ? (
        <div className="absolute left-0 top-0 z-10 h-[24px] w-full overflow-hidden">
          <LiveAnnouncementBanner announcement={activeAnnouncement} />
        </div>
      ) : null}
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden transition-[height] duration-[280ms] ease-[cubic-bezier(0.2,0.85,0.25,1)]"
        style={{
          height: activeAnnouncement ? "252px" : "284px",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, #000 22%, #000 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, #000 22%, #000 100%)",
        }}
      >
        <div
          ref={scrollRef}
          aria-label="滚动直播评论"
          className="absolute inset-x-0 bottom-0 h-[284px] overflow-hidden [overflow-anchor:none]"
        >
          <div className="flex min-h-full flex-col justify-end gap-[12px]">
            {messages.map(({ id, message }) => (
              <MessageRow key={id} message={message} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveRoomToolButton({
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

export function LiveRoomToolbar() {
  return (
    <div className="absolute inset-x-0 bottom-[34px] z-20 flex h-[38px] items-start justify-between">
      <div className="flex gap-[6px] pl-[12px]">
        <LiveRoomToolButton
          icon={LIVE_ROOM_ASSETS.cohost}
          label="Co-host"
          showBackground={false}
        >
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            src={LIVE_ROOM_ASSETS.cohost}
          />
        </LiveRoomToolButton>
        <LiveRoomToolButton icon={LIVE_ROOM_ASSETS.multiLive} label="Multi LIVE" />
      </div>
      <div className="flex gap-[6px] pr-[12px]">
        <LiveRoomToolButton icon={LIVE_ROOM_ASSETS.interaction} label="Interaction" />
        <LiveRoomToolButton icon={LIVE_ROOM_ASSETS.share} label="Share" />
        <LiveRoomToolButton icon={LIVE_ROOM_ASSETS.enhance} label="Enhance" />
        <LiveRoomToolButton icon={LIVE_ROOM_ASSETS.more} label="More" />
      </div>
    </div>
  );
}
