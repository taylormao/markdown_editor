import { useWorkspace } from '../lib/workspace-store'

export function YamlIssues() {
  const { yamlIssues } = useWorkspace()
  if (!yamlIssues.length) return null
  return (
    <div className="yaml-issues">
      {yamlIssues.map((issue) => (
        <p key={`${issue.field}-${issue.message}`}>
          <code>{issue.field}</code> {issue.message}
        </p>
      ))}
    </div>
  )
}
