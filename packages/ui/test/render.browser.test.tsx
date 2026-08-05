import { describe, it, expect, afterEach } from 'vitest'
import { options } from 'preact'
import {
  mountEditor,
  settle,
  placeCaretInText,
  type MountedEditor,
} from './harness'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * `docs/selection-state.md` §8~§10 의 결론을 지킵니다.
 *
 * 서식 상태를 훅으로 들고 있으면 `isBold` 하나에 컴포넌트가 무더기로 다시
 * 그려집니다 — `Toolbar` 안이면 195개, 잎으로 내려도 14개. 신호로 두면 값이
 * 바뀐 것만 그립니다.
 *
 * 여기서 재는 것은 속도가 아니라 **범위**입니다. 시간은 이 규모에서 두 방식을
 * 구분하지 못합니다(§10).
 */
function trackRenders() {
  const names = new Map<string, number>()
  let total = 0
  const prev = (options as any).__r
  ;(options as any).__r = (vnode: any) => {
    total += 1
    const type = vnode.type
    if (typeof type === 'function') {
      const name = type.name || '?'
      names.set(name, (names.get(name) ?? 0) + 1)
    }
    prev?.(vnode)
  }
  return {
    names,
    get total() {
      return total
    },
    reset: () => {
      total = 0
      names.clear()
    },
    stop: () => {
      ;(options as any).__r = prev
    },
  }
}

describe('렌더 범위', () => {
  let ed: MountedEditor | null = null
  let tracker: ReturnType<typeof trackRenders> | null = null

  afterEach(() => {
    tracker?.stop()
    tracker = null
    ed?.unmount()
    ed = null
  })

  const selectInside = (root: HTMLElement, selector: string): void => {
    const target = root.querySelector(selector)!
    const range = document.createRange()
    range.selectNodeContents(target)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }

  it('평범한 캐럿 이동에는 아무것도 다시 그리지 않아야 함', async () => {
    ed = await mountEditor('<p>보통 글자만 있습니다</p>')
    placeCaretInText(ed.editable, 1)
    await settle(6)

    tracker = trackRenders()
    for (let i = 0; i < 10; i += 1) {
      document.dispatchEvent(new Event('selectionchange'))
      await settle(1)
    }

    expect(tracker.total).toBe(0)
  })

  it('서식이 바뀌면 값이 바뀐 토글만 다시 그려야 함', async () => {
    ed = await mountEditor(
      '<p>보통 <strong>굵은</strong> <em>기울인</em> 글자</p>'
    )
    placeCaretInText(ed.editable, 1)
    await settle(6)

    tracker = trackRenders()
    selectInside(ed.editable, 'strong')
    await settle(4)

    /*
     * 훅 방식이었다면 `FormatToggles` 하나가 그려지며 토글 4개와 아이콘 4개를
     * 전부 끌고 가 14개였습니다. 신호는 굵게/기울임 두 개만 그립니다.
     *
     * `.value` 를 `FormatToggles` 안(부모)에서 읽도록 되돌리면 여기서 잡힙니다.
     */
    expect(tracker.total).toBeLessThanOrEqual(8)

    const toggles = tracker.names.get('FormatToggle') ?? 0
    expect(toggles).toBeGreaterThan(0)
    expect(toggles).toBeLessThanOrEqual(4)

    // 툴바 전체가 딸려오면 안 됩니다
    expect(tracker.names.get('Toolbar')).toBeUndefined()
    expect(tracker.names.get('FormatToggles')).toBeUndefined()
  })

  it('서식이 바뀌어도 되돌리기 버튼은 건드리지 않아야 함', async () => {
    ed = await mountEditor('<p>보통 <strong>굵은</strong> 글자</p>')
    placeCaretInText(ed.editable, 1)
    await settle(6)

    tracker = trackRenders()
    selectInside(ed.editable, 'strong')
    await settle(4)

    // 서식과 히스토리는 서로 다른 신호입니다
    expect(tracker.names.get('HistoryButton')).toBeUndefined()
    expect(tracker.names.get('HistoryButtons')).toBeUndefined()
  })
})
