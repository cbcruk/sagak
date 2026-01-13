import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { SelectionManager } from '@/core/selection-manager'
import { HeadingPlugin } from '@/plugins/heading-plugin'
import { AlignmentPlugin } from '@/plugins/alignment-plugin'
import { OrderedListPlugin } from '@/plugins/ordered-list-plugin'
import { UnorderedListPlugin } from '@/plugins/unordered-list-plugin'
import { IndentPlugin } from '@/plugins/indent-plugin'
import { OutdentPlugin } from '@/plugins/outdent-plugin'
import type { EditorContext } from '@/core/types'

describe('문단 플러그인 통합 (복합 문단 포맷)', () => {
  let eventBus: EventBus
  let pluginManager: PluginManager
  let selectionManager: SelectionManager
  let element: HTMLDivElement
  let context: EditorContext

  beforeEach(() => {
    // Given: 편집 가능한 요소와 에디터 컨텍스트 생성
    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>Hello World</p>'
    document.body.appendChild(element)

    eventBus = new EventBus()
    selectionManager = new SelectionManager(element)
    context = {
      eventBus,
      selectionManager,
      config: {},
    }
    pluginManager = new PluginManager(context)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  describe('다중 플러그인 등록 (여러 플러그인 초기화)', () => {
    /**
     * Why: 여러 문단 포맷 플러그인을 동시에 사용할 수 있어야 함
     * How: `PluginManager.register()`로 6개 플러그인을 등록하고 `has()`로 확인
     */

    it('모든 문단 플러그인을 등록해야 함', async () => {
      // Given: 플러그인 매니저 준비

      // When: 6개 문단 플러그인 등록
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)
      await pluginManager.register(UnorderedListPlugin)
      await pluginManager.register(IndentPlugin)
      await pluginManager.register(OutdentPlugin)

      // Then: 모든 플러그인이 등록되어야 함
      expect(pluginManager.has('paragraph:heading')).toBe(true)
      expect(pluginManager.has('paragraph:alignment')).toBe(true)
      expect(pluginManager.has('paragraph:ordered-list')).toBe(true)
      expect(pluginManager.has('paragraph:unordered-list')).toBe(true)
      expect(pluginManager.has('paragraph:indent')).toBe(true)
      expect(pluginManager.has('paragraph:outdent')).toBe(true)
      expect(pluginManager.size).toBe(6)
    })
  })

  describe('복합 문단 포맷 (여러 포맷 조합)', () => {
    /**
     * Why: 사용자가 제목, 정렬, 리스트, 들여쓰기 등 여러 포맷을 조합할 수 있어야 함
     * How: `EventBus.emit()`으로 여러 포맷 이벤트를 발생시키고 `execCommand` 호출 검증
     */

    beforeEach(async () => {
      // Given: 모든 문단 플러그인 등록
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)
      await pluginManager.register(UnorderedListPlugin)
      await pluginManager.register(IndentPlugin)
      await pluginManager.register(OutdentPlugin)
    })

    it('제목과 정렬을 함께 적용해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 제목 레벨 변경 후 가운데 정렬 적용
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: 각 포맷에 대해 execCommand가 올바른 순서로 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'formatBlock',
        false,
        '<h2>'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'justifyCenter', false)

      execCommandSpy.mockRestore()
    })

    it('리스트와 들여쓰기를 함께 적용해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 순서 있는 리스트 생성 후 들여쓰기 적용
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('INDENT_CLICKED')

      // Then: 리스트 생성과 들여쓰기 명령이 순서대로 호출되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'insertOrderedList',
        false
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'indent', false)

      execCommandSpy.mockRestore()
    })

    it('개별 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand Mock과 STYLE_CHANGED 리스너 설정
      vi.spyOn(document, 'execCommand').mockReturnValue(true)

      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: 제목, 정렬, 들여쓰기 적용
      eventBus.emit('HEADING_CHANGED', { level: 1 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'right' })
      eventBus.emit('INDENT_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 각 포맷에 대해 발생해야 함
      expect(styleChangedSpy).toHaveBeenCalledTimes(3)
      expect(styleChangedSpy).toHaveBeenNthCalledWith(1, {
        style: 'heading',
        value: 1,
      })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(2, {
        style: 'alignment',
        value: 'right',
      })
      expect(styleChangedSpy).toHaveBeenNthCalledWith(3, {
        style: 'indent',
      })

      vi.restoreAllMocks()
    })
  })

  describe('IME 조합 차단 (입력 중 포맷 차단)', () => {
    /**
     * Why: CJK 입력 중 문단 포맷 적용 시 문자 조합이 깨지는 것을 방지
     * How: `compositionstart` 이벤트로 조합 상태를 시뮬레이션하고 포맷 명령 차단 확인
     */

    beforeEach(async () => {
      // Given: 문단 관련 플러그인 등록
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)
      await pluginManager.register(IndentPlugin)
    })

    it('조합 중 모든 문단 명령을 차단해야 함', () => {
      // Given: console.warn Mock과 조합 시작
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(document, 'execCommand')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(selectionManager.getIsComposing()).toBe(true)

      // When: 조합 중 여러 문단 명령 시도
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('INDENT_CLICKED')

      // Then: 모든 명령이 차단되어야 함
      expect(execCommandSpy).not.toHaveBeenCalled()
      expect(consoleWarn).toHaveBeenCalledTimes(4)

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후 모든 명령을 허용해야 함', () => {
      // Given: execCommand Mock과 조합 시작 후 종료
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(selectionManager.getIsComposing()).toBe(false)

      // When: 조합 종료 후 모든 문단 명령 실행
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('INDENT_CLICKED')

      // Then: 모든 명령이 성공해야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: 한 플러그인의 에러가 다른 플러그인에 영향을 주지 않아야 함
     * How: `execCommand`가 선택적으로 실패하도록 Mock하고 독립적인 에러 처리 확인
     */

    beforeEach(async () => {
      // Given: 문단 관련 플러그인 등록
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)
    })

    it('에러를 독립적으로 처리해야 함', () => {
      // Given: formatBlock만 실패하도록 Mock 설정
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockImplementation((command) => {
          if (command === 'formatBlock') throw new Error('Heading failed')
          return true
        })

      // When: 제목, 정렬, 리스트 명령 실행
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: formatBlock 에러만 기록되고 나머지는 성공해야 함
      expect(consoleError).toHaveBeenCalledTimes(1)
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      consoleError.mockRestore()
      execCommandSpy.mockRestore()
    })
  })

  describe('실제 시나리오 (사용자 동작 시뮬레이션)', () => {
    /**
     * Why: 실제 사용자의 문서 편집 패턴을 시뮬레이션하여 통합 동작 확인
     * How: 제목 생성, 리스트 작성, 복잡한 포맷 조합 등 실제 시나리오 재현
     */

    beforeEach(async () => {
      // Given: 모든 문단 플러그인 등록
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)
      await pluginManager.register(UnorderedListPlugin)
      await pluginManager.register(IndentPlugin)
      await pluginManager.register(OutdentPlugin)
    })

    it('가운데 정렬 제목을 생성해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 H1 제목을 만들고 가운데 정렬 적용
      eventBus.emit('HEADING_CHANGED', { level: 1 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      // Then: 제목 포맷과 정렬이 순서대로 적용되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'formatBlock',
        false,
        '<h1>'
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'justifyCenter', false)

      execCommandSpy.mockRestore()
    })

    it('들여쓰기된 리스트를 생성해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 사용자가 순서 있는 리스트를 만들고 들여쓰기 적용
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('INDENT_CLICKED')

      // Then: 리스트 생성과 들여쓰기가 순서대로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(2)
      expect(execCommandSpy).toHaveBeenNthCalledWith(
        1,
        'insertOrderedList',
        false
      )
      expect(execCommandSpy).toHaveBeenNthCalledWith(2, 'indent', false)

      execCommandSpy.mockRestore()
    })

    it('들여쓰기를 유지하며 리스트 유형을 전환해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 순서 있는 리스트 생성, 들여쓰기, 순서 없는 리스트로 전환
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('INDENT_CLICKED')
      eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: 3개 명령이 순서대로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('오른쪽 정렬 제목과 리스트를 생성해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: H3 제목, 오른쪽 정렬, 순서 있는 리스트 적용
      eventBus.emit('HEADING_CHANGED', { level: 3 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'right' })
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: 3개 명령이 순서대로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(3)

      execCommandSpy.mockRestore()
    })

    it('다단계 리스트 들여쓰기를 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 리스트 생성 후 2단계 들여쓰기, 1단계 내어쓰기
      eventBus.emit('ORDERED_LIST_CLICKED')
      eventBus.emit('INDENT_CLICKED')
      eventBus.emit('INDENT_CLICKED')
      eventBus.emit('OUTDENT_CLICKED')

      // Then: 4개 명령이 순서대로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(4)

      execCommandSpy.mockRestore()
    })

    it('문서 섹션 포맷을 처리해야 함', () => {
      // Given: execCommand Mock 설정
      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 제목, 부제목, 본문 리스트를 순서대로 포맷
      eventBus.emit('HEADING_CHANGED', { level: 1 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })

      eventBus.emit('HEADING_CHANGED', { level: 3 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'left' })
      eventBus.emit('UNORDERED_LIST_CLICKED')

      // Then: 7개 명령이 순서대로 실행되어야 함
      expect(execCommandSpy).toHaveBeenCalledTimes(7)

      execCommandSpy.mockRestore()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인이 올바르게 정리되어 메모리 누수를 방지해야 함
     * How: `PluginManager.destroyAll()` 및 `remove()`로 정리 후 이벤트 미반응 확인
     */

    it('모든 플러그인을 함께 정리해야 함', async () => {
      // Given: 6개 문단 플러그인 등록
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)
      await pluginManager.register(UnorderedListPlugin)
      await pluginManager.register(IndentPlugin)
      await pluginManager.register(OutdentPlugin)

      expect(pluginManager.size).toBe(6)

      // When: 모든 플러그인 정리
      pluginManager.destroyAll()

      // Then: 모든 플러그인이 제거되어야 함
      expect(pluginManager.size).toBe(0)
    })

    it('정리 후 이벤트에 반응하지 않아야 함', async () => {
      // Given: 문단 관련 플러그인 등록 후 정리
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      pluginManager.destroyAll()

      // When: 정리 후 문단 포맷 이벤트 발생
      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: execCommand가 호출되지 않아야 함
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('플러그인을 독립적으로 제거해야 함', async () => {
      // Given: 문단 관련 플러그인 등록 후 execCommand Mock 설정
      await pluginManager.register(HeadingPlugin)
      await pluginManager.register(AlignmentPlugin)
      await pluginManager.register(OrderedListPlugin)

      const execCommandSpy = vi
        .spyOn(document, 'execCommand')
        .mockReturnValue(true)

      // When: 제목 플러그인만 제거
      pluginManager.remove('paragraph:heading')

      eventBus.emit('HEADING_CHANGED', { level: 2 })
      eventBus.emit('ALIGNMENT_CHANGED', { align: 'center' })
      eventBus.emit('ORDERED_LIST_CLICKED')

      // Then: 제목 명령은 실행되지 않고 나머지만 동작해야 함
      expect(execCommandSpy).not.toHaveBeenCalledWith(
        'formatBlock',
        false,
        '<h2>'
      )
      expect(execCommandSpy).toHaveBeenCalledTimes(2)

      execCommandSpy.mockRestore()
    })
  })
})
