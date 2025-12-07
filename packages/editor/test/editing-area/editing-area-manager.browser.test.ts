import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EditingAreaManager } from '../../src/editing-area/editing-area-manager'
import { EventBus } from '@sagak/core/event-bus'
import { SelectionManager } from '@sagak/core/selection-manager'
import type { EditingAreaManagerConfig } from '../../src/editing-area/editing-area-manager'

/**
 * EditingAreaManager 테스트
 *
 * Why: WYSIWYG/HTML/Text 세 가지 편집 모드를 통합 관리하는 핵심 매니저 검증
 * How: 초기화, 모드 전환, 콘텐츠 동기화, 지연 로딩 등 각 기능별 테스트
 */
describe('EditingAreaManager', () => {
  let container: HTMLDivElement
  let manager: EditingAreaManager

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (manager) {
      manager.destroy()
    }
    document.body.removeChild(container)
  })

  describe('초기화 (편집 영역 설정)', () => {
    /**
     * Why: 에디터 시작 시 적절한 편집 영역이 준비되어야 사용자가 즉시 편집 가능
     * How: `initialize()`로 초기 모드 설정 및 `EDITING_AREA_INITIALIZED` 이벤트 발행
     */

    it('기본 WYSIWYG 모드로 초기화해야 함', async () => {
      // Given: 컨테이너만 설정된 config
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)

      // When: 초기화 실행
      await manager.initialize()

      // Then: 기본 WYSIWYG 모드로 설정됨
      expect(manager.getCurrentMode()).toBe('wysiwyg')
    })

    it('지정된 모드로 초기화해야 함', async () => {
      // Given: HTML 모드로 지정된 config
      const config: EditingAreaManagerConfig = {
        container,
        initialMode: 'html',
      }
      manager = new EditingAreaManager(config)

      // When: 초기화 실행
      await manager.initialize()

      // Then: HTML 모드로 설정됨
      expect(manager.getCurrentMode()).toBe('html')
    })

    it('텍스트 모드로 초기화해야 함', async () => {
      // Given: Text 모드로 지정된 config
      const config: EditingAreaManagerConfig = {
        container,
        initialMode: 'text',
      }
      manager = new EditingAreaManager(config)

      // When: 초기화 실행
      await manager.initialize()

      // Then: Text 모드로 설정됨
      expect(manager.getCurrentMode()).toBe('text')
    })

    it('초기화 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 이벤트 핸들러가 설정된 config
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('EDITING_AREA_INITIALIZED', 'on', handler)

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)

      // When: 초기화 실행
      await manager.initialize()

      // Then: EDITING_AREA_INITIALIZED 이벤트가 모드 정보와 함께 발행됨
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'wysiwyg' })
      )
    })

    it('초기 편집 영역을 표시해야 함', async () => {
      // Given: 기본 config
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)

      // When: 초기화 실행
      await manager.initialize()

      // Then: 현재 영역이 표시 상태임
      const currentArea = manager.getCurrentArea()
      expect(currentArea?.isVisible()).toBe(true)
    })
  })

  describe('모드 전환 (편집 모드 변경)', () => {
    /**
     * Why: 사용자가 WYSIWYG, HTML 소스, 텍스트 모드 간 자유롭게 전환할 수 있어야 함
     * How: `switchMode()`로 모드 전환, 이전 영역 숨김, 새 영역 표시, 이벤트 발행
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('WYSIWYG에서 HTML 모드로 전환해야 함', async () => {
      // Given: WYSIWYG 모드로 초기화된 매니저

      // When: HTML 모드로 전환
      await manager.switchMode('html')

      // Then: 현재 모드가 HTML임
      expect(manager.getCurrentMode()).toBe('html')
    })

    it('WYSIWYG에서 Text 모드로 전환해야 함', async () => {
      // Given: WYSIWYG 모드로 초기화된 매니저

      // When: Text 모드로 전환
      await manager.switchMode('text')

      // Then: 현재 모드가 Text임
      expect(manager.getCurrentMode()).toBe('text')
    })

    it('WYSIWYG 모드로 다시 전환해야 함', async () => {
      // Given: HTML 모드로 전환된 상태
      await manager.switchMode('html')

      // When: WYSIWYG 모드로 다시 전환
      await manager.switchMode('wysiwyg')

      // Then: 현재 모드가 WYSIWYG임
      expect(manager.getCurrentMode()).toBe('wysiwyg')
    })

    it('전환 시 이전 영역을 숨겨야 함', async () => {
      // Given: 현재 WYSIWYG 영역 참조
      const wysiwygArea = manager.getCurrentArea()

      // When: HTML 모드로 전환
      await manager.switchMode('html')

      // Then: 이전 WYSIWYG 영역이 숨겨짐
      expect(wysiwygArea?.isVisible()).toBe(false)
    })

    it('전환 시 새 영역을 표시해야 함', async () => {
      // Given: WYSIWYG 모드로 초기화된 매니저

      // When: HTML 모드로 전환
      await manager.switchMode('html')

      // Then: 새 HTML 영역이 표시됨
      const htmlArea = manager.getCurrentArea()
      expect(htmlArea?.isVisible()).toBe(true)
    })

    it('현재 모드로 전환 시 아무것도 하지 않아야 함', async () => {
      // Given: WYSIWYG 모드인 상태
      const modeBefore = manager.getCurrentMode()

      // When: 같은 WYSIWYG 모드로 전환 시도
      await manager.switchMode('wysiwyg')

      // Then: 모드가 변경되지 않음
      expect(manager.getCurrentMode()).toBe(modeBefore)
    })

    it('모드 변경 중 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 MODE_CHANGING 핸들러가 설정된 새 매니저
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('EDITING_AREA_MODE_CHANGING', 'on', handler)

      manager.destroy()

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()

      // When: HTML 모드로 전환
      await manager.switchMode('html')

      // Then: MODE_CHANGING 이벤트가 from/to 정보와 함께 발행됨
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'wysiwyg',
          to: 'html',
        })
      )
    })

    it('모드 변경 완료 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 MODE_CHANGED 핸들러가 설정된 새 매니저
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('EDITING_AREA_MODE_CHANGED', 'on', handler)

      manager.destroy()

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()

      // When: HTML 모드로 전환
      await manager.switchMode('html')

      // Then: MODE_CHANGED 이벤트가 from/to 정보와 함께 발행됨
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'wysiwyg',
          to: 'html',
        })
      )
    })
  })

  describe('콘텐츠 동기화 (모드 간 콘텐츠 유지)', () => {
    /**
     * Why: 모드 전환 시 사용자가 작성한 콘텐츠가 손실되지 않아야 함
     * How: 모드 전환 시 콘텐츠를 IR(HTML) 형식으로 변환하여 새 영역에 전달
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('모드 전환 시 콘텐츠를 보존해야 함', async () => {
      // Given: WYSIWYG 모드에 콘텐츠 설정
      const content = '<p>Hello World</p>'
      await manager.setContent(content)

      // When: HTML 모드로 전환
      await manager.switchMode('html')
      const htmlContent = await manager.getContent()

      // Then: 콘텐츠가 보존됨
      expect(htmlContent).toContain('Hello World')
    })

    it('WYSIWYG를 Text 모드로 변환해야 함', async () => {
      // Given: WYSIWYG 모드에 여러 줄 HTML 설정
      await manager.setContent('<p>Line 1</p><p>Line 2</p>')

      // When: Text 모드로 전환
      await manager.switchMode('text')
      const textContent = await manager.getContent()

      // Then: HTML이 텍스트로 변환됨
      expect(textContent).toContain('Line 1')
      expect(textContent).toContain('Line 2')
    })

    it('Text를 WYSIWYG 모드로 변환해야 함', async () => {
      // Given: Text 모드에 여러 줄 텍스트 설정
      await manager.switchMode('text')
      await manager.setContent('Line 1\nLine 2')

      // When: WYSIWYG 모드로 전환
      await manager.switchMode('wysiwyg')
      const content = await manager.getContent()

      // Then: 텍스트가 HTML로 변환됨
      expect(content).toContain('<p>')
      expect(content).toContain('Line 1')
    })

    it('모든 모드를 통한 왕복 변환을 처리해야 함', async () => {
      // Given: WYSIWYG 모드에 초기 콘텐츠 설정
      const original = '<p>Test content</p>'
      await manager.setContent(original)

      // When: 모든 모드를 순회
      await manager.switchMode('html') // WYSIWYG → HTML
      await manager.switchMode('text') // HTML → Text
      await manager.switchMode('wysiwyg') // Text → WYSIWYG

      // Then: 최종 콘텐츠에 원본 텍스트가 보존됨
      const final = await manager.getContent()
      expect(final).toContain('Test content')
    })

    it('빈 콘텐츠를 처리해야 함', async () => {
      // Given: 빈 콘텐츠 설정
      await manager.setContent('')

      // When: HTML 모드로 전환
      await manager.switchMode('html')
      const content = await manager.getContent()

      // Then: 빈 콘텐츠가 유지됨
      expect(content).toBe('')
    })
  })

  describe('지연 로딩 (필요 시 로드)', () => {
    /**
     * Why: 메모리 효율성을 위해 사용하지 않는 편집 영역은 로드하지 않아야 함
     * How: 초기화 시 첫 영역만 로드, 전환 시 필요한 영역만 `getArea()`로 지연 로드
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('초기화 시 초기 영역만 로드해야 함', () => {
      // Given: WYSIWYG 모드로 초기화된 매니저

      // When: 각 영역의 로드 상태 확인

      // Then: WYSIWYG만 로드되고 나머지는 미로드 상태
      expect(manager.isAreaLoaded('wysiwyg')).toBe(true)
      expect(manager.isAreaLoaded('html')).toBe(false)
      expect(manager.isAreaLoaded('text')).toBe(false)
    })

    it('첫 전환 시 HTML 영역을 지연 로드해야 함', async () => {
      // Given: HTML 영역이 미로드 상태

      // When: HTML 모드로 첫 전환
      await manager.switchMode('html')

      // Then: HTML 영역이 로드됨
      expect(manager.isAreaLoaded('html')).toBe(true)
    })

    it('첫 전환 시 Text 영역을 지연 로드해야 함', async () => {
      // Given: Text 영역이 미로드 상태

      // When: Text 모드로 첫 전환
      await manager.switchMode('text')

      // Then: Text 영역이 로드됨
      expect(manager.isAreaLoaded('text')).toBe(true)
    })

    it('이미 로드된 영역을 다시 로드하지 않아야 함', async () => {
      // Given: HTML 영역으로 전환하여 로드
      await manager.switchMode('html')
      const htmlArea1 = manager.getCurrentArea()

      // When: 다른 모드 거쳐 다시 HTML로 전환
      await manager.switchMode('wysiwyg')
      await manager.switchMode('html')
      const htmlArea2 = manager.getCurrentArea()

      // Then: 동일한 영역 인스턴스가 재사용됨
      expect(htmlArea1).toBe(htmlArea2)
    })

    it('getArea를 통해 영역을 로드해야 함', async () => {
      // Given: HTML 영역이 미로드 상태

      // When: getArea로 HTML 영역 요청
      const htmlArea = await manager.getArea('html')

      // Then: HTML 영역이 로드되고 반환됨
      expect(htmlArea).toBeDefined()
      expect(manager.isAreaLoaded('html')).toBe(true)
    })
  })

  describe('콘텐츠 관리 (설정 및 조회)', () => {
    /**
     * Why: 에디터 콘텐츠를 프로그래밍 방식으로 설정하고 조회할 수 있어야 함
     * How: `setContent()`/`getContent()`로 현재 영역의 콘텐츠 관리
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('현재 영역에 콘텐츠를 설정해야 함', async () => {
      // Given: 초기화된 매니저
      const content = '<p>Hello World</p>'

      // When: 콘텐츠 설정
      await manager.setContent(content)

      // Then: 설정한 콘텐츠가 조회됨
      const retrieved = await manager.getContent()
      expect(retrieved).toBe(content)
    })

    it('현재 영역에서 콘텐츠를 가져와야 함', async () => {
      // Given: 현재 영역에 직접 콘텐츠 설정
      const currentArea = manager.getCurrentArea()
      await currentArea?.setContent('<p>Test</p>')

      // When: 매니저를 통해 콘텐츠 조회
      const content = await manager.getContent()

      // Then: 영역의 콘텐츠가 반환됨
      expect(content).toContain('Test')
    })
  })

  describe('포커스 관리 (focus 제어)', () => {
    /**
     * Why: 사용자가 에디터에서 바로 타이핑을 시작할 수 있도록 포커스 제어 필요
     * How: `focus()`로 현재 영역에 포커스 설정
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('현재 영역에 포커스를 설정해야 함', () => {
      // Given: 초기화된 매니저

      // When: 포커스 설정
      // Then: 오류 없이 실행됨
      expect(() => {
        manager.focus()
      }).not.toThrow()
    })

    it('모드 전환 후 새 영역에 포커스를 설정해야 함', async () => {
      // Given: HTML 모드로 전환된 상태
      await manager.switchMode('html')

      // When: 포커스 설정
      // Then: 오류 없이 실행됨
      expect(() => {
        manager.focus()
      }).not.toThrow()
    })
  })

  describe('편집 가능 상태 (editable 제어)', () => {
    /**
     * Why: 읽기 전용 모드나 비활성 상태에서 편집을 방지해야 함
     * How: `setEditable()`로 모든 영역의 편집 가능 여부 제어
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('모든 영역의 편집 가능 상태를 설정해야 함', async () => {
      // Given: 모든 영역이 로드된 상태
      await manager.switchMode('html')
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')

      // When: 편집 비활성화
      manager.setEditable(false)

      // Then: 모든 영역이 편집 불가 상태
      const wysiwygArea = await manager.getArea('wysiwyg')
      const htmlArea = await manager.getArea('html')
      const textArea = await manager.getArea('text')

      expect(wysiwygArea?.getElement().contentEditable).toBe('false')
      expect((htmlArea?.getElement() as HTMLTextAreaElement).disabled).toBe(
        true
      )
      expect((textArea?.getElement() as HTMLTextAreaElement).disabled).toBe(
        true
      )
    })

    it('모든 영역의 편집을 활성화해야 함', async () => {
      // Given: 모든 영역이 로드되고 편집 비활성화된 상태
      await manager.switchMode('html')
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')

      manager.setEditable(false)

      // When: 편집 활성화
      manager.setEditable(true)

      // Then: 모든 영역이 편집 가능 상태
      const wysiwygArea = await manager.getArea('wysiwyg')
      const htmlArea = await manager.getArea('html')
      const textArea = await manager.getArea('text')

      expect(wysiwygArea?.getElement().contentEditable).toBe('true')
      expect((htmlArea?.getElement() as HTMLTextAreaElement).disabled).toBe(
        false
      )
      expect((textArea?.getElement() as HTMLTextAreaElement).disabled).toBe(
        false
      )
    })
  })

  describe('영역 접근 (getArea/getCurrentArea)', () => {
    /**
     * Why: 특정 영역에 직접 접근하여 세부 조작이 필요한 경우가 있음
     * How: `getCurrentArea()`로 현재 영역, `getArea()`로 특정 영역 접근
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('현재 영역을 가져와야 함', () => {
      // Given: 초기화된 매니저

      // When: 현재 영역 요청
      const currentArea = manager.getCurrentArea()

      // Then: 유효한 영역이 반환됨
      expect(currentArea).toBeDefined()
    })

    it('모드 전환 후 현재 영역을 가져와야 함', async () => {
      // Given: 초기화된 매니저

      // When: HTML 모드로 전환 후 현재 영역 요청
      await manager.switchMode('html')
      const currentArea = manager.getCurrentArea()

      // Then: 표시 중인 새 영역이 반환됨
      expect(currentArea).toBeDefined()
      expect(currentArea?.isVisible()).toBe(true)
    })

    it('getArea를 통해 특정 영역을 가져와야 함', async () => {
      // Given: 초기화된 매니저

      // When: HTML 영역 직접 요청
      const htmlArea = await manager.getArea('html')

      // Then: HTML 영역이 반환됨
      expect(htmlArea).toBeDefined()
    })
  })

  describe('설정 (구성 옵션 적용)', () => {
    /**
     * Why: 에디터의 외관과 동작을 사용자 요구에 맞게 커스터마이징해야 함
     * How: 설정 객체를 통해 `className`, `minHeight`, `autoResize`, `EventBus`, `SelectionManager` 전달
     */

    it('사용자 정의 className을 적용해야 함', async () => {
      // Given: classNames가 지정된 config
      const config: EditingAreaManagerConfig = {
        container,
        classNames: {
          wysiwyg: 'custom-wysiwyg',
          html: 'custom-html',
          text: 'custom-text',
        },
      }
      manager = new EditingAreaManager(config)

      // When: 초기화
      await manager.initialize()

      // Then: WYSIWYG 영역에 사용자 정의 클래스가 적용됨
      const wysiwygArea = manager.getCurrentArea()
      expect(wysiwygArea?.getElement().className).toBe('custom-wysiwyg')
    })

    it('minHeight를 적용해야 함', async () => {
      // Given: minHeight가 지정된 config
      const config: EditingAreaManagerConfig = {
        container,
        minHeight: 500,
      }
      manager = new EditingAreaManager(config)

      // When: 초기화
      await manager.initialize()

      // Then: 영역에 minHeight 스타일이 적용됨
      const wysiwygArea = manager.getCurrentArea()
      expect(wysiwygArea?.getElement().style.minHeight).toBe('500px')
    })

    it('autoResize를 활성화해야 함', async () => {
      // Given: autoResize가 활성화된 config
      const config: EditingAreaManagerConfig = {
        container,
        autoResize: true,
      }

      // When: 매니저 생성
      // Then: 오류 없이 생성됨
      expect(() => {
        manager = new EditingAreaManager(config)
      }).not.toThrow()
    })

    it('SelectionManager를 WYSIWYG 영역에 전달해야 함', async () => {
      // Given: SelectionManager가 포함된 config
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

      // Then: 오류 없이 WYSIWYG 모드로 초기화됨
      expect(manager.getCurrentMode()).toBe('wysiwyg')

      document.body.removeChild(editableDiv)
    })

    it('EventBus를 영역에 전달해야 함', async () => {
      // Given: EventBus와 콘텐츠 변경 핸들러가 설정된 config
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('WYSIWYG_CONTENT_CHANGED', 'on', handler)

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()

      // When: WYSIWYG 영역에서 input 이벤트 발생
      const wysiwygArea = manager.getCurrentArea()
      const element = wysiwygArea?.getElement() as HTMLDivElement
      element.dispatchEvent(new Event('input', { bubbles: true }))

      // Then: 콘텐츠 변경 핸들러가 호출됨
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('영역 언로드 (메모리 해제)', () => {
    /**
     * Why: 더 이상 사용하지 않는 영역의 메모리를 해제하여 리소스 효율성 확보
     * How: `unloadArea()`로 현재가 아닌 영역을 메모리에서 제거
     */

    beforeEach(async () => {
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()
    })

    it('현재가 아닌 영역을 언로드해야 함', async () => {
      // Given: HTML 영역으로 전환 후 다시 WYSIWYG으로 복귀
      await manager.switchMode('html')
      await manager.switchMode('wysiwyg')

      // When: HTML 영역 언로드
      await manager.unloadArea('html')

      // Then: HTML 영역이 미로드 상태
      expect(manager.isAreaLoaded('html')).toBe(false)
    })

    it('현재 영역 언로드 시 오류를 발생시켜야 함', async () => {
      // Given: WYSIWYG 모드가 현재 상태

      // When & Then: 현재 영역 언로드 시도 시 오류 발생
      await expect(manager.unloadArea('wysiwyg')).rejects.toThrow(
        '현재 편집 영역은 언로드할 수 없습니다'
      )
    })

    it('현재가 아닌 텍스트 영역 언로드를 허용해야 함', async () => {
      // Given: Text 영역으로 전환 후 다시 WYSIWYG으로 복귀
      await manager.switchMode('text')
      await manager.switchMode('wysiwyg')

      // When: Text 영역 언로드
      await manager.unloadArea('text')

      // Then: Text 영역이 미로드 상태
      expect(manager.isAreaLoaded('text')).toBe(false)
    })
  })

  describe('정리 (리소스 해제)', () => {
    /**
     * Why: 에디터 종료 시 모든 리소스를 해제하여 메모리 누수 방지
     * How: `destroy()`로 모든 영역과 리소스 정리, 이벤트 발행
     */

    it('모든 로드된 영역을 파기해야 함', async () => {
      // Given: 모든 영역이 로드된 매니저
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()

      await manager.switchMode('html')
      await manager.switchMode('text')

      // When: 매니저 파기
      manager.destroy()

      // Then: 모든 영역이 미로드 상태
      expect(manager.isAreaLoaded('wysiwyg')).toBe(false)
      expect(manager.isAreaLoaded('html')).toBe(false)
      expect(manager.isAreaLoaded('text')).toBe(false)
    })

    it('파기 이벤트를 발행해야 함', async () => {
      // Given: EventBus와 파기 핸들러가 설정된 매니저
      const eventBus = new EventBus()
      const handler = vi.fn()
      eventBus.on('EDITING_AREA_DESTROYED', 'on', handler)

      const config: EditingAreaManagerConfig = {
        container,
        eventBus,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()

      // When: 매니저 파기
      manager.destroy()

      // Then: EDITING_AREA_DESTROYED 이벤트가 발행됨
      expect(handler).toHaveBeenCalled()
    })

    it('컨테이너에서 모든 요소를 제거해야 함', async () => {
      // Given: 모든 영역이 로드된 매니저
      const config: EditingAreaManagerConfig = {
        container,
      }
      manager = new EditingAreaManager(config)
      await manager.initialize()

      await manager.switchMode('html')
      await manager.switchMode('text')

      // When: 매니저 파기
      manager.destroy()

      // Then: 컨테이너에 편집 영역 요소가 없음
      expect(container.querySelector('div[contenteditable]')).toBeNull()
      expect(container.querySelector('textarea')).toBeNull()
    })
  })
})
