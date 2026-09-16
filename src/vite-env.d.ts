/// <reference types="vite/client" />

interface DesagentRouteNode {
  id: string;
  path: string;
  label?: string;
  children?: DesagentRouteNode[];
}

interface Window {
  __DESAGENT_ROUTES__?: DesagentRouteNode[];
}
