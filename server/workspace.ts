import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizeSnapshot, seedSnapshot, toWorkspaceFile, type WorkspaceFile } from '../src/lib/workspace-io'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const dataDir = join(root, 'data')
export const workspacePath = join(dataDir, 'workspace.json')

function ensureFile() {
  mkdirSync(dataDir, { recursive: true })
  try {
    readFileSync(workspacePath, 'utf8')
  } catch {
    writeFileSync(workspacePath, JSON.stringify(toWorkspaceFile(seedSnapshot()), null, 2), 'utf8')
  }
}

export function readWorkspace(): WorkspaceFile {
  ensureFile()
  try {
    const parsed = JSON.parse(readFileSync(workspacePath, 'utf8')) as WorkspaceFile
    const normalized = normalizeSnapshot(parsed)
    if (normalized) return toWorkspaceFile(normalized)
  } catch {
    /* rewrite seed */
  }
  const seed = toWorkspaceFile(seedSnapshot())
  writeFileSync(workspacePath, JSON.stringify(seed, null, 2), 'utf8')
  return seed
}

export function writeWorkspace(raw: unknown): WorkspaceFile {
  const normalized = normalizeSnapshot(raw as WorkspaceFile)
  if (!normalized) throw new Error('invalid workspace')
  const file = toWorkspaceFile(normalized)
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(workspacePath, JSON.stringify(file, null, 2), 'utf8')
  return file
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

export async function handleWorkspaceApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? ''
  if (!url.startsWith('/api/workspace')) return false

  if (req.method === 'GET') {
    send(res, 200, readWorkspace())
    return true
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as unknown
      send(res, 200, writeWorkspace(body))
    } catch {
      send(res, 400, { error: 'invalid workspace' })
    }
    return true
  }

  send(res, 405, { error: 'method not allowed' })
  return true
}
