import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handleWorkspaceApi } from './server/workspace'
import { handleConfigApi } from './server/config'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'folio-workspace',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void handleConfigApi(req, res).then((configHit) => {
            if (configHit) return
            void handleWorkspaceApi(req, res).then((workspaceHit) => {
              if (!workspaceHit) next()
            })
          })
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          void handleConfigApi(req, res).then((configHit) => {
            if (configHit) return
            void handleWorkspaceApi(req, res).then((workspaceHit) => {
              if (!workspaceHit) next()
            })
          })
        })
      },
    },
  ],
})
