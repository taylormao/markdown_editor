import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

export type FolioConfig = {
  superPassword: string
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')
const configPath = join(dataDir, 'config.json')
const defaults: FolioConfig = { superPassword: '' }

function writeConfig(config: FolioConfig): FolioConfig {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
  return config
}

function readConfig(): FolioConfig {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<FolioConfig>
    return { superPassword: typeof parsed.superPassword === 'string' ? parsed.superPassword : '' }
  } catch {
    return writeConfig(defaults)
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export async function handleConfigApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!(req.url ?? '').startsWith('/api/config')) return false
  if (req.method === 'GET') {
    send(res, 200, readConfig())
    return true
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    try {
      const parsed = JSON.parse(await readBody(req)) as Partial<FolioConfig>
      if (typeof parsed.superPassword !== 'string') throw new Error('invalid config')
      send(res, 200, writeConfig({ superPassword: parsed.superPassword }))
    } catch {
      send(res, 400, { error: 'invalid config' })
    }
    return true
  }
  send(res, 405, { error: 'method not allowed' })
  return true
}
