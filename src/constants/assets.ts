export const CDN_LIVE_GIFTS_BASE =
  "https://lf3-static.bytednsdoc.com/obj/eden-cn/jpsibw/ljhwZthlaukjlkulzlp/live-gifts/zhangyilong-315/dsgn-main";

export function liveGiftAsset(path: string) {
  return `${CDN_LIVE_GIFTS_BASE}/${path.replace(/^\/+/, "")}`;
}
