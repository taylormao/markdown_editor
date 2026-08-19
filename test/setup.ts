// Vitest 全局 setup：Node 26 的实验性 localStorage 会遮蔽 jsdom 的 localStorage，
// 这里提供轻量内存实现，满足 storage.ts（getItem/setItem）与测试的需求。
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  })
}
if (typeof globalThis.window !== 'undefined' && typeof (globalThis.window as Window & { localStorage?: Storage }).localStorage === 'undefined') {
  Object.defineProperty(globalThis.window, 'localStorage', {
    value: globalThis.localStorage,
    writable: true,
    configurable: true,
  })
}