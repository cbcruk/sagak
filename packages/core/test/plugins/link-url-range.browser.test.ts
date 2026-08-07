import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { createLinkPlugin } from '@/plugins/link-plugin'
import type { EditorContext } from '@/core/types'

/**
 * 링크 URL 검증의 문자 범위.
 *
 * 프로토콜이 있으면 `new URL()` 이 IDN 도 퍼센트 인코딩도 처리합니다. 문제는
 * **프로토콜 없는 입력** 을 보던 `[a-zA-Z0-9…]` 정규식이었습니다 — 비-ASCII 가
 * 섞이면 전부 거부됐고, 거부는 `logger.warn` 뒤 커맨드를 막는 것이라
 * 사용자에게는 **아무 일도 일어나지 않았습니다.**
 *
 * 이번 세션에서 같은 부류(ASCII 전제)가 찾기·자동 완성에 이어 세 번째입니다.
 */
describe('링크 URL 검증 — 문자 범위', () => {
  let eventBus: EventBus
  let element: HTMLDivElement

  beforeEach(async () => {
    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    eventBus = new EventBus()
    const context: EditorContext = {
      eventBus,
      selectionManager: new SelectionManager(element),
      element,
      config: { element },
    }
    await new PluginManager(context).register(createLinkPlugin())
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  /** `before` 단계가 막으면 `emit` 이 `false` 를 돌려줍니다 */
  const accepts = (url: string): boolean => {
    element.innerHTML = '<p>link me</p>'
    const paragraph = element.querySelector('p')!
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    return eventBus.emit('LINK_CHANGED', { url }) !== false
  }

  describe('프로토콜 없는 주소', () => {
    it('ASCII 는 그대로 통과해야 함', () => {
      expect(accepts('example.com')).toBe(true)
      expect(accepts('example.com/path?q=1')).toBe(true)
    })

    it('경로에 한글이 있어도 통과해야 함', () => {
      // 위키백과 주소에서 스킴만 뗀 형태 — 고치기 전에는 거부됐습니다
      expect(accepts('ko.wikipedia.org/wiki/한국')).toBe(true)
      expect(accepts('example.com/path?q=검색어')).toBe(true)
    })

    it('국제화 도메인도 통과해야 함', () => {
      expect(accepts('한국.kr')).toBe(true)
      expect(accepts('пример.рф')).toBe(true)
    })
  })

  describe('프로토콜이 있으면 원래도 됐습니다', () => {
    it('비-ASCII 를 포함해도 통과', () => {
      expect(accepts('https://ko.wikipedia.org/wiki/한국')).toBe(true)
      expect(accepts('https://한국.kr')).toBe(true)
      expect(accepts('mailto:a@b.com')).toBe(true)
    })
  })

  /**
   * 넓히면서 걸러 내던 것까지 통과시키면 안 됩니다. 특히 위험한 스킴은
   * 문자 범위와 무관하게 계속 막혀야 합니다.
   */
  describe('여전히 거부해야 하는 것', () => {
    it('공백이 있으면 URL 이 아닙니다', () => {
      expect(accepts('hello world')).toBe(false)
      expect(accepts('안녕 하세요')).toBe(false)
    })

    it('위험한 스킴', () => {
      expect(accepts('javascript:alert(1)')).toBe(false)
      expect(accepts('JavaScript:alert(1)')).toBe(false)
      expect(accepts('data:text/html,<script>')).toBe(false)
    })

    it('마크업', () => {
      expect(accepts('<script>alert(1)</script>')).toBe(false)
    })
  })
})
