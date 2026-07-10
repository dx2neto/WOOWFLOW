import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const base44ApiKeyHeader = (apiKey) => ({
  name: "base44-api-key-header",
  enforce: "pre",
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
    build: {
      // Divide bibliotecas pesadas em chunks separados para reduzir o bundle
      // inicial e melhorar o cache do navegador.
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-charts": ["recharts"],
            "vendor-motion": ["framer-motion"],
          },
        },
      },
    },
    server: env.VITE_BASE44_APP_BASE_URL ? {
      proxy: {
        "/b44": {
          target: env.VITE_BASE44_APP_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/b44/, ""),
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq) => {
              if (env.BASE44_API_KEY) {
                proxyReq.setHeader("api_key", env.BASE44_API_KEY);
              }
            });
          },
        },
        "/api": {
          target: env.VITE_BASE44_APP_BASE_URL,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (proxyReq) => {
              if (env.BASE44_API_KEY) {
                proxyReq.setHeader("api_key", env.BASE44_API_KEY);
              }
            });
          },
        },
      },
    } : undefined,
    plugins: [
      base44ApiKeyHeader(env.BASE44_API_KEY),
      base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      react(),
    ]
  };
});
