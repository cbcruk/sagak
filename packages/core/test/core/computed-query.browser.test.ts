import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CommandRegistry, type CommandContext } from '@/core/command-registry'
import { EventBus } from '@/core/event-bus'
import { registerComputedQueries } from '@/core/commands/computed-query'

/**
 * **화면에 실제로 그려진 값**을 묻는 조회.
 *
 * 커맨드 레지스트리에 남은 마지막 DOM 층입니다. 나머지는 전부 문서 모델이
 * 답하는데 이것만 못 합니다 — 서식 없는 글의 크기는 스타일시트가 정하고,
 * 문서에는 그런 마크가 없기 때문입니다.
 *
 * 이 파일은 `native-query-font-size.browser.test.ts` 에서 살아남은 절반입니다.
 * 없어진 절반은 상태 조회(굵게·기울임…)와 1–7 스케일 변환이었습니다 —
 * 전자는 모델이 답하고 후자는 부르는 데가 없어졌습니다.
 */
describe('화면 값 조회', () => {
  let element: HTMLDivElement
  let registry: CommandRegistry

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()

    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    const ctx: CommandContext = { eventBus: new EventBus() }
    registry = new CommandRegistry(ctx)
    registerComputedQueries(registry)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  const select = (node: Node, start: number, end: number): void => {
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  /** `selectNodeContents` — 전체 선택(⌘A)과 같은 모양입니다 */
  const selectAllContents = (target: Node): void => {
    const range = document.createRange()
    range.selectNodeContents(target)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  it('계산된 글꼴을 돌려줍니다', () => {
    element.innerHTML = '<p><span style="font-family: Georgia">Hi</span></p>'
    const text = element.querySelector('span')!.firstChild!
    select(text, 0, 2)

    expect(registry.queryValue('fontName')).toContain('Georgia')
  })

  /**
   * Why: 예전 `fontSize` 는 1–7 스케일로 눌러 답해서 15px 과 16px 이 같은
   *      칸이었습니다. 그래서 손실 없는 이름(`fontSizeCss`)을 하나 더 뒀습니다.
   * How: 눌러 답할 이유가 없어졌으니 **둘이 같은 답**을 줍니다.
   */
  it('크기는 CSS 그대로 — 두 이름이 같은 답입니다', () => {
    element.innerHTML = '<p><span style="font-size: 24px">Hi</span></p>'
    const text = element.querySelector('span')!.firstChild!
    select(text, 0, 2)

    expect(registry.queryValue('fontSizeCss')).toBe('24px')
    expect(registry.queryValue('fontSize')).toBe('24px')
  })

  /**
   * ## 요소 경계에서 시작하는 범위
   *
   * `startContainer` 가 늘 내용은 아닙니다. `selectNodeContents(편집영역)` 은
   * 컨테이너가 편집 영역 `<div>` 라, 그걸 그대로 기준으로 삼으면 계산된
   * 스타일이 **편집 영역의 기본값**을 읽습니다.
   */
  describe('요소 경계에서 시작하는 범위', () => {
    it('전체 선택에서도 글자 크기를 알아야 함', () => {
      element.innerHTML = '<p><span style="font-size: 24px">Hi</span></p>'
      selectAllContents(element)

      expect(registry.queryValue('fontSizeCss'), '⌘A 에서 크기를 놓칩니다').toBe(
        '24px'
      )
    })

    it('전체 선택에서도 글꼴을 알아야 함', () => {
      element.innerHTML = '<p><span style="font-family: Georgia">Hi</span></p>'
      selectAllContents(element)

      expect(registry.queryValue('fontName')).toContain('Georgia')
    })

    /*
     * 뒤에 아무것도 없으면 **앞의 것**이 기준입니다 — 문단 끝의 캐럿이
     * 그렇습니다. 화면에서는 그 글 바로 뒤이고, 거기서 치면 그 서식으로
     * 이어집니다.
     */
    it('큰 글 바로 뒤에 커서를 두면 그 크기로 봐야 함', () => {
      element.innerHTML = '<p><span style="font-size: 24px">Hi</span></p>'
      const p = element.querySelector('p')!
      select(p, 1, 1)

      expect(registry.queryValue('fontSizeCss')).toBe('24px')
    })

    it('빈 곳에 접힌 커서에서도 터지지 않아야 함', () => {
      element.innerHTML = '<p></p>'
      const p = element.querySelector('p')!
      select(p, 0, 0)

      expect(() => registry.queryValue('fontSizeCss')).not.toThrow()
    })
  })

  /**
   * Why: 툴바나 다른 페이지에 선택이 있을 때 그 값을 문서의 값처럼 답하면
   *      안 됩니다.
   * How: 편집 가능한 조상이 없으면 `undefined` → 레지스트리가 빈 문자열
   */
  it('편집 영역 밖 선택에는 답하지 않아야 함', () => {
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)

    select(outside.firstChild!, 0, 3)

    expect(registry.queryValue('fontSizeCss')).toBe('')

    outside.remove()
  })

  it('선택이 없으면 답하지 않아야 함', () => {
    window.getSelection()?.removeAllRanges()

    expect(registry.queryValue('fontName')).toBe('')
  })
})
