import { describe, it, expect, afterEach } from 'vitest'
import { mountEditor, settle, placeCaretInText, type MountedEditor } from './harness'

/**
 * `docs/selection-state.md` 의 측정을 테스트로 고정합니다.
 *
 * 여섯 곳이 같은 세 소스를 각자 구독하고 가드가 제각각이던 것을
 * `useSelectionDerived` 하나로 모았습니다. 되돌아가면 여기서 잡힙니다.
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

  /** 각 파생 함수는 `window.getSelection()` 으로 시작하므로 호출 수를 지표로 씁니다 */
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

  it('캐럿이 움직일 때 선택 영역을 훑는 횟수가 제한되어야 함', async () => {
    ed = await mountEditor('<p>안녕하세요</p>')
    placeCaretInText(ed.editable, 2)
    await settle(4)

    const perEvent =
      (await countSelectionReads(() => fireSelectionChange(10))) / 10

    /*
     * 통합 전 21회 -> 지금 18회. 크게 줄지 않은 이유는 남은 대부분이 core 의
     * 서식 추적(`CommandRegistry.queryState/queryValue`)이기 때문입니다 —
     * 굵게·기울임 등을 매번 조회합니다. 1단계는 UI 쪽만 건드렸습니다.
     *
     * UI 쪽에서 줄어든 것은 가드입니다. 이전에는 구독자마다 각자
     * `isSelectionInEditor` 를 돌렸고, 지금은 추적기 한 곳에서만 돕니다.
     * 여섯 벌로 되돌아가면 이 상한을 넘습니다.
     */
    expect(perEvent).toBeLessThanOrEqual(19)
  })

  it('한글 조합 중에는 아무것도 훑지 않아야 함', async () => {
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
     * 통합 전에는 가드 없는 다섯 구독자가 이벤트당 8회씩 훑었습니다.
     * 이제 IME 가드가 추적기 한 곳에 있으므로 **UI 는 아무것도 하지 않습니다.**
     *
     * 남는 것은 core 의 `wysiwyg-area` 핸들러 하나(이벤트당 1회)입니다.
     * 그건 core 의 사정이라 1단계에서 건드리지 않았습니다.
     */
    expect(reads / 10).toBeLessThanOrEqual(1)
  })

  it('선택이 에디터 밖이면 파생을 다시 계산하지 않아야 함', async () => {
    ed = await mountEditor('<p>바깥 선택</p>')
    placeCaretInText(ed.editable, 1)
    await settle(4)

    // 에디터 밖(문서 body)에 선택을 둡니다 — 툴바 버튼을 눌렀을 때와 같은 상황
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)

    const reads = await countSelectionReads(async () => {
      const range = document.createRange()
      range.selectNodeContents(outside)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      await fireSelectionChange(10)
    })

    outside.remove()

    /*
     * 범위 확인이 통과하지 못하므로 UI 파생 함수는 하나도 돌지 않습니다.
     * 남는 것은 추적기 자신의 확인과 core 쪽 호출입니다.
     */
    expect(reads / 10).toBeLessThanOrEqual(4)
  })
})
