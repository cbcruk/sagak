import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  placeCaretInText,
  selectAll,
  type MountedEditor,
} from './harness'

/**
 * `docs/selection-state.md` 의 측정을 테스트로 고정합니다.
 *
 * ## 재는 것이 뒤집혔습니다
 *
 * 예전 이 파일은 **`window.getSelection()` 을 몇 번 부르는가**를 셌습니다.
 * 여섯 곳이 같은 세 소스를 각자 구독하고 가드가 제각각이던 것을 한 자리로
 * 모았고, 그 통합이 되돌아가면 횟수가 늘어나 잡히는 구조였습니다.
 *
 * 이제는 **한 번도 안 부르는 것**이 맞습니다. 툴바가 보는 것은 문서 상태이고,
 * DOM 선택은 `prosemirror-view` 안쪽 사정입니다. 그래서 상한이 아니라
 * **0** 을 못 박습니다 — 누군가 DOM 을 다시 걷기 시작하면 여기서 걸립니다.
 *
 * `docs/prosemirror-migration.md` 4단계.
 */
describe('선택 영역 추적', () => {
  let ed: MountedEditor | null = null
  let original: typeof window.getSelection | null = null

  afterEach(() => {
    if (original) {
      window.getSelection = original
      original = null
    }
    ed?.unmount()
    ed = null
  })

  async function countSelectionReads(run: () => Promise<void>): Promise<number> {
    original = window.getSelection.bind(window)
    let calls = 0
    window.getSelection = () => {
      calls += 1
      return original!()
    }
    await run()
    window.getSelection = original
    original = null
    return calls
  }

  const fireSelectionChange = async (times: number): Promise<void> => {
    for (let i = 0; i < times; i += 1) {
      document.dispatchEvent(new Event('selectionchange'))
      await settle(1)
    }
  }

  it('캐럿이 움직여도 DOM 선택을 훑지 않아야 함', async () => {
    ed = await mountEditor('<p>안녕하세요</p>')
    placeCaretInText(ed.editable, 2)
    await settle(4)

    const reads = await countSelectionReads(() => fireSelectionChange(10))

    /*
     * 통합 전 21회/이벤트 → 상태 층 통합 뒤 18회 → 지금 **0회**.
     *
     * 18 이 남아 있던 이유는 코어의 서식 추적이 매 `selectionchange` 마다
     * `queryState` 여섯을 돌렸고 그 바닥이 `document.queryCommandState` 였기
     * 때문입니다. 그 조회가 모델로 옮겨가면서 통째로 없어졌습니다.
     */
    expect(reads).toBe(0)
  })

  it('한글 조합 중에도 아무것도 훑지 않아야 함', async () => {
    ed = await mountEditor('<p>안녕하세요</p>')
    placeCaretInText(ed.editable, 2)
    await settle(4)

    const reads = await countSelectionReads(async () => {
      ed!.editable.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true })
      )
      await fireSelectionChange(10)
      ed!.editable.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true })
      )
      await settle(2)
    })

    /*
     * 예전에는 **IME 가드가 있어서** 0 이었습니다. 지금은 가드가 없는데도
     * 0 입니다 — 볼 이유가 없어졌기 때문입니다. 같은 숫자지만 이유가
     * 다릅니다.
     */
    expect(reads).toBe(0)
  })

  /**
   * Why: 툴바 버튼이나 드롭다운을 누르면 선택이 에디터를 떠납니다. 예전에는
   *      그때 읽은 값이 엉뚱해서 "에디터 밖이면 건너뜀" 가드가 필요했습니다.
   * How: 이제 툴바가 보는 것은 문서 상태라 선택이 어디 있든 답이 같습니다.
   */
  it('선택이 에디터 밖으로 나가도 툴바 표시가 안 흔들려야 함', async () => {
    ed = await mountEditor('<p><strong>굵은 글</strong></p>')
    selectAll(ed.editable)
    await settle(4)

    const bold = ed.root.querySelector<HTMLElement>(
      'button[aria-label="Bold"]'
    )!
    expect(bold.getAttribute('aria-pressed')).toBe('true')

    // 에디터 밖(문서 body)에 선택을 둡니다 — 툴바 버튼을 눌렀을 때와 같은 상황
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)

    const range = document.createRange()
    range.selectNodeContents(outside)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    await fireSelectionChange(3)

    // Then: 굵게 표시가 그대로여야 합니다
    expect(bold.getAttribute('aria-pressed')).toBe('true')

    outside.remove()
  })
})
