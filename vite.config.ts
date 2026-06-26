import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    base: '/Lumber_Builder/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      port: 3010,
      watch: {
        // Avoid watching node_modules — reduces file watcher pressure
        ignored: ["**/node_modules/**", "**/dist/**"],
      },
    },
  };
});
