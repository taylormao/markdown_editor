#!/usr/bin/env node
/**
 * Folio 自动测试套件入口
 *
 * 一键运行全部测试：
 *   npm run test          → 单元 + 集成测试（Vitest，快速）
 *   npm run test:e2e      → E2E 测试（Playwright，真实浏览器）
 *   npm run test:all      → 先单元/集成，再 E2E
 *
 * 本脚本（node scripts/test-suite.ts --all / --unit / --e2e）：
 *   1. 检查依赖（vitest / @playwright/test / 浏览器）
 *   2. 依次执行测试
 *   3. 汇总结果并给出退出码
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const arg = process.argv[2] ?? 'all'

function run(cmd: string): boolean {
  console.log(`\n▶ ${cmd}\n`)
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
    return true
  } catch {
    return false
  }
}

function installed(name: string): boolean {
  return existsSync(join(root, 'node_modules', name))
}

console.log('══════════════════════════════════════════')
console.log('  Folio 自动测试套件')
console.log('══════════════════════════════════════════\n')

const results: { name: string; ok: boolean }[] = []

if (arg === 'all' || arg === 'unit') {
  if (!installed('vitest')) {
    console.log('✗ 缺少 vitest，请先执行: npm install')
    process.exit(1)
  }
  results.push({ name: '单元 + 集成测试 (Vitest)', ok: run('npx vitest run') })
}

if (arg === 'all' || arg === 'e2e') {
  if (!installed('@playwright/test')) {
    console.log('✗ 缺少 @playwright/test，请先执行: npm install')
    process.exit(1)
  }
  results.push({ name: 'E2E 测试 (Playwright)', ok: run('npx playwright test') })
}

console.log('\n══════════════════════════════════════════')
console.log('  测试结果汇总')
console.log('══════════════════════════════════════════')
let allOk = true
for (const r of results) {
  console.log(`  ${r.ok ? '✓ 通过' : '✗ 失败'}  ${r.name}`)
  if (!r.ok) allOk = false
}
console.log('')
process.exit(allOk ? 0 : 1)