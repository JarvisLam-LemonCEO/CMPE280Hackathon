import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function localApiPlugin() {
  return {
    name: "local-api",
    configureServer(server) {
      const routes = {
        "/api/openai-compose": () => import("./api/openai-compose.js"),
        "/api/huggingface-style": () => import("./api/huggingface-style.js"),
      };

      Object.entries(routes).forEach(([route, loadHandler]) => {
        server.middlewares.use(route, async (req, res) => {
          const { default: handler } = await loadHandler();
          await handler(req, res);
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
    optimizeDeps: {
      exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
    },
  };
});
