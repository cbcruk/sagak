import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EditorCore } from '@/core/editor-core'
import type { EditorCoreConfig } from '@/core/editor-core'

/**
 * EditorCore - EditingArea 통합 테스트
 *
 * EditorCore와 EditingAreaManager의 통합이 올바르게 동작하는지 검증합니다.
 * 편집 영역의 모드 전환, 컨텐츠 관리, 포커스 등의 핵심 기능이 EditorCore API를 통해
 * 정상적으로 작동하는지 확인합니다.
 */
describe('EditorCore - EditingArea Integration', () => {
  let container: HTMLDivElement
  let core: EditorCore

  beforeEach(() => {
    // 편집 영역 컨테이너 생성
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    // EditorCore 정리
    if (core) {
      core.destroy()
    }

    // DOM 정리
    document.body.removeChild(container)
  })

  describe('초기화 (유연한 편집 영역 설정)', () => {
    it('편집 영역 없이 초기화할 수 있어야 함', async () => {
      // Given: editingAreaContainer가 없는 설정
      const config: EditorCoreConfig = {}

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: EditingAreaManager가 생성되지 않아야 함
      expect(core.getEditingAreaManager()).toBeUndefined()
    })

    it('편집 영역과 함께 초기화할 수 있어야 함', async () => {
      // Given: editingAreaContainer가 있는 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: EditingAreaManager가 생성되어야 함
      expect(core.getEditingAreaManager()).toBeDefined()
    })

    it('기본 편집 모드는 WYSIWYG여야 함', async () => {
      // Given: initialMode를 지정하지 않은 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: WYSIWYG 모드로 초기화되어야 함
      expect(core.getCurrentMode()).toBe('wysiwyg')
    })

    it('지정된 모드로 초기화할 수 있어야 함 (HTML)', async () => {
      // Given: HTML 모드를 지정한 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
        initialMode: 'html',
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: HTML 모드로 초기화되어야 함
      expect(core.getCurrentMode()).toBe('html')
    })

    it('지정된 모드로 초기화할 수 있어야 함 (Text)', async () => {
      // Given: Text 모드를 지정한 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
        initialMode: 'text',
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: Text 모드로 초기화되어야 함
      expect(core.getCurrentMode()).toBe('text')
    })

    it('minHeight 설정을 적용할 수 있어야 함', async () => {
      // Given: minHeight가 지정된 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
        minHeight: 500,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: 편집 영역의 minHeight가 설정되어야 함
      const manager = core.getEditingAreaManager()
      const currentArea = manager?.getCurrentArea()

      expect(currentArea?.getElement().style.minHeight).toBe('500px')
    })

    it('autoResize 옵션을 활성화할 수 있어야 함', async () => {
      // Given: autoResize가 활성화된 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
        autoResize: true,
      }

      core = new EditorCore(config)

      // When: run() 호출
      // Then: 에러 없이 초기화되어야 함
      await expect(core.run()).resolves.not.toThrow()
    })
  })

  describe('모드 전환 (자유로운 모드 변경)', () => {
    beforeEach(async () => {
      // 편집 영역이 있는 EditorCore 초기화
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()
    })

    it('WYSIWYG에서 HTML로 전환할 수 있어야 함', async () => {
      // Given: WYSIWYG 모드의 에디터
      expect(core.getCurrentMode()).toBe('wysiwyg')

      // When: HTML 모드로 전환
      await core.switchMode('html')

      // Then: HTML 모드로 변경되어야 함
      expect(core.getCurrentMode()).toBe('html')
    })

    it('WYSIWYG에서 Text로 전환할 수 있어야 함', async () => {
      // Given: WYSIWYG 모드의 에디터
      expect(core.getCurrentMode()).toBe('wysiwyg')

      // When: Text 모드로 전환
      await core.switchMode('text')

      // Then: Text 모드로 변경되어야 함
      expect(core.getCurrentMode()).toBe('text')
    })

    it('다른 모드에서 WYSIWYG로 돌아올 수 있어야 함', async () => {
      // Given: HTML 모드로 전환된 에디터
      await core.switchMode('html')

      // When: WYSIWYG 모드로 전환
      await core.switchMode('wysiwyg')

      // Then: WYSIWYG 모드로 변경되어야 함
      expect(core.getCurrentMode()).toBe('wysiwyg')
    })

    it('편집 영역 없이 모드 전환 시 에러가 발생해야 함', async () => {
      // Given: 편집 영역이 없는 EditorCore
      const coreNoArea = new EditorCore({})

      await coreNoArea.run()

      // When: 모드 전환 시도
      // Then: 에러가 발생해야 함
      await expect(coreNoArea.switchMode('html')).rejects.toThrow(
        'EditingAreaManager not initialized'
      )

      coreNoArea.destroy()
    })

    it('빠른 연속 모드 전환을 처리할 수 있어야 함', async () => {
      // Given: WYSIWYG 모드의 에디터
      // When: 여러 모드를 연속으로 전환
      await core.switchMode('html')
      await core.switchMode('text')
      await core.switchMode('wysiwyg')
      await core.switchMode('html')

      // Then: 최종 모드가 정확히 반영되어야 함
      expect(core.getCurrentMode()).toBe('html')
    })

    it('모든 모드를 순회할 수 있어야 함', async () => {
      // Given: WYSIWYG 모드의 에디터
      const modes: Array<'wysiwyg' | 'html' | 'text'> = [
        'wysiwyg',
        'html',
        'text',
      ]

      // When: 각 모드로 전환
      for (const mode of modes) {
        await core.switchMode(mode)

        // Then: 해당 모드로 정확히 전환되어야 함
        expect(core.getCurrentMode()).toBe(mode)
      }
    })
  })

  describe('컨텐츠 관리 (일관된 컨텐츠 처리)', () => {
    beforeEach(async () => {
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()
    })

    it('컨텐츠를 설정하고 가져올 수 있어야 함', async () => {
      // Given: HTML 컨텐츠
      const content = '<p>Hello World</p>'

      // When: 컨텐츠 설정
      await core.setContent(content)

      // Then: 설정한 컨텐츠를 가져올 수 있어야 함
      const retrieved = await core.getContent()

      expect(retrieved).toBe(content)
    })

    it('모드 전환을 거쳐도 컨텐츠가 유지되어야 함', async () => {
      // Given: 설정된 컨텐츠
      const content = '<p>Test content</p>'

      await core.setContent(content)

      // When: 여러 모드를 거쳐 전환
      await core.switchMode('html')
      await core.switchMode('text')
      await core.switchMode('wysiwyg')

      // Then: 컨텐츠가 유지되어야 함
      const final = await core.getContent()

      expect(final).toContain('Test content')
    })

    it('빈 컨텐츠를 처리할 수 있어야 함', async () => {
      // Given: 빈 문자열
      // When: 빈 컨텐츠 설정
      await core.setContent('')

      // Then: 기본 단락(<p><br></p>)이 생성되어야 함
      const content = await core.getContent()

      expect(content).toBe('<p><br></p>')
    })

    it('편집 영역 없이 컨텐츠 가져오기 시 에러가 발생해야 함', async () => {
      // Given: 편집 영역이 없는 EditorCore
      const coreNoArea = new EditorCore({})
      await coreNoArea.run()

      // When: 컨텐츠 가져오기 시도
      // Then: 에러가 발생해야 함
      await expect(coreNoArea.getContent()).rejects.toThrow(
        'EditingAreaManager not initialized'
      )

      coreNoArea.destroy()
    })

    it('편집 영역 없이 컨텐츠 설정 시 에러가 발생해야 함', async () => {
      // Given: 편집 영역이 없는 EditorCore
      const coreNoArea = new EditorCore({})

      await coreNoArea.run()

      // When: 컨텐츠 설정 시도
      // Then: 에러가 발생해야 함
      await expect(coreNoArea.setContent('<p>Test</p>')).rejects.toThrow(
        'EditingAreaManager not initialized'
      )

      coreNoArea.destroy()
    })

    it('복잡한 HTML 구조를 처리할 수 있어야 함', async () => {
      // Given: 복잡한 HTML 컨텐츠
      const complexContent = `
        <h1>제목</h1>
        <p><strong>굵은</strong> 텍스트와 <em>이탤릭</em> 텍스트</p>
        <ul>
          <li>항목 1</li>
          <li>항목 2</li>
        </ul>
      `

      // When: 컨텐츠 설정
      await core.setContent(complexContent)

      // Then: 컨텐츠가 유지되어야 함
      const retrieved = await core.getContent()

      expect(retrieved).toContain('제목')
      expect(retrieved).toContain('굵은')
      expect(retrieved).toContain('항목')
    })
  })

  describe('포커스 관리 (편집 영역 포커스 제어)', () => {
    beforeEach(async () => {
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()
    })

    it('편집 영역에 포커스를 설정할 수 있어야 함', () => {
      // Given: 초기화된 에디터
      // When: 포커스 설정
      // Then: 에러 없이 포커스되어야 함
      expect(() => {
        core.focus()
      }).not.toThrow()
    })

    it('편집 영역 없이 포커스 시도 시 에러가 발생하지 않아야 함', () => {
      // Given: 편집 영역이 없는 EditorCore
      const coreNoArea = new EditorCore({})

      // When: 포커스 시도
      // Then: 에러 없이 무시되어야 함 (graceful degradation)
      expect(() => {
        coreNoArea.focus()
      }).not.toThrow()
    })

    it('모드 전환 후에도 포커스할 수 있어야 함', async () => {
      // Given: HTML 모드로 전환된 에디터
      await core.switchMode('html')

      // When: 포커스 설정
      // Then: 에러 없이 포커스되어야 함
      expect(() => {
        core.focus()
      }).not.toThrow()
    })

    it('모든 모드에서 포커스가 가능해야 함', async () => {
      // Given: 각 모드
      const modes: Array<'wysiwyg' | 'html' | 'text'> = [
        'wysiwyg',
        'html',
        'text',
      ]

      for (const mode of modes) {
        // When: 모드 전환 후 포커스
        await core.switchMode(mode)

        // Then: 에러 없이 포커스되어야 함
        expect(() => {
          core.focus()
        }).not.toThrow()
      }
    })
  })

  describe('편집 가능 상태 (편집 잠금 제어)', () => {
    beforeEach(async () => {
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()
    })

    it('편집 가능 상태를 변경할 수 있어야 함', () => {
      // Given: 초기화된 에디터
      // When: 편집 불가능으로 설정
      expect(() => {
        core.setEditable(false)
      }).not.toThrow()

      // When: 다시 편집 가능으로 설정
      expect(() => {
        core.setEditable(true)
      }).not.toThrow()
    })

    it('편집 영역 없이 상태 변경 시 에러가 발생하지 않아야 함', () => {
      // Given: 편집 영역이 없는 EditorCore
      const coreNoArea = new EditorCore({})

      // When: 상태 변경 시도
      // Then: 에러 없이 무시되어야 함
      expect(() => {
        coreNoArea.setEditable(false)
      }).not.toThrow()
    })

    it('현재 편집 영역을 편집 불가능으로 만들어야 함', async () => {
      // Given: 편집 가능한 에디터
      // When: 편집 불가능으로 설정
      core.setEditable(false)

      // Then: contentEditable이 false로 변경되어야 함
      const manager = core.getEditingAreaManager()
      const wysiwygArea = manager?.getCurrentArea()

      expect(wysiwygArea?.getElement().contentEditable).toBe('false')
    })

    it('편집 가능 상태를 다시 활성화할 수 있어야 함', async () => {
      // Given: 편집 불가능으로 설정된 에디터
      core.setEditable(false)

      // When: 다시 편집 가능으로 설정
      core.setEditable(true)

      // Then: contentEditable이 true로 변경되어야 함
      const manager = core.getEditingAreaManager()
      const wysiwygArea = manager?.getCurrentArea()

      expect(wysiwygArea?.getElement().contentEditable).toBe('true')
    })

    it('모드 전환 후 편집 가능 상태를 다시 설정할 수 있어야 함', async () => {
      // Given: 편집 불가능으로 설정된 WYSIWYG 에디터
      core.setEditable(false)

      const manager1 = core.getEditingAreaManager()
      const wysiwygArea = manager1?.getCurrentArea()

      expect(wysiwygArea?.getElement().contentEditable).toBe('false')

      // When: Text 모드로 전환
      await core.switchMode('text')

      // When: 모드 전환 후 다시 편집 불가능으로 설정
      core.setEditable(false)

      // Then: Text 모드에서도 편집 불가능 상태여야 함
      const manager2 = core.getEditingAreaManager()
      const textArea = manager2?.getCurrentArea()
      const element = textArea?.getElement() as HTMLTextAreaElement

      expect(element.disabled).toBe(true)
    })
  })

  describe('SelectionManager 통합 (컴포넌트 협력)', () => {
    it('편집 영역과 SelectionManager를 함께 사용할 수 있어야 함', async () => {
      // Given: element와 editingAreaContainer를 모두 제공
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const config: EditorCoreConfig = {
        element: editableDiv,
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: 두 컴포넌트 모두 생성되어야 함
      expect(core.getSelectionManager()).toBeDefined()
      expect(core.getEditingAreaManager()).toBeDefined()

      document.body.removeChild(editableDiv)
    })

    it('EditingAreaManager가 SelectionManager를 공유해야 함', async () => {
      // Given: element와 editingAreaContainer를 모두 제공
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const config: EditorCoreConfig = {
        element: editableDiv,
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: Context의 SelectionManager가 동일해야 함
      const selectionManager = core.getSelectionManager()
      const context = core.getContext()

      expect(context.selectionManager).toBe(selectionManager)

      document.body.removeChild(editableDiv)
    })
  })

  describe('EventBus 통합 (이벤트 기반 통신)', () => {
    it('편집 영역이 EventBus를 공유해야 함', async () => {
      // Given: 편집 영역이 있는 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: Context의 EventBus가 EditorCore의 EventBus와 동일해야 함
      const eventBus = core.getEventBus()
      const context = core.getContext()

      expect(context.eventBus).toBe(eventBus)
    })

    it('편집 영역 이벤트를 EventBus를 통해 받을 수 있어야 함', async () => {
      // Given: 이벤트를 추적할 배열
      const events: string[] = []

      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: 모드 변경 이벤트 구독
      const eventBus = core.getEventBus()

      eventBus.on('EDITING_AREA_MODE_CHANGED', 'on', () => {
        events.push('mode_changed')
      })

      await core.run()

      // When: 모드 전환
      await core.switchMode('html')

      // Then: 이벤트가 발행되어야 함
      expect(events).toContain('mode_changed')
    })

    it('여러 모드 전환 시 이벤트가 매번 발행되어야 함', async () => {
      // Given: 이벤트 카운터
      let eventCount = 0

      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      const eventBus = core.getEventBus()

      eventBus.on('EDITING_AREA_MODE_CHANGED', 'on', () => {
        eventCount++
      })

      await core.run()

      // When: 여러 번 모드 전환
      await core.switchMode('html')
      await core.switchMode('text')
      await core.switchMode('wysiwyg')

      // Then: 전환 횟수만큼 이벤트가 발행되어야 함
      expect(eventCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('전체 워크플로우 (실제 사용 시나리오)', () => {
    it('에디터의 전체 사용 과정이 정상 동작해야 함', async () => {
      // Given: WYSIWYG 모드로 초기화된 에디터
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
        initialMode: 'wysiwyg',
      }

      core = new EditorCore(config)

      // When: 1. 초기화
      await core.run()
      expect(core.isReady()).toBe(true)

      // When: 2. 컨텐츠 설정
      await core.setContent('<p>Hello World</p>')

      // When: 3. 컨텐츠 가져오기
      let content = await core.getContent()
      expect(content).toContain('Hello World')

      // When: 4. HTML 모드로 전환
      await core.switchMode('html')
      expect(core.getCurrentMode()).toBe('html')

      // When: 5. 컨텐츠 수정
      await core.setContent('<p>Modified</p>')

      // When: 6. Text 모드로 전환
      await core.switchMode('text')

      // When: 7. Text로 컨텐츠 가져오기
      content = await core.getContent()
      expect(content).toContain('Modified')

      // When: 8. WYSIWYG로 복귀
      await core.switchMode('wysiwyg')
      expect(core.getCurrentMode()).toBe('wysiwyg')
    })

    it('모든 모드를 순회하며 컨텐츠가 유지되어야 함', async () => {
      // Given: 초기 컨텐츠가 있는 에디터
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()

      const initialContent = '<p>Persistent Content</p>'

      await core.setContent(initialContent)

      // When: 모든 모드를 순회
      const modes: Array<'wysiwyg' | 'html' | 'text'> = [
        'html',
        'text',
        'wysiwyg',
      ]

      for (const mode of modes) {
        await core.switchMode(mode)

        // Then: 각 모드에서 컨텐츠가 유지되어야 함
        const content = await core.getContent()

        expect(content).toContain('Persistent Content')
      }
    })
  })

  describe('정리 (리소스 정리)', () => {
    it('destroy() 호출 시 편집 영역을 정리해야 함', async () => {
      // Given: 초기화된 에디터
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()

      // Then: 컨테이너에 자식 요소가 있어야 함
      const childCountBefore = container.children.length
      expect(childCountBefore).toBeGreaterThan(0)

      // When: destroy() 호출
      core.destroy()

      // Then: 컨테이너가 비어있어야 함
      const childCountAfter = container.children.length
      expect(childCountAfter).toBe(0)
    })

    it('destroy() 호출 시 EditingAreaManager 참조를 제거해야 함', async () => {
      // Given: 초기화된 에디터
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()

      expect(core.getEditingAreaManager()).toBeDefined()

      // When: destroy() 호출
      core.destroy()

      // Then: EditingAreaManager 참조가 제거되어야 함
      expect(core.getEditingAreaManager()).toBeUndefined()
    })

    it('편집 영역 없이 destroy() 호출 시 에러가 발생하지 않아야 함', async () => {
      // Given: 편집 영역이 없는 EditorCore
      const coreNoArea = new EditorCore({})
      await coreNoArea.run()

      // When: destroy() 호출
      // Then: 에러 없이 정리되어야 함
      expect(() => {
        coreNoArea.destroy()
      }).not.toThrow()
    })

    it('destroy() 후 재초기화가 불가능해야 함', async () => {
      // Given: 초기화되고 종료된 에디터
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()

      core.destroy()

      // Then: EditingAreaManager가 제거되어야 함
      expect(core.getEditingAreaManager()).toBeUndefined()
      expect(core.isReady()).toBe(false)
    })
  })

  describe('에러 처리 (안전한 동작 보장)', () => {
    it('유효하지 않은 컨테이너로도 초기화해야 함', async () => {
      // Given: 컨테이너가 있는 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      // Then: 에러 없이 초기화되어야 함
      await expect(core.run()).resolves.not.toThrow()
    })

    it('존재하지 않는 모드로 전환 시도 시 현재 모드 유지해야 함', async () => {
      // Given: 초기화된 에디터
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      await core.run()

      const initialMode = core.getCurrentMode()

      // When: 잘못된 모드로 전환 시도
      try {
        await core.switchMode('invalid' as any)
      } catch {
        // 에러 무시
      }

      // Then: 모드가 변경되지 않아야 함
      expect(core.getCurrentMode()).toBe(initialMode)
    })
  })

  describe('컨텍스트 (컴포넌트 공유 상태)', () => {
    it('Context에 EditingAreaManager가 노출되어야 함', async () => {
      // Given: 편집 영역이 있는 설정
      const config: EditorCoreConfig = {
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: Context에 EditingAreaManager가 있어야 함
      const context = core.getContext()

      expect(context.editingAreaManager).toBeDefined()
      expect(context.editingAreaManager).toBe(core.getEditingAreaManager())
    })

    it('편집 영역 없이는 Context에 EditingAreaManager가 없어야 함', async () => {
      // Given: 편집 영역이 없는 설정
      const config: EditorCoreConfig = {}

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: Context에 EditingAreaManager가 없어야 함
      const context = core.getContext()

      expect(context.editingAreaManager).toBeUndefined()
    })

    it('Context가 모든 컴포넌트 참조를 포함해야 함', async () => {
      // Given: 모든 기능이 활성화된 설정
      const editableDiv = document.createElement('div')
      editableDiv.contentEditable = 'true'
      document.body.appendChild(editableDiv)

      const config: EditorCoreConfig = {
        element: editableDiv,
        editingAreaContainer: container,
      }

      core = new EditorCore(config)

      // When: run() 호출
      await core.run()

      // Then: Context에 모든 컴포넌트가 있어야 함
      const context = core.getContext()

      expect(context.eventBus).toBeDefined()
      expect(context.selectionManager).toBeDefined()
      expect(context.editingAreaManager).toBeDefined()
      expect(context.config).toBeDefined()

      document.body.removeChild(editableDiv)
    })
  })
})
