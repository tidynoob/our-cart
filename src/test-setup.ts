import '@testing-library/jest-dom'

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
