import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",   // ← fixes the outdated JSX transform warning
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
})