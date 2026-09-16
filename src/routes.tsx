import {
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { Navigate } from "react-router-dom";

import HostLivePage from "./page/host_live/host_live_page";

const ArDebugPage = lazy(
  () => import("./page/ar_debug/ar_debug_page"),
);

export type DesagentRouteNode = {
  id: string;
  path: string;
  label?: string;
  children?: DesagentRouteNode[];
};

export type AppRouteDefinition = DesagentRouteNode & {
  element: ReactNode;
};

function renderArDebugPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[#000000] text-[#ffffff]">
          正在加载 AR 调试页…
        </div>
      }
    >
      <ArDebugPage />
    </Suspense>
  );
}

export const APP_ROUTES: AppRouteDefinition[] = [
  {
    id: "ar-experience",
    path: "/",
    label: "AR 互动体验",
    element: renderArDebugPage(),
  },
  {
    id: "host-live",
    path: "/host-live",
    label: "主播直播间",
    element: <HostLivePage />,
  },
  {
    id: "ar-debug",
    path: "/ar-debug",
    label: "AR 技术验证",
    element: renderArDebugPage(),
  },
  {
    id: "fallback",
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

export function buildDesagentRoutesManifest(): DesagentRouteNode[] {
  return [
    {
      id: "ar-experience",
      path: "/",
      label: "AR 互动体验",
    },
    {
      id: "ar-debug",
      path: "/ar-debug",
      label: "AR 技术验证",
    },
    {
      id: "host-live",
      path: "/host-live",
      label: "主播直播间",
    },
  ];
}
