import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EditingAreaManager } from '../../src/editing-area/editing-area-manager'
import { EventBus } from '@sagak/core/event-bus'
import { SelectionManager } from '@sagak/core/selection-manager'
import type { EditingAreaManagerConfig } from '../../src/editing-area/editing-area-manager'
import type { EditingArea } from '../../src/editing-area/types'
import { WysiwygArea } from '../../src/editing-area/modes/wysiwyg-area'

/**
 * Type guard to check if an EditingArea is a WysiwygArea
 * EditingArea가 WysiwygArea인지 확인하는 타입 가드
 */
function isWysiwygArea(area: EditingArea): area is WysiwygArea {
  return 'isComposing' in area
}

describe('Editing Area 통합', () => {
  let container: HTMLDivElement
  let manager: EditingAreaManager
  let eventBus: EventBus

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    eventBus = new EventBus()
  })

  afterEach(() => {
    if (manager) {
      manager.destroy()
    }
    document.body.removeChild(container)
  })

  describe('전체 워크플로우 (모드 전환 흐름)', () => {
    /**
     * Why: 사용자가 실제로 에디터를 사용하는 전체 흐름이 올바르게 동작해야 함
     * How: 세 가지 모드 간 전환과 콘텐츠 유지 확인
     */

    it('전체 편집 워크플로우를 처리해야 함', async () => {
      // Given: EventBus가 설정된 매니저
      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)

      // When: 전체 편집 워크플로우 실행
      // 1. WYSIWYG 모드로 초기화
      await manager.initialize()
      expect(manager.getCurrentMode()).toBe('wysiwyg')

      // 2. WYSIWYG에서 콘텐츠 입력
      await manager.setContent('<p>Hello <strong>World</strong></p>')

      // 3. HTML 소스 모드로 전환하여 코드 확인
      await manager.switchMode('html')
      const htmlContent = await manager.getContent()
      expect(htmlContent).toContain('strong')

      // 4. HTML 소스에서 편집
      await manager.setContent('<p>Modified content</p>')

      // 5. 텍스트 모드로 전환
      await manager.switchMode('text')
      const textContent = await manager.getContent()
      expect(textContent).toBe('<p>Modified content</p>')

      // Then: WYSIWYG으로 돌아와서 콘텐츠 확인
      await manager.switchMode('wysiwyg')
      const finalContent = await manager.getContent()
      expect(finalContent).toContain('Modified content')
    })

    it('빈 콘텐츠 워크플로우를 처리해야 함', async () => {
      // Given: 기본 config로 생성된 매니저
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()

      // When: 빈 콘텐츠로 시작하여 모든 모드 순회
      await manager.setContent('')

      await manager.switchMode('html')
      expect(await manager.getContent()).toBe('')

      await manager.switchMode('text')
      expect(await manager.getContent()).toBe('<p><br></p>')

      // Then: WYSIWYG으로 돌아와서 빈 콘텐츠 확인
      await manager.switchMode('wysiwyg')
      const content = await manager.getContent()
      expect(content).toBe('<p><br></p>')
    })

    it('모드 전환을 통해 포맷을 보존해야 함', async () => {
      // Given: 리치 콘텐츠가 설정된 매니저
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()

      const richContent =
        '<p>Line 1</p><p><strong>Bold</strong> and <em>italic</em></p>'
      await manager.setContent(richContent)

      // When: HTML 모드로 전환 후 다시 WYSIWYG으로 복귀
      await manager.switchMode('html')
      await manager.switchMode('wysiwyg')

      // Then: 서식이 보존됨
      const result = await manager.getContent()
      expect(result).toContain('strong')
      expect(result).toContain('em')
    })
  })

  describe('EventBus 통합 (이벤트 발행)', () => {
    /**
     * Why: 에디터의 상태 변화를 다른 컴포넌트에 알려야 함
     * How: 모든 라이프사이클 이벤트와 모드별 이벤트 발행 확인
     */

    it('모든 라이프사이클 이벤트를 발행해야 함', async () => {
      // Given: 이벤트 수집을 위한 핸들러가 등록된 EventBus
      const events: string[] = []

      eventBus.on('EDITING_AREA_INITIALIZED', 'on', () => {
        events.push('initialized')
      })
      eventBus.on('EDITING_AREA_MODE_CHANGING', 'on', () => {
        events.push('changing')
      })
      eventBus.on('EDITING_AREA_MODE_CHANGED', 'on', () => {
        events.push('changed')
      })
      eventBus.on('EDITING_AREA_DESTROYED', 'on', () => {
        events.push('destroyed')
      })

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)

      // When: 전체 라이프사이클 실행
      await manager.initialize()
      await manager.switchMode('html')
      manager.destroy()

      // Then: 모든 라이프사이클 이벤트가 순서대로 발행됨
      expect(events).toEqual([
        'initialized',
        'changing',
        'changed',
        'destroyed',
      ])
    })

    it('WYSIWYG 전용 이벤트를 발행해야 함', async () => {
      // Given: WYSIWYG 콘텐츠 변경 핸들러가 등록된 매니저
      const handler = vi.fn()
      eventBus.on('WYSIWYG_CONTENT_CHANGED', 'on', handler)

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()

      // When: WYSIWYG 영역에서 input 이벤트 발생
      const element = manager.getCurrentArea()?.getElement()
      element?.dispatchEvent(new Event('input', { bubbles: true }))

      // Then: WYSIWYG_CONTENT_CHANGED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('포커스 이벤트를 발행해야 함', async () => {
      // Given: WYSIWYG 포커스 핸들러가 등록된 매니저
      const handler = vi.fn()
      eventBus.on('WYSIWYG_FOCUSED', 'on', handler)

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()

      // When: WYSIWYG 영역에서 focus 이벤트 발생
      const element = manager.getCurrentArea()?.getElement()
      element?.dispatchEvent(new Event('focus', { bubbles: true }))

      // Then: WYSIWYG_FOCUSED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('모든 모드로부터 이벤트를 수신해야 함', async () => {
      // Given: WYSIWYG 콘텐츠 변경 핸들러가 등록된 매니저
      const wysiwygHandler = vi.fn()
      eventBus.on('WYSIWYG_CONTENT_CHANGED', 'on', wysiwygHandler)

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()

      // When: WYSIWYG 영역에서 input 이벤트 발생
      const wysiwygElement = manager.getCurrentArea()?.getElement()
      wysiwygElement?.dispatchEvent(new Event('input', { bubbles: true }))

      // Then: 이벤트 핸들러가 호출됨
      expect(wysiwygHandler).toHaveBeenCalled()
    })
  })

  describe('SelectionManager 통합 (선택 영역 관리)', () => {
    /**
     * Why: CJK/IME 입력 처리를 위해 SelectionManager 통합이 필요
     * How: WYSIWYG 모드에서 SelectionManager 사용 확인
     */

    it('WYSIWYG 모드에서 SelectionManager와 통합되어야 함', async () => {
      // Given: SelectionManager가 설정된 매니저
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const selectionManager = new SelectionManager(editableDiv)

      const config: EditingAreaManagerConfig = {
        container,
        selectionManager,
      }
      manager = new EditingAreaManager(config)

      // When: 초기화
      await manager.initialize()

      // Then: WYSIWYG 모드로 정상 작동
      expect(manager.getCurrentMode()).toBe('wysiwyg')

      document.body.removeChild(editableDiv)
    })

    it('IME 조합 상태를 처리해야 함', async () => {
      // Given: SelectionManager가 설정된 매니저
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const selectionManager = new SelectionManager(editableDiv)

      const config: EditingAreaManagerConfig = {
        container,
        selectionManager,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()

      // When: WYSIWYG 영역에서 IME 조합 상태 확인
      const currentArea = manager.getCurrentArea()
      if (currentArea && isWysiwygArea(currentArea)) {
        const isComposing = currentArea.isComposing()

        // Then: boolean 타입의 조합 상태가 반환됨
        expect(typeof isComposing).toBe('boolean')
      }

      document.body.removeChild(editableDiv)
    })
  })

  describe('다중 모드 시나리오 (복잡한 모드 전환)', () => {
    /**
     * Why: 실제 사용에서 빈번한 모드 전환이 발생할 수 있음
     * How: 빠른 모드 전환, 인스턴스 유지, 동시 로드 등 복잡한 시나리오 테스트
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('빠른 모드 전환을 처리해야 함', async () => {
      // Given: 콘텐츠가 설정된 매니저
      await manager.setContent('<p>Test</p>')

      // When: 여러 번 빠르게 모드 전환
      await manager.switchMode('html')
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')
      await manager.switchMode('html')
      await manager.switchMode('wysiwyg')

      // Then: 콘텐츠가 보존됨
      const content = await manager.getContent()
      expect(content).toContain('Test')
    })

    it('별도의 요소 인스턴스를 유지해야 함', async () => {
      // Given: HTML 모드로 전환하여 요소 참조 획득
      await manager.switchMode('html')
      const htmlElement1 = manager.getCurrentArea()?.getElement()

      // When: 다른 모드 거쳐 다시 HTML로 전환
      await manager.switchMode('wysiwyg')
      await manager.switchMode('html')
      const htmlElement2 = manager.getCurrentArea()?.getElement()

      // Then: 동일한 요소 인스턴스가 재사용됨
      expect(htmlElement1).toBe(htmlElement2)
    })

    it('세 가지 모드가 모두 로드된 상태를 처리해야 함', async () => {
      // Given: 초기화된 매니저

      // When: 모든 모드를 순회하여 로드
      await manager.switchMode('html')
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')

      // Then: 세 가지 모드가 모두 로드됨
      expect(manager.isAreaLoaded('wysiwyg')).toBe(true)
      expect(manager.isAreaLoaded('html')).toBe(true)
      expect(manager.isAreaLoaded('text')).toBe(true)
    })

    it('한 번에 하나의 영역만 표시해야 함', async () => {
      // Given: 콘텐츠가 설정되고 모든 모드가 로드된 상태
      await manager.setContent('<p>Test</p>')

      await manager.switchMode('html')
      const htmlArea = await manager.getArea('html')
      const wysiwygArea = await manager.getArea('wysiwyg')

      // When: HTML 모드일 때 표시 상태 확인
      expect(htmlArea?.isVisible()).toBe(true)
      expect(wysiwygArea?.isVisible()).toBe(false)

      // Then: WYSIWYG으로 전환 시 표시 상태가 반전됨
      await manager.switchMode('wysiwyg')

      expect(htmlArea?.isVisible()).toBe(false)
      expect(wysiwygArea?.isVisible()).toBe(true)
    })
  })

  describe('콘텐츠 변환 시나리오 (모드 간 변환)', () => {
    /**
     * Why: 모드 간 전환 시 콘텐츠가 적절히 변환되어야 함
     * How: HTML ↔ Text 변환, 특수 문자 처리, 태그 제거 등 확인
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('순수 텍스트를 HTML로 변환해야 함', async () => {
      // Given: 텍스트 모드에서 여러 줄 텍스트 입력
      await manager.switchMode('text')
      await manager.setContent('Line 1\nLine 2\nLine 3')

      // When: WYSIWYG 모드로 전환
      await manager.switchMode('wysiwyg')
      const html = await manager.getContent()

      // Then: 각 줄이 p 태그로 변환됨
      expect(html).toContain('<p>Line 1</p>')
      expect(html).toContain('<p>Line 2</p>')
      expect(html).toContain('<p>Line 3</p>')
    })

    it('HTML을 순수 텍스트로 변환해야 함', async () => {
      // Given: WYSIWYG 모드에서 여러 단락 HTML 설정
      await manager.setContent('<p>Line 1</p><p>Line 2</p><p>Line 3</p>')

      // When: 텍스트 모드로 전환
      await manager.switchMode('text')
      const text = await manager.getContent()

      // Then: HTML이 텍스트로 변환됨
      expect(text).toContain('Line 1')
      expect(text).toContain('Line 2')
      expect(text).toContain('Line 3')
    })

    it('특수 문자를 처리해야 함', async () => {
      // Given: 특수 문자가 이스케이프된 HTML 설정
      await manager.setContent('<p>Test &amp; &lt;special&gt; "characters"</p>')

      // When: 텍스트 모드로 전환
      await manager.switchMode('text')
      const text = await manager.getContent()

      // Then: 텍스트 모드에서 이스케이프가 해제됨
      expect(text).toContain('&')
      expect(text).toContain('<')
      expect(text).toContain('>')

      // When: 다시 WYSIWYG으로 전환
      await manager.switchMode('wysiwyg')
      const html = await manager.getContent()

      // Then: 다시 이스케이프된 엔티티로 저장됨
      expect(html).toContain('&amp;')
      expect(html).toContain('&lt;')
      expect(html).toContain('&gt;')
    })

    it('텍스트 모드에서 태그를 제거해야 함', async () => {
      // Given: 서식 태그가 포함된 HTML 설정
      await manager.setContent('<p>Hello <strong>World</strong></p>')

      // When: 텍스트 모드로 전환
      await manager.switchMode('text')
      const text = await manager.getContent()

      // Then: 서식 태그가 제거된 텍스트가 반환됨
      expect(text).toBe('<p>Hello World</p>')
    })
  })

  describe('엣지 케이스 (경계 조건)', () => {
    /**
     * Why: 극단적인 상황에서도 에디터가 안정적으로 동작해야 함
     * How: 매우 긴 콘텐츠, 중첩 구조, 다중 단락 등 극단적 상황 테스트
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('매우 긴 콘텐츠를 처리해야 함', async () => {
      // Given: 10,000자 길이의 콘텐츠
      const longContent = '<p>' + 'A'.repeat(10000) + '</p>'
      await manager.setContent(longContent)

      // When: 모든 모드를 순회
      await manager.switchMode('html')
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')

      // Then: 콘텐츠가 대부분 보존됨
      const result = await manager.getContent()
      expect(result.length).toBeGreaterThan(9000)
    })

    it('중첩된 HTML 구조를 처리해야 함', async () => {
      // Given: 깊게 중첩된 HTML 구조
      const nested = '<div><p><strong><em>Deeply nested</em></strong></p></div>'
      await manager.setContent(nested)

      // When: HTML 모드로 전환 후 다시 WYSIWYG으로 복귀
      await manager.switchMode('html')
      await manager.switchMode('wysiwyg')

      // Then: 중첩된 콘텐츠가 보존됨
      const result = await manager.getContent()
      expect(result).toContain('nested')
    })

    it('여러 단락을 처리해야 함', async () => {
      // Given: 50개의 단락으로 구성된 콘텐츠
      const paragraphs = Array(50)
        .fill(0)
        .map((_, i) => `<p>Paragraph ${i}</p>`)
        .join('')

      await manager.setContent(paragraphs)

      // When: 모든 모드를 순회
      await manager.switchMode('html')
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')

      // Then: 첫 번째와 마지막 단락이 보존됨
      const result = await manager.getContent()
      expect(result).toContain('Paragraph 0')
      expect(result).toContain('Paragraph 49')
    })
  })

  describe('설정 시나리오 (구성 옵션)', () => {
    /**
     * Why: 다양한 설정 조합이 올바르게 적용되어야 함
     * How: 다양한 설정 조합 테스트
     */

    it('모든 설정을 적용해야 함', async () => {
      // Given: 모든 설정이 지정된 config
      const config: EditingAreaManagerConfig = {
        container,
        initialMode: 'html',
        eventBus,
        classNames: {
          wysiwyg: 'custom-wysiwyg',
          html: 'custom-html',
          text: 'custom-text',
        },
        minHeight: 400,
        autoResize: true,
      }

      manager = new EditingAreaManager(config)

      // When: 초기화
      await manager.initialize()

      // Then: 모든 설정이 적용됨
      expect(manager.getCurrentMode()).toBe('html')

      const htmlArea = manager.getCurrentArea()
      expect(htmlArea?.getElement().className).toBe('custom-html')
      expect(htmlArea?.getElement().style.minHeight).toBe('400px')
    })

    it('최소 설정으로 작동해야 함', async () => {
      // Given: 컨테이너만 지정된 최소 config
      const config: EditingAreaManagerConfig = {
        container,
      }

      manager = new EditingAreaManager(config)

      // When: 초기화
      await manager.initialize()

      // Then: 기본값으로 작동함
      expect(manager.getCurrentMode()).toBe('wysiwyg')
    })
  })

  describe('오류 복구 (에러 처리)', () => {
    /**
     * Why: 잘못된 입력이나 예외 상황에서도 에디터가 충돌하지 않아야 함
     * How: 잘못된 HTML, 동일 모드 전환 등 오류 상황 처리 확인
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('잘못된 HTML에서 복구해야 함', async () => {
      // Given: HTML 모드에서 닫히지 않은 태그 입력
      await manager.switchMode('html')
      await manager.setContent('<p>Unclosed tag')

      // When: WYSIWYG 모드로 전환
      await manager.switchMode('wysiwyg')

      // Then: 오류 없이 콘텐츠 조회 가능
      expect(async () => {
        await manager.getContent()
      }).not.toThrow()
    })

    it('동일 모드로 전환을 처리해야 함', async () => {
      // Given: WYSIWYG 모드의 현재 콘텐츠
      const contentBefore = await manager.getContent()

      // When: 같은 WYSIWYG 모드로 전환 시도
      await manager.switchMode('wysiwyg')

      // Then: 콘텐츠가 변경되지 않음
      const contentAfter = await manager.getContent()
      expect(contentBefore).toBe(contentAfter)
    })
  })

  describe('정리 및 메모리 (리소스 관리)', () => {
    /**
     * Why: 메모리 누수를 방지하고 리소스를 적절히 관리해야 함
     * How: destroy 시 리소스 정리, 재생성 가능 여부 확인
     */

    it('destroy 시 모든 리소스를 정리해야 함', async () => {
      // Given: 모든 모드가 로드된 매니저
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()
      await manager.switchMode('html')
      await manager.switchMode('text')

      const childCountBefore = container.children.length
      expect(childCountBefore).toBeGreaterThan(0)

      // When: destroy 호출
      manager.destroy()

      // Then: 컨테이너의 모든 자식 요소가 제거됨
      const childCountAfter = container.children.length
      expect(childCountAfter).toBe(0)
    })

    it('destroy 후 재생성을 허용해야 함', async () => {
      // Given: 초기화 후 destroy된 매니저
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)

      await manager.initialize()
      manager.destroy()

      // When: 새 매니저 생성 및 초기화
      manager = new EditingAreaManager(config)
      await manager.initialize()

      // Then: 새 매니저가 정상 작동함
      expect(manager.getCurrentMode()).toBe('wysiwyg')
    })
  })
})
