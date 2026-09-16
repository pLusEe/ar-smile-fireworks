import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function devLanOriginForQr(): Plugin {
  return {
    name: "dev-lan-origin-for-qr",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const networkUrl = ctx.server?.resolvedUrls?.network[0];
        if (!networkUrl) return html;
        const origin = networkUrl.replace(/\/$/, "");
        const tag = `<script>window.__DEV_LAN_ORIGIN__=${JSON.stringify(origin)};</script>`;
        return html.replace("<head>", `<head>\n    ${tag}`);
      },
    },
  };
}

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
  },
  plugins: [
    devLanOriginForQr(),
    react(),
  ],
});
