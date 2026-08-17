export type FolioConfig = {
  superPassword: string
}

const defaults: FolioConfig = { superPassword: '' }

export async function loadConfig(): Promise<FolioConfig> {
  try {
    const response = await fetch('/api/config')
    if (!response.ok) return defaults
    const parsed = (await response.json()) as Partial<FolioConfig>
    return { superPassword: typeof parsed.superPassword === 'string' ? parsed.superPassword : '' }
  } catch {
    return defaults
  }
}

export async function saveConfig(config: FolioConfig): Promise<void> {
  await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}
