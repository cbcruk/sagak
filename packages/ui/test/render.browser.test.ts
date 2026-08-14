import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  placeCaretInText,
  type MountedEditor,
} from './harness'

/**
 * `docs/selection-state.md` §8~§10 의 결론을 지킵니다.
 *
 * 서식 상태를 훅으로 들고 있으면 `isBold` 하나에 컴포넌트가 무더기로 다시
 * 그려집니다 — `Toolbar` 안이면 195개, 잎으로 내려도 14개. 여기서 재는 것은
 * 속도가 아니라 **범위**입니다. 시간은 이 규모에서 두 방식을 구분하지
 * 못합니다(§10).
 *
 * ## 재는 방법을 바꿨습니다 — 프레임워크가 아니라 DOM 을 봅니다
 *
 * 예전에는 Preact 의 `options.__r` 을 가로채 렌더 횟수를 셌습니다. 그 방식은
 * **Preact 컴포넌트에만** 걸립니다. 서식 토글을 Svelte 로 옮기자 세는 대상이
 * 사라져 검사가 곧바로 깨졌습니다.
 *
 * 되돌리기 쪽은 더 조용히 망가져 있었습니다. `HistoryButton` 을 커스텀
 * 엘리먼트로 옮긴 뒤로 **Preact 컴포넌트가 아예 없어서**
 * `expect(names.get('HistoryButton')).toBeUndefined()` 가 늘 통과했습니다 —
 * 되돌리기 버튼이 매번 다시 그려지고 있었더라도 몰랐을 검사입니다.
 *
 * 그래서 `MutationObserver` 로 **툴바의 DOM 이 실제로 얼마나 바뀌는지**를
 * 봅니다. 렌더러가 무엇이든 사용자가 보는 것은 이쪽이고, 남은 이주에서도
 * 계속 쓸 수 있습니다.
 */
interface Change {
  attr: string | null
  type: MutationRecordType
  label: string | null
  k: string | null
}

function trackMutations(root: HTMLElement): {
  changes: () => Change[]
  stop: () => void
} {
  const records: MutationRecord[] = []
  const observer = new MutationObserver((list) => records.push(...list))
  observer.observe(root, {
    subtree: true,
    attributes: true,
    childList: true,
    characterData: true,
  })

  return {
    changes: () => {
      /* 아직 전달 안 된 것까지 끌어옵니다 — 콜백은 마이크로태스크입니다 */
      records.push(...observer.takeRecords())
      return records.map((record) => {
        const element = (
          record.target.nodeType === Node.ELEMENT_NODE
            ? record.target
            : record.target.parentElement
        ) as Element | null
        return {
          attr: record.attributeName,
          type: record.type,
          label:
            element?.getAttribute('aria-label') ??
            element?.getAttribute('title') ??
            null,
          k: element?.getAttribute('k') ?? null,
        }
      })
    },
    stop: () => observer.disconnect(),
  }
}

describe('렌더 범위', () => {
  let ed: MountedEditor | null = null
  let tracker: ReturnType<typeof trackMutations> | null = null

  afterEach(() => {
    tracker?.stop()
    tracker = null
    ed?.unmount()
    ed = null
  })

  const toolbarOf = (root: HTMLElement): HTMLElement =>
    root.querySelector<HTMLElement>('[data-scope="toolbar"]')!

  const selectInside = (root: HTMLElement, selector: string): void => {
    const target = root.querySelector(selector)!
    const range = document.createRange()
    range.selectNodeContents(target)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  }

  it('평범한 캐럿 이동에는 툴바가 하나도 안 바뀌어야 함', async () => {
    ed = await mountEditor('<p>보통 글자만 있습니다</p>')
    placeCaretInText(ed.editable, 1)
    await settle(6)

    tracker = trackMutations(toolbarOf(ed.root))
    for (let i = 0; i < 10; i += 1) {
      document.dispatchEvent(new Event('selectionchange'))
      await settle(1)
    }

    expect(tracker.changes()).toEqual([])
  })

  it('서식이 바뀌면 그 토글 하나만 바뀌어야 함', async () => {
    ed = await mountEditor(
      '<p>보통 <strong>굵은</strong> <em>기울인</em> 글자</p>'
    )
    placeCaretInText(ed.editable, 1)
    await settle(6)

    tracker = trackMutations(toolbarOf(ed.root))
    selectInside(ed.editable, 'strong')
    await settle(6)

    const changes = tracker.changes()

    /*
     * 재 보면 **하나**입니다 — 굵게 토글의 `aria-pressed`. 기울임은 값이 안
     * 바뀌므로 DOM 도 안 건드리고, 정렬은 왼쪽 그대로라 마찬가지입니다.
     */
    expect(changes).toEqual([
      { type: 'attributes', attr: 'aria-pressed', label: 'Bold', k: 'toggle' },
    ])

    /* 다시 만들어진 것은 없어야 합니다 */
    expect(changes.some((c) => c.type === 'childList')).toBe(false)
  })

  it('서식이 바뀌어도 되돌리기 버튼은 건드리지 않아야 함', async () => {
    ed = await mountEditor('<p>보통 <strong>굵은</strong> 글자</p>')
    placeCaretInText(ed.editable, 1)
    await settle(6)

    tracker = trackMutations(toolbarOf(ed.root))
    selectInside(ed.editable, 'strong')
    await settle(6)

    // 서식과 히스토리는 서로 다른 소식입니다
    const touched = tracker
      .changes()
      .map((c) => c.label)
      .filter((label) => label?.startsWith('Undo') || label?.startsWith('Redo'))

    expect(touched).toEqual([])
  })
})
