import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '../../');
  const env = loadEnv(mode, rootDir, '');

  // process.env wins over the .env file: under `sst dev` SST injects the live
  // Lambda Function URL into the process, and the checked-in .env value
  // (http://localhost:4000) must not shadow it. Falls back to the .env file for
  // `npm run dev`, then to the local node server.
  const targetApi = process.env.VITE_API_URL || env.VITE_API_URL || 'http://localhost:4000';

  return {
    plugins: [react()],
    envDir: rootDir,
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: targetApi,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});
