import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizeSnapshot, seedSnapshot, toWorkspaceFile, type WorkspaceFile } from '../src/lib/workspace-io'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const dataDir = join(root, 'data')
export const workspacePath = join(dataDir, 'workspace.json')
export const workspaceBackupPath = join(dataDir, 'workspace.backup.json')

function readSnapshot(path: string): WorkspaceFile | null {
  try {
    const normalized = normalizeSnapshot(JSON.parse(readFileSync(path, 'utf8')) as WorkspaceFile)
    return normalized ? toWorkspaceFile(normalized) : null
  } catch {
    return null
  }
}

function writeJson(path: string, value: WorkspaceFile) {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8')
  renameSync(temporary, path)
}

export function readWorkspace(): WorkspaceFile {
  mkdirSync(dataDir, { recursive: true })
  const current = readSnapshot(workspacePath)
  if (current) return current
  const backup = readSnapshot(workspaceBackupPath)
  if (backup) {
    writeJson(workspacePath, backup)
    return backup
  }
  const seed = toWorkspaceFile(seedSnapshot())
  writeJson(workspacePath, seed)
  return seed
}

export function writeWorkspace(raw: unknown): WorkspaceFile {
  const normalized = normalizeSnapshot(raw as WorkspaceFile)
  if (!normalized) throw new Error('invalid workspace')
  const file = toWorkspaceFile(normalized)
  mkdirSync(dataDir, { recursive: true })
  if (readSnapshot(workspacePath)) copyFileSync(workspacePath, workspaceBackupPath)
  writeJson(workspacePath, file)
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
