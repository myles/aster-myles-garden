import { defineConfig } from "vite";

// Vite's default SPA fallback answers every unknown path with index.html
// and a 200. Serve the build as a multi-page app instead so missing routes
// 404, as they do on Vercel.
export default defineConfig({
  appType: "mpa",
});
