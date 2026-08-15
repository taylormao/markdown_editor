export type CodeLanguage = {
  id: string
  title: string
  fence: string
  aliases: string[]
}

export const codeLanguages: CodeLanguage[] = [
  { id: 'plain', title: '纯文本', fence: '', aliases: ['text', 'plain', 'txt'] },
  { id: 'c', title: 'C', fence: 'c', aliases: ['c'] },
  { id: 'cpp', title: 'C++', fence: 'cpp', aliases: ['c++', 'cpp', 'cxx'] },
  { id: 'csharp', title: 'C#', fence: 'csharp', aliases: ['c#', 'cs', 'csharp'] },
  { id: 'java', title: 'Java', fence: 'java', aliases: ['java'] },
  { id: 'python', title: 'Python', fence: 'python', aliases: ['py', 'python'] },
  { id: 'javascript', title: 'JavaScript', fence: 'js', aliases: ['js', 'javascript'] },
  { id: 'typescript', title: 'TypeScript', fence: 'ts', aliases: ['ts', 'typescript'] },
  { id: 'go', title: 'Go', fence: 'go', aliases: ['go', 'golang'] },
  { id: 'rust', title: 'Rust', fence: 'rust', aliases: ['rs', 'rust'] },
  { id: 'swift', title: 'Swift', fence: 'swift', aliases: ['swift'] },
  { id: 'kotlin', title: 'Kotlin', fence: 'kotlin', aliases: ['kt', 'kotlin'] },
  { id: 'ruby', title: 'Ruby', fence: 'ruby', aliases: ['rb', 'ruby'] },
  { id: 'php', title: 'PHP', fence: 'php', aliases: ['php'] },
  { id: 'html', title: 'HTML', fence: 'html', aliases: ['html'] },
  { id: 'css', title: 'CSS', fence: 'css', aliases: ['css'] },
  { id: 'json', title: 'JSON', fence: 'json', aliases: ['json'] },
  { id: 'yaml', title: 'YAML', fence: 'yaml', aliases: ['yml', 'yaml'] },
  { id: 'xml', title: 'XML', fence: 'xml', aliases: ['xml'] },
  { id: 'markdown', title: 'Markdown', fence: 'md', aliases: ['md', 'markdown'] },
  { id: 'sql', title: 'SQL', fence: 'sql', aliases: ['sql'] },
  { id: 'shell', title: 'Shell', fence: 'bash', aliases: ['sh', 'shell', 'bash', 'zsh'] },
  { id: 'powershell', title: 'PowerShell', fence: 'powershell', aliases: ['ps', 'ps1', 'powershell'] },
  { id: 'dockerfile', title: 'Dockerfile', fence: 'dockerfile', aliases: ['docker', 'dockerfile'] },
  { id: 'lua', title: 'Lua', fence: 'lua', aliases: ['lua'] },
  { id: 'r', title: 'R', fence: 'r', aliases: ['r'] },
  { id: 'scala', title: 'Scala', fence: 'scala', aliases: ['scala'] },
  { id: 'dart', title: 'Dart', fence: 'dart', aliases: ['dart'] },
  { id: 'haskell', title: 'Haskell', fence: 'haskell', aliases: ['hs', 'haskell'] },
  { id: 'elixir', title: 'Elixir', fence: 'elixir', aliases: ['ex', 'elixir'] },
]

export function filterLanguages(query: string): CodeLanguage[] {
  const q = query.trim().toLowerCase()
  if (!q) return codeLanguages
  return codeLanguages.filter((lang) => {
    const hay = `${lang.title} ${lang.id} ${lang.fence} ${lang.aliases.join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
}
