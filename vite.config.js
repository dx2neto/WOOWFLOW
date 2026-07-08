import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const base44ApiKeyHeader = (apiKey) => ({
  name: "base44-api-key-header",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (apiKey && req.url?.startsWith("/api/")) {
        req.headers.api_key = apiKey;
      }
      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      base44ApiKeyHeader(env.BASE44_API_KEY),
      react(),
    ]
  };
});
