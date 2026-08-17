import { useEffect, useState } from 'react'
import { useWorkspace, workspace } from '../lib/workspace-store'

export function PasswordGate() {
  const { passwordGateLabel, config } = useWorkspace()
  const [password, setPassword] = useState('')
  useEffect(() => setPassword(''), [passwordGateLabel])
  if (!passwordGateLabel) return null
  const firstUse = !config.superPassword
  return (
    <div className="template-mask">
      <form className="password-dialog" onSubmit={(event) => { event.preventDefault(); if (workspace.submitPassword(password)) setPassword('') }}>
        <header><strong>{firstUse ? '设置超级密码' : '输入超级密码'}</strong><span>{passwordGateLabel}</span></header>
        <input autoFocus type="password" value={password} placeholder={firstUse ? '设置后保存到 data/config.json' : '超级密码'} onChange={(event) => setPassword(event.target.value)} />
        <footer><button type="button" className="text-btn" onClick={() => workspace.closePasswordGate()}>取消</button><button className="primary-btn" type="submit">{firstUse ? '设置并继续' : '确认'}</button></footer>
      </form>
    </div>
  )
}
