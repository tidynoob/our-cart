import '@testing-library/jest-dom'

// Web Storage shim for the test environment.
//
// Node 22+ ships an experimental built-in `localStorage` global that returns
// `undefined` unless launched with `--localstorage-file`. Under Node 26 this
// getter-only accessor leaves `window.localStorage` / the bare `localStorage`
// global `undefined` even under jsdom, so any test (or persist-backed store like
// preferencesStore) touching `localStorage` throws. Install a deterministic
// in-memory Storage implementation on the global so Web Storage is available and
// resets cleanly between tests.
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

for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  })
}

// jsdom does not implement PointerEvent, so Testing Library's fireEvent.pointer*
// cannot carry clientX/pointerId onto the React synthetic event. Polyfill a
// minimal PointerEvent on top of MouseEvent (which already carries clientX/buttons)
// so the hand-rolled swipe handlers in ItemRow receive real coordinates under test.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number
    pointerType: string
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.pointerType = params.pointerType ?? ''
    }
  }
  // @ts-expect-error — assigning the polyfill to the global PointerEvent
  window.PointerEvent = PointerEventPolyfill
  // Element.setPointerCapture / releasePointerCapture are also absent in jsdom.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
}
