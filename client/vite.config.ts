import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared/src"), // Alias for shared package
    },
  },
  server: {
    proxy: {
      // Proxy API requests to the backend server during development
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true,
        // secure: false, // Uncomment if backend uses self-signed SSL cert
        // rewrite: (path) => path.replace(/^\/api/, ''), // Optional: remove /api prefix if backend doesn't expect it
      },
    },
    port: 5173, // Ensure this matches CORS_ORIGIN in server/.env
  },
});

