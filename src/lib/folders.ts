import type { Folder } from '../types'

export function childFolders(folders: Folder[], parentId: string | null): Folder[] {
  return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

export function folderDepth(folders: Folder[], id: string): number {
  let depth = 0
  let current = folders.find((folder) => folder.id === id)
  const seen = new Set<string>()
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id)
    depth += 1
    current = folders.find((folder) => folder.id === current?.parentId)
  }
  return depth
}

export function flattenFolders(folders: Folder[], parentId: string | null = null): Folder[] {
  return childFolders(folders, parentId).flatMap((folder) => [folder, ...flattenFolders(folders, folder.id)])
}
