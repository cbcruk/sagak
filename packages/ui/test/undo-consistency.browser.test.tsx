import { describe, it, expect, afterEach } from 'vitest'
import {
  mountEditor,
  settle,
  selectAll,
  click,
  button,
  type MountedEditor,
} from './harness'

/**
 * undo/redo 직후 툴바가 코어와 어긋난 채로 **한 프레임 그려지던** 문제.
 *
 * 원인은 발행 시점이 갈린 것이었습니다 —
 *
 * ```
 * CONTENT_RESTORED             문서는 이미 되돌아감
 * HISTORY_STATE_CHANGED        동기 → canUndo 신호 변경
 * 커밋 [HistoryButton]         화면=굵게 코어=보통
 * ===== 프레임 경계 =====      ← 여기서 어긋난 채로 페인트
 * FORMATTING_STATE_CHANGED     rAF 뒤
 * 커밋 [FormatToggle]          교정
 * ```
 *
 * 히스토리는 동기인데 서식만 rAF 뒤라 사이에 페인트가 끼었습니다. undo/redo 를
 * "한 번에 끝나는 동작" 으로 보고 서식도 같은 틱에 발행하게 하니, 두 커밋이
 * 첫 페인트 전에 끝납니다.
 *
 * ## 재는 법
 *
 * **커밋 횟수로는 안 잡힙니다** — preact 는 컴포넌트마다 `commitRoot` 를
 * 부르므로 고치기 전후 모두 2회입니다. 재야 하는 것은 그 사이에 **프레임
 * 경계가 끼는지**이고, 그래서 첫 `requestAnimationFrame` 시점의 화면을 봅니다.
 *
 * 판정 기준은 **코어가 말하는 상태**입니다. "문서에 `<strong>` 이 있는가" 로
 * 보면 안 됩니다 — 캐럿이 그 밖에 있으면 툴바가 꺼져 있는 것이 맞기 때문에,
 * redo 에서 그 기준이 거짓 실패를 냅니다.
 */
describe('undo/redo 직후 표시 일관성', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  /**
   * 클릭한 태스크의 **마이크로태스크가 끝난 직후** 를 찍습니다.
   *
   * 이 시점의 DOM 이 이번 프레임에 그려집니다. `requestAnimationFrame` 으로
   * 재면 안 됩니다 — 코어가 클릭 중에 등록한 rAF 가 테스트 것보다 먼저
   * 돌아서, 이미 교정된 뒤를 보게 되어 **고치기 전에도 통과합니다.**
   * (실제로 그렇게 만들었다가 컨트롤이 통과해 잡았습니다.)
   */
  const clickAndSamplePaintedFrame = async (
    el: HTMLElement,
    sample: () => { 화면: boolean; 코어: boolean }
  ): Promise<{ 화면: boolean; 코어: boolean }> => {
    el.click()
    // preact 는 렌더를 마이크로태스크로 미룹니다 — 다 비워냅니다
    for (let i = 0; i < 5; i += 1) await Promise.resolve()
    return sample()
  }

  const makeSnap =
    (e: MountedEditor) =>
    (): {
      화면: boolean
      코어: boolean
    } => ({
      화면:
        e.root
          .querySelector('button[aria-label="Bold"]')!
          .getAttribute('aria-pressed') === 'true',
      코어: !!e.context.commandRegistry?.queryState('bold'),
    })

  it('undo 한 뒤 첫 프레임에서 툴바가 코어와 일치해야 함', async () => {
    ed = await mountEditor('<p>hello world</p>')
    selectAll(ed.editable)
    await settle(6)

    await click(button(ed.root, 'Bold (⌘B)'))
    await settle(6)

    const snap = makeSnap(ed)
    expect(snap()).toEqual({ 화면: true, 코어: true })

    const first = await clickAndSamplePaintedFrame(
      button(ed.root, 'Undo (⌘Z)'),
      snap
    )

    expect(first.코어, 'undo 로 굵기가 풀려야 합니다').toBe(false)
    expect(first.화면, '툴바가 코어보다 한 프레임 뒤처졌습니다').toBe(false)
  })

  /**
   * **이 테스트는 이번 수정을 판별하지 못합니다.** 수정을 되돌려도 통과합니다 —
   * redo 경로에는 지연이 관찰되지 않았습니다. 그래도 같은 불변식을 지키므로
   * 앞으로 redo 쪽이 깨지면 여기서 걸립니다. 판별력을 가진 것은 위 undo
   * 테스트 하나입니다.
   */
  it('redo 도 마찬가지여야 함', async () => {
    ed = await mountEditor('<p>hello world</p>')
    selectAll(ed.editable)
    await settle(6)
    await click(button(ed.root, 'Bold (⌘B)'))
    await settle(6)
    await click(button(ed.root, 'Undo (⌘Z)'))
    await settle(6)

    const snap = makeSnap(ed)
    const first = await clickAndSamplePaintedFrame(
      button(ed.root, 'Redo (⌘⇧Z)'),
      snap
    )

    expect(first.화면, '툴바가 코어보다 한 프레임 뒤처졌습니다').toBe(
      first.코어
    )
  })
})
