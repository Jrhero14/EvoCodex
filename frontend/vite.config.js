import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(process.cwd(), '../')
  const env = loadEnv(mode, envDir, '')
  return {
    envDir: '../',
    plugins: [
      react()
    ],
    server: {
      host: env.VITE_HOST || 'localhost',
      port: parseInt(env.VITE_PORT || 5173),
      allowedHosts: true,
    }
  }
})
