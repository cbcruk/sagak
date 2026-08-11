import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { userEvent } from '@vitest/browser/context'
import { createHistoryPlugin } from '@/plugins/history-plugin'
import {
  readSelectionPositions,
  writeSelectionPositions,
} from '@/core/dom-position'

/**
 * **undo 가 캐럿을 버리는 문제입니다.**
 *
 * `history-plugin` 은 `element.innerHTML = previousState.content` 로 내용을
 * 통째로 갈아끼우고 선택은 손대지 않았습니다. 그러면 캐럿이 붙어 있던 텍스트
 * 노드가 사라지고, 브라우저는 캐럿을 **문서 맨 앞**으로 보냅니다.
 *
 * 사용자에게는 이렇게 보입니다 — undo 하고 이어서 타이핑하면 글자가 문서
 * 앞에 붙습니다.
 *
 * `spike/doc-model` 2단계의 대조군(`hello` → `<p>olleh</p>`)과 같은 실패
 * 모드이고, 키 입력마다가 아니라 undo 마다 일어나는 것뿐입니다. 자세한 것은
 * `docs/spike-to-product.md`.
 *
 * ## 왜 `selectionManager` 로는 안 되나
 *
 * `saveSelection()` 이 `range.cloneRange()` 로 **노드 참조**를 들고 있어서
 * `innerHTML` 교체를 못 견딥니다. 되돌리려 하면 예외도 없이 조용히 0 으로
 * 갑니다 (`dom-position.browser.test.ts` 의 대조군).
 *
 * 그래서 노드가 아니라 **정수 위치**로 저장합니다.
 */

type Handler = (data?: unknown) => unknown

class Bus {
  private handlers = new Map<string, Handler[]>()

  on(name: string, _phase: string, handler: Handler) {
    if (!this.handlers.has(name)) this.handlers.set(name, [])
    this.handlers.get(name)!.push(handler)
    return () => {}
  }

  emit(name: string, data?: unknown) {
    ;(this.handlers.get(name) ?? []).forEach((handler) => handler(data))
  }
}

let element: HTMLElement
let eventBus: Bus

/** 내용을 바꾸고 캐럿을 놓은 뒤 스냅샷을 남깁니다 */
function snapshot(html: string, caret: number): void {
  element.innerHTML = html
  writeSelectionPositions(element, { anchor: caret, head: caret })
  eventBus.emit('CAPTURE_SNAPSHOT')
}

beforeEach(() => {
  element = document.createElement('div')
  element.contentEditable = 'true'
  document.body.appendChild(element)
  element.focus()

  eventBus = new Bus()
  createHistoryPlugin({ debounceDelay: 50 }).initialize({
    eventBus,
    element,
  } as never)
})

afterEach(() => {
  element.remove()
})

describe('undo/redo 가 캐럿을 지킵니다', () => {
  it('undo 하면 그 상태에서 캐럿이 있던 자리로 돌아옵니다', () => {
    snapshot('<p>hello world</p>', 6) // "hello" 뒤
    snapshot('<p>hello brave world</p>', 12) // "brave" 뒤

    // 사용자가 캐럿을 다른 데로 옮깁니다
    writeSelectionPositions(element, { anchor: 18, head: 18 })

    eventBus.emit('UNDO')

    expect(element.innerHTML).toBe('<p>hello world</p>')
    expect(readSelectionPositions(element)).toEqual({ anchor: 6, head: 6 })
  })

  /** 사용자가 실제로 겪는 증상입니다 */
  it('undo 뒤에 이어서 친 글자가 문서 앞이 아니라 캐럿 자리에 들어갑니다', async () => {
    snapshot('<p>hello world</p>', 6)
    snapshot('<p>hello brave world</p>', 12)

    eventBus.emit('UNDO')
    await userEvent.keyboard('X')

    expect(element.innerHTML).toBe('<p>helloX world</p>')
    expect(element.innerHTML).not.toBe('<p>Xhello world</p>')
  })

  it('redo 도 같습니다', () => {
    snapshot('<p>hello world</p>', 6)
    snapshot('<p>hello brave world</p>', 12)

    eventBus.emit('UNDO')
    eventBus.emit('REDO')

    expect(element.innerHTML).toBe('<p>hello brave world</p>')
    expect(readSelectionPositions(element)).toEqual({ anchor: 12, head: 12 })
  })

  it('선택 영역도 되돌아옵니다', () => {
    element.innerHTML = '<p>hello world</p>'
    writeSelectionPositions(element, { anchor: 1, head: 6 })
    eventBus.emit('CAPTURE_SNAPSHOT')

    snapshot('<p>hello brave world</p>', 12)
    eventBus.emit('UNDO')

    expect(readSelectionPositions(element)).toEqual({ anchor: 1, head: 6 })
  })

  /** 표 안에서도 서야 반쪽이 아닙니다 */
  it('표 안의 캐럿도 되돌아옵니다', () => {
    const table =
      '<table><tbody><tr><td>ab</td><td>cd</td></tr></tbody></table>'
    element.innerHTML = table
    // 둘째 칸의 "c" 뒤
    const target = 9
    writeSelectionPositions(element, { anchor: target, head: target })
    const before = readSelectionPositions(element)
    eventBus.emit('CAPTURE_SNAPSHOT')

    snapshot('<p>replaced</p>', 1)
    eventBus.emit('UNDO')

    expect(element.innerHTML).toBe(table)
    expect(readSelectionPositions(element)).toEqual(before)
  })

  /**
   * 캐럿이 에디터 밖에 있을 때 스냅샷이 찍히면 저장할 위치가 없습니다.
   * 그때는 복원을 건너뛰고, **적어도 지금보다 나쁘게 만들지는 않습니다.**
   */
  it('저장된 위치가 없으면 조용히 넘어갑니다', () => {
    element.innerHTML = '<p>hello</p>'
    getSelection()?.removeAllRanges()
    eventBus.emit('CAPTURE_SNAPSHOT')

    snapshot('<p>hello world</p>', 6)

    expect(() => eventBus.emit('UNDO')).not.toThrow()
    expect(element.innerHTML).toBe('<p>hello</p>')
  })
})
