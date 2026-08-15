import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleWorkspaceApi } from './server/workspace'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'folio-workspace',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void handleWorkspaceApi(req, res).then((hit: boolean) => {
            if (!hit) next()
          })
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          void handleWorkspaceApi(req, res).then((hit: boolean) => {
            if (!hit) next()
          })
        })
      },
    },
  ],
})
