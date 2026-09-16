export type ChatMessage = {
  avatar?: string;
  badge?: boolean;
  level: string;
  message: string;
  username: string;
};

export const LIVE_ROOM_ASSETS = {
  creatorAvatar: new URL(
    "../../assets/live_room/creator-avatar.png",
    import.meta.url,
  ).href,
  viewerOneOverlay: new URL(
    "../../assets/live_room/viewer-1-overlay.svg",
    import.meta.url,
  ).href,
  viewerOneStroke: new URL(
    "../../assets/live_room/viewer-1-stroke.svg",
    import.meta.url,
  ).href,
  viewerTwoOverlay: new URL(
    "../../assets/live_room/viewer-2-overlay.svg",
    import.meta.url,
  ).href,
  viewerTwoStroke: new URL(
    "../../assets/live_room/viewer-2-stroke.svg",
    import.meta.url,
  ).href,
  ranking: new URL(
    "../../assets/live_room/ranking-icon.svg",
    import.meta.url,
  ).href,
  liveFest: new URL(
    "../../assets/live_room/live-fest.png",
    import.meta.url,
  ).href,
  connection: new URL(
    "../../assets/live_room/connection-status.svg",
    import.meta.url,
  ).href,
  housePlay: new URL(
    "../../assets/live_room/house-play.svg",
    import.meta.url,
  ).href,
  power: new URL(
    "../../assets/live_room/power.svg",
    import.meta.url,
  ).href,
  heartLevel: new URL(
    "../../assets/live_room/heart-level.svg",
    import.meta.url,
  ).href,
  join: new URL(
    "../../assets/live_room/join.svg",
    import.meta.url,
  ).href,
  levelBackground: new URL(
    "../../assets/live_room/level-bg-45.svg",
    import.meta.url,
  ).href,
  levelIcon: new URL(
    "../../assets/live_room/level-icon-45.svg",
    import.meta.url,
  ).href,
  subscriberBackground: new URL(
    "../../assets/live_room/sub-bg.svg",
    import.meta.url,
  ).href,
  subscriberIcon: new URL(
    "../../assets/live_room/sub-icon.svg",
    import.meta.url,
  ).href,
  rank: new URL(
    "../../assets/live_room/rank-icon.svg",
    import.meta.url,
  ).href,
  moderator: new URL(
    "../../assets/live_room/moderator.svg",
    import.meta.url,
  ).href,
  commentOne: new URL(
    "../../assets/live_room/comment-avatar-1.png",
    import.meta.url,
  ).href,
  commentTwo: new URL(
    "../../assets/live_room/comment-avatar-2.png",
    import.meta.url,
  ).href,
  commentThree: new URL(
    "../../assets/live_room/comment-avatar-3.png",
    import.meta.url,
  ).href,
  cohost: new URL(
    "../../assets/live_room/cohost-real.svg",
    import.meta.url,
  ).href,
  multiLive: new URL(
    "../../assets/live_room/multi-live.svg",
    import.meta.url,
  ).href,
  interaction: new URL(
    "../../assets/live_room/interaction.svg",
    import.meta.url,
  ).href,
  share: new URL(
    "../../assets/live_room/share.svg",
    import.meta.url,
  ).href,
  enhance: new URL(
    "../../assets/live_room/enhance.svg",
    import.meta.url,
  ).href,
  more: new URL(
    "../../assets/live_room/more.svg",
    import.meta.url,
  ).href,
};

export const STATIC_CHAT_MESSAGES: ChatMessage[] = [
  {
    avatar: LIVE_ROOM_ASSETS.commentOne,
    badge: true,
    level: "45",
    message: "Welcome to TikTok LIVE! Here you can connect with friends",
    username: "Aliveness",
  },
  {
    avatar: LIVE_ROOM_ASSETS.commentTwo,
    badge: true,
    level: "5",
    message: "What’s up bois",
    username: "Yves_SF",
  },
  {
    avatar: LIVE_ROOM_ASSETS.commentThree,
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
    avatar: LIVE_ROOM_ASSETS.commentTwo,
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
    avatar: LIVE_ROOM_ASSETS.commentOne,
    badge: true,
    level: "45",
    message: "Sending love from London!",
    username: "Aliveness",
  },
  {
    avatar: LIVE_ROOM_ASSETS.commentThree,
    level: "30",
    message: "Let’s go! 🔥",
    username: "ronweasly1",
  },
];
