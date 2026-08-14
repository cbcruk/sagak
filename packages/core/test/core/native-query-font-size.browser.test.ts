import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CommandRegistry,
  type CommandContext,
} from '@/core/command-registry'
import { registerNativeQueries } from '@/core/commands/native-query'
import {
  registerNativeFontSize,
  legacyFontSizeToCss,
  cssToLegacyFontSize,
} from '@/core/commands/native-font-size'
import { registerNativeInlineToggles } from '@/core/commands/native-inline-toggles'
import { registerLegacyExecCommands } from '@/core/legacy-exec-command'
import { EventBus } from '@/core/event-bus'

/**
 * 네이티브 상태·값 조회 / fontSize 테스트
 *
 * Why: queryCommandState/queryCommandValue와 fontSize의 execCommand 의존 제거 검증
 * How: 조상 탐색 기반 상태 조회와 1-7 ↔ CSS 매핑을 DOM 기준으로 확인
 */
describe('native queries & fontSize', () => {
  let element: HTMLDivElement
  let registry: CommandRegistry

  const select = (node: Node, start: number, end: number) => {
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()

    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    const ctx: CommandContext = { eventBus: new EventBus() }
    registry = new CommandRegistry(ctx)
    registerNativeQueries(registry)
    registerNativeFontSize(registry)
    registerNativeInlineToggles(registry)
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  describe('1-7 스케일 ↔ CSS 매핑', () => {
    it('레거시 스케일을 px로 변환해야 함', () => {
      expect(legacyFontSizeToCss(1)).toBe('10px')
      expect(legacyFontSizeToCss(3)).toBe('16px')
      expect(legacyFontSizeToCss(7)).toBe('48px')
      expect(legacyFontSizeToCss(8)).toBeNull()
    })

    it('CSS 크기를 가장 가까운 스케일로 되돌려야 함', () => {
      expect(cssToLegacyFontSize('16px')).toBe('3')
      expect(cssToLegacyFontSize('24px')).toBe('5')
      // 정확히 일치하지 않으면 가장 가까운 단계
      expect(cssToLegacyFontSize('19px')).toBe('4')
      expect(cssToLegacyFontSize('11px')).toBe('1')
      expect(cssToLegacyFontSize('')).toBe('')
    })
  })

  describe('fontSize 커맨드', () => {
    it('1-7 스케일을 CSS로 적용해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = element.querySelector('p')!.firstChild as Text
      select(text, 0, 5)

      expect(registry.run('fontSize', '5')).toBe(true)
      expect(
        (element.querySelector('span') as HTMLElement).style.fontSize
      ).toBe('24px')
    })

    it('CSS 값도 직접 받아야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = element.querySelector('p')!.firstChild as Text
      select(text, 0, 5)

      expect(registry.run('fontSize', '20px')).toBe(true)
      expect(
        (element.querySelector('span') as HTMLElement).style.fontSize
      ).toBe('20px')
    })

    it('알 수 없는 값은 레거시로 위임해야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = element.querySelector('p')!.firstChild as Text
      select(text, 0, 5)

      const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
      registerLegacyExecCommands(registry)

      expect(registry.run('fontSize', 'huge')).toBe(true)
      expect(execSpy).toHaveBeenCalledWith('fontSize', false, 'huge')
    })
  })

  describe('상태 조회 (조상 탐색)', () => {
    it('정규 태그 안에서 활성으로 판단해야 함', () => {
      element.innerHTML = '<p><strong>Hello</strong></p>'
      const text = element.querySelector('strong')!.firstChild as Text
      select(text, 1, 3)

      expect(registry.queryState('bold')).toBe(true)
      expect(registry.queryState('italic')).toBe(false)
    })

    it('별칭 태그(b)도 인식해야 함', () => {
      element.innerHTML = '<p><b>Hello</b></p>'
      const text = element.querySelector('b')!.firstChild as Text
      select(text, 0, 2)

      expect(registry.queryState('bold')).toBe(true)
    })

    it('collapsed 커서에서도 조상 서식을 인식해야 함', () => {
      element.innerHTML = '<p><em>Hello</em></p>'
      const text = element.querySelector('em')!.firstChild as Text
      select(text, 2, 2)

      expect(registry.queryState('italic')).toBe(true)
    })

    it('서식 밖에서는 비활성이어야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = element.querySelector('p')!.firstChild as Text
      select(text, 0, 5)

      expect(registry.queryState('bold')).toBe(false)
    })

    it('토글 적용 후 상태가 반영되어야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      const text = element.querySelector('p')!.firstChild as Text
      select(text, 0, 5)

      registry.run('bold')
      expect(registry.queryState('bold')).toBe(true)
    })

    it('편집 영역 밖 선택은 레거시로 위임해야 함', () => {
      const outside = document.createElement('p')
      outside.textContent = 'outside'
      document.body.appendChild(outside)
      select(outside.firstChild!, 0, 3)

      const spy = vi.spyOn(document, 'queryCommandState').mockReturnValue(true)
      registerLegacyExecCommands(registry)

      expect(registry.queryState('bold')).toBe(true)
      expect(spy).toHaveBeenCalledWith('bold')

      document.body.removeChild(outside)
    })
  })

  describe('값 조회', () => {
    it('fontName은 계산된 글꼴을 반환해야 함', () => {
      element.innerHTML = '<p><span style="font-family: Georgia">Hi</span></p>'
      const text = element.querySelector('span')!.firstChild as Text
      select(text, 0, 2)

      expect(registry.queryValue('fontName')).toContain('Georgia')
    })

    it('fontSize는 1-7 스케일 문자열을 반환해야 함(레거시 호환)', () => {
      element.innerHTML = '<p><span style="font-size: 24px">Hi</span></p>'
      const text = element.querySelector('span')!.firstChild as Text
      select(text, 0, 2)

      expect(registry.queryValue('fontSize')).toBe('5')
    })
  })

  /**
   * ## 요소 경계에서 시작하는 범위 (⌘A)
   *
   * 위의 검사들은 전부 **텍스트 노드**를 골라 놓고 묻습니다. 그러면
   * `startContainer` 가 곧 내용이라 조상 탐색이 바로 먹습니다.
   *
   * 전체 선택은 다릅니다. `selectNodeContents(편집영역)` 이라
   * `startContainer` 가 편집 영역 `<div>` 이고, 첫 글자는
   * `childNodes[startOffset]` **안**에 있습니다. 그걸 그대로 기준으로 삼으면
   * 탐색이 내용을 건너뛰고 위로 올라갑니다.
   *
   * 재 봤던 값입니다 — 네이티브 API 는 맞히는데 우리 것만 틀렸습니다.
   *
   * | 선택 | `queryState('bold')` | `queryCommandState` |
   * | --- | --- | --- |
   * | 캐럿·드래그 | `true` | `true` |
   * | ⌘A | **`false`** | `true` |
   *
   * 툴바에서는 굵은 글을 전부 고른 채로 굵게 버튼이 꺼져 보이고, 글자 크기가
   * 실제와 다르게 나옵니다.
   */
  describe('요소 경계에서 시작하는 범위', () => {
    /** `selectNodeContents` — 전체 선택과 같은 모양입니다 */
    const selectAllContents = (target: Node): void => {
      const range = document.createRange()
      range.selectNodeContents(target)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    }

    it('전체 선택에서도 서식 상태를 알아야 함', () => {
      element.innerHTML = '<p><strong>Hello</strong></p>'
      selectAllContents(element)

      expect(registry.queryState('bold'), '⌘A 에서 굵게를 놓칩니다').toBe(true)
    })

    it('전체 선택에서도 글자 크기를 알아야 함', () => {
      element.innerHTML = '<p><span style="font-size: 24px">Hi</span></p>'
      selectAllContents(element)

      expect(registry.queryValue('fontSize'), '⌘A 에서 크기를 놓칩니다').toBe(
        '5'
      )
    })

    it('전체 선택에서도 글꼴을 알아야 함', () => {
      element.innerHTML = '<p><span style="font-family: Georgia">Hi</span></p>'
      selectAllContents(element)

      expect(registry.queryValue('fontName')).toContain('Georgia')
    })

    /*
     * 서식이 없으면 없다고 해야 합니다 — 내려가는 것이 아무 요소나 집어
     * 오는 것이 아니라 **첫 글자 자리**를 찾는 일임을 고정합니다.
     */
    it('서식 없는 글은 전체 선택에서도 비활성이어야 함', () => {
      element.innerHTML = '<p>Hello</p>'
      selectAllContents(element)

      expect(registry.queryState('bold')).toBe(false)
    })

    /* 빈 문단에 접힌 캐럿 — 내려갈 자식이 없습니다 */
    it('빈 곳에 접힌 커서에서도 터지지 않아야 함', () => {
      element.innerHTML = '<p></p>'
      const paragraph = element.querySelector('p')!
      const range = document.createRange()
      range.setStart(paragraph, 0)
      range.collapse(true)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      expect(registry.queryState('bold')).toBe(false)
      expect(() => registry.queryValue('fontSize')).not.toThrow()
    })
  })
})
