import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { CompositionTracker } from '@/core/composition'
import { EventBus } from '@/core/event-bus'
import { PluginManager } from '@/core/plugin-manager'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'
import { createItalicPlugin, ItalicPlugin } from '@/plugins/italic-plugin'
import type { EditorContext } from '@/core/types'

describe('ItalicPlugin (기울임 텍스트 스타일 적용)', () => {
  let ed: PluginArea
  let eventBus: EventBus
  let pluginManager: PluginManager
  let composition: CompositionTracker
  let element: HTMLElement
  let context: EditorContext

  beforeEach(() => {
    /*
     * 예전에는 맨 `contentEditable` div 하나였습니다. 서식이 문서 모델 위로
     * 옮겨가면서 커맨드가 그 div 를 고치지 않으므로, 검사도 편집 영역을
     * 세웁니다 (`test/helpers/plugin-area.ts`).
     */
    ed = mountPluginArea()
    ;({ eventBus, pluginManager, composition, element, context } = ed)
  })

  afterEach(() => {
    ed.destroy()
  })

  describe('플러그인 등록 (기본 초기화)', () => {
    /**
     * Why: 플러그인이 `PluginManager`에 올바르게 등록되어야 사용 가능
     * How: `register()` 호출 후 `has()` 및 `size`로 등록 확인
     */

    it('ItalicPlugin을 등록해야 함', async () => {
      // Given: 빈 PluginManager

      // When: ItalicPlugin 등록
      await pluginManager.register(ItalicPlugin)

      // Then: 플러그인이 등록됨
      expect(pluginManager.has('text-style:italic')).toBe(true)
      expect(pluginManager.size).toBe(1)
    })

    it('커스텀 옵션으로 플러그인을 생성해야 함', async () => {
      // Given: 커스텀 옵션이 적용된 플러그인
      const customPlugin = createItalicPlugin({
        eventName: 'CUSTOM_ITALIC',
        checkComposition: false,
      })

      // When: 커스텀 플러그인 등록
      await pluginManager.register(customPlugin)

      // Then: 동일한 이름으로 등록됨
      expect(pluginManager.has('text-style:italic')).toBe(true)
    })
  })

  describe('기울임 명령 실행 (execCommand 호출)', () => {
    /**
     * Why: 사용자가 기울임 버튼 클릭 시 선택된 텍스트에 기울임 스타일 적용
     * How: `ITALIC_CLICKED` 이벤트 수신 → `execCommand('italic')` 실행
     */

    beforeEach(async () => {
      await pluginManager.register(ItalicPlugin)
    })

    it('ITALIC_CLICKED 이벤트에서 기울임 명령을 실행해야 함', () => {
      // Given: 텍스트가 선택된 상태
      ed.select(1, 6)  /* 'Hello' 만 */

      // When: ITALIC_CLICKED 이벤트 발생
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: 선택 구간이 em으로 감싸져야 함
      expect(result).toBe(true)
      expect(element.querySelector('em')?.textContent).toBe('Hello')
    })

    it('기울임 성공 후 STYLE_CHANGED 이벤트를 발생시켜야 함', () => {
      // Given: execCommand가 성공하는 상태
      vi.spyOn(context.commandRegistry!, 'run').mockReturnValue(true)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      ed.selectAll()

      // When: ITALIC_CLICKED 이벤트 발생
      eventBus.emit('ITALIC_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발생함
      expect(styleChangedSpy).toHaveBeenCalledWith({ style: 'italic' })

      vi.restoreAllMocks()
    })

    it('execCommand 실패 시 STYLE_CHANGED를 발생시키지 않아야 함', () => {
      // Given: execCommand가 실패하는 상태
      vi.spyOn(context.commandRegistry!, 'run').mockReturnValue(false)
      const styleChangedSpy = vi.fn()
      eventBus.on('STYLE_CHANGED', 'on', styleChangedSpy)

      // When: ITALIC_CLICKED 이벤트 발생
      eventBus.emit('ITALIC_CLICKED')

      // Then: STYLE_CHANGED 이벤트가 발생하지 않음
      expect(styleChangedSpy).not.toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })

  describe('CJK/IME 입력 지원 (조합 문자 처리)', () => {
    /**
     * Why: 한글 등 조합 문자 입력 중 스타일 변경 시 입력이 깨질 수 있음
     * How: `CompositionTracker.isComposing()`으로 조합 상태 확인 후 차단
     */

    beforeEach(async () => {
      await pluginManager.register(ItalicPlugin)
    })

    it('IME 입력 중에는 기울임을 차단해야 함', () => {
      // Given: IME 조합 중인 상태
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const execCommandSpy = vi.spyOn(context.commandRegistry!, 'run')

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(composition.isComposing()).toBe(true)

      // When: 기울임 명령 시도
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: BEFORE 단계에서 차단됨
      expect(result).toBe(false)
      expect(consoleWarn).toHaveBeenCalledWith(
        'Italic blocked: IME composition in progress'
      )
      expect(execCommandSpy).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
      execCommandSpy.mockRestore()
    })

    it('조합 종료 후에는 기울임을 허용해야 함', () => {
      // Given: IME 조합이 종료된 상태
      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.dispatchEvent(new CompositionEvent('compositionend'))
      expect(composition.isComposing()).toBe(false)

      ed.select(1, 6)  /* 'Hello' 만 */

      // When: 기울임 명령 실행
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: 정상적으로 실행되어 기울임이 적용됨
      expect(result).toBe(true)
      expect(element.querySelector('em')?.textContent).toBe('Hello')
    })

    it('checkComposition이 false일 때 기울임을 허용해야 함', async () => {
      // Given: checkComposition이 비활성화된 플러그인
      pluginManager.destroyAll()

      const customPlugin = createItalicPlugin({
        checkComposition: false,
      })

      const newContext = { ...context }
      const newManager = new PluginManager(newContext)
      await newManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(context.commandRegistry!, 'run')
        .mockReturnValue(true)

      element.dispatchEvent(new CompositionEvent('compositionstart'))
      expect(composition.isComposing()).toBe(true)

      // When: IME 조합 중에도 기울임 명령 실행
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: 차단 없이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      newManager.destroyAll()
    })
  })

  describe('이벤트 단계 (3단계 실행 흐름)', () => {
    /**
     * Why: 이벤트 실행 전/중/후 처리를 위한 3단계 흐름 검증
     * How: `EventBus`의 BEFORE/ON/AFTER 단계 순차 실행 확인
     */

    beforeEach(async () => {
      await pluginManager.register(ItalicPlugin)
    })

    it('3단계(BEFORE/ON/AFTER)를 모두 실행해야 함', () => {
      // Given: 각 단계별 리스너 등록
      vi.spyOn(context.commandRegistry!, 'run').mockReturnValue(true)

      const beforeSpy = vi.fn().mockReturnValue(true)
      const onSpy = vi.fn().mockReturnValue(true)
      const afterSpy = vi.fn()

      eventBus.on('ITALIC_CLICKED', 'before', beforeSpy)
      eventBus.on('ITALIC_CLICKED', 'on', onSpy)
      eventBus.on('ITALIC_CLICKED', 'after', afterSpy)

      // When: 이벤트 발생
      eventBus.emit('ITALIC_CLICKED')

      // Then: 모든 단계가 실행됨
      expect(beforeSpy).toHaveBeenCalled()
      expect(onSpy).toHaveBeenCalled()
      expect(afterSpy).toHaveBeenCalled()

      vi.restoreAllMocks()
    })

    it('차단 시 BEFORE 단계에서 중단해야 함', () => {
      // Given: BEFORE 단계에서 차단되는 상태 (IME 조합 중)
      const onSpy = vi.fn()
      const afterSpy = vi.fn()

      eventBus.on('ITALIC_CLICKED', 'on', onSpy)
      eventBus.on('ITALIC_CLICKED', 'after', afterSpy)

      element.dispatchEvent(new CompositionEvent('compositionstart'))

      // When: 이벤트 발생
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: ON/AFTER 단계가 실행되지 않음
      expect(result).toBe(false)
      expect(onSpy).not.toHaveBeenCalled()
      expect(afterSpy).not.toHaveBeenCalled()
    })
  })

  describe('커스텀 이벤트 이름 (이벤트 설정)', () => {
    /**
     * Why: 다른 이벤트 이름으로 플러그인을 사용할 수 있어야 함
     * How: `createItalicPlugin({ eventName })` 옵션으로 커스텀 이벤트 설정
     */

    it('커스텀 이벤트 이름을 수신해야 함', async () => {
      // Given: 커스텀 이벤트 이름이 설정된 플러그인
      const customPlugin = createItalicPlugin({
        eventName: 'MY_ITALIC_EVENT',
      })
      await pluginManager.register(customPlugin)

      const execCommandSpy = vi
        .spyOn(context.commandRegistry!, 'run')
        .mockReturnValue(true)

      // When: 커스텀 이벤트 발생
      const result = eventBus.emit('MY_ITALIC_EVENT')

      // Then: 기울임 명령이 실행됨
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledWith('italic', undefined)

      execCommandSpy.mockRestore()
    })

    it('커스텀 이름 사용 시 기본 이벤트에 반응하지 않아야 함', async () => {
      // Given: 커스텀 이벤트 이름이 설정된 플러그인
      const customPlugin = createItalicPlugin({
        eventName: 'MY_ITALIC_EVENT',
      })
      await pluginManager.register(customPlugin)

      const execCommandSpy = vi.spyOn(context.commandRegistry!, 'run')

      // When: 기본 이벤트 발생
      eventBus.emit('ITALIC_CLICKED')

      // Then: 반응하지 않음
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })
  })

  describe('에러 처리 (예외 상황 대응)', () => {
    /**
     * Why: execCommand 실패 시에도 에디터가 안정적으로 동작해야 함
     * How: try-catch로 예외 처리 후 에러 로깅
     */

    beforeEach(async () => {
      await pluginManager.register(ItalicPlugin)
    })

    it('execCommand 에러를 안전하게 처리해야 함', () => {
      // Given: execCommand가 에러를 던지는 상태
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      vi.spyOn(context.commandRegistry!, 'run').mockImplementation(() => {
        throw new Error('execCommand failed')
      })

      // When: 이벤트 발생
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: 에러가 안전하게 처리됨
      expect(result).toBe(false)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to execute italic command:',
        expect.any(Error)
      )

      consoleError.mockRestore()
      vi.restoreAllMocks()
    })
  })

  describe('플러그인 생명주기 (초기화/정리)', () => {
    /**
     * Why: 플러그인 제거 시 이벤트 리스너가 정리되어야 메모리 누수 방지
     * How: `destroy()` 호출 시 등록된 리스너 제거 확인
     */

    it('destroy 시 정리를 수행해야 함', async () => {
      // Given: 등록된 플러그인
      await pluginManager.register(ItalicPlugin)

      const execCommandSpy = vi
        .spyOn(context.commandRegistry!, 'run')
        .mockReturnValue(true)

      let result = eventBus.emit('ITALIC_CLICKED')
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalledTimes(1)

      // When: 플러그인 정리
      pluginManager.destroyAll()

      // Then: 더 이상 이벤트에 반응하지 않음
      execCommandSpy.mockClear()
      result = eventBus.emit('ITALIC_CLICKED')
      expect(execCommandSpy).not.toHaveBeenCalled()

      execCommandSpy.mockRestore()
    })

    it('destroy 후 재등록을 허용해야 함', async () => {
      // Given: 정리된 플러그인
      await pluginManager.register(ItalicPlugin)
      pluginManager.destroyAll()

      const newContext = {
        eventBus: new EventBus(),
        composition,
        config: {},
      }
      const newManager = new PluginManager(newContext)

      // When: 재등록 시도
      await expect(newManager.register(ItalicPlugin)).resolves.not.toThrow()

      // Then: 정상적으로 등록됨
      expect(newManager.has('text-style:italic')).toBe(true)

      newManager.destroyAll()
    })
  })

  describe('CompositionTracker 통합 (선택 영역 연동)', () => {
    /**
     * Why: 저장/복원된 선택 영역에서도 스타일이 적용되어야 함
     * How: `CompositionTracker`와 연동하여 선택 영역 관리
     */

    beforeEach(async () => {
      await pluginManager.register(ItalicPlugin)
    })

    it('저장/복원된 선택 영역에서 동작해야 함', () => {
      // Given: 저장 후 복원된 선택 영역
      vi.spyOn(context.commandRegistry!, 'run').mockReturnValue(true)

      ed.selectAll()

      /*
       * 선택은 문서 상태의 일부라 저장·복원이 **다른 자리**로 옮겨갔습니다 —
       * `CompositionTracker` 가 아니라 편집 영역입니다. 캐럿만 남겨 두었다가
       * 되돌려도 서식이 그대로 걸려야 합니다.
       */
      ed.area.saveSelection()
      ed.collapse()
      ed.area.restoreSelection()

      // When: 기울임 명령 실행
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: 정상적으로 동작함
      expect(result).toBe(true)

      vi.restoreAllMocks()
    })

    it('context에 CompositionTracker가 없어도 실행해야 함', async () => {
      // Given: CompositionTracker 없는 컨텍스트
      pluginManager.destroyAll()

      const contextWithoutSM = { ...context, composition: undefined }
      const managerWithoutSM = new PluginManager(contextWithoutSM)
      await managerWithoutSM.register(ItalicPlugin)

      const execCommandSpy = vi
        .spyOn(context.commandRegistry!, 'run')
        .mockReturnValue(true)

      // When: 이벤트 발생
      const result = eventBus.emit('ITALIC_CLICKED')

      // Then: 정상적으로 실행됨 (IME 체크 건너뜀)
      expect(result).toBe(true)
      expect(execCommandSpy).toHaveBeenCalled()

      execCommandSpy.mockRestore()
      managerWithoutSM.destroyAll()
    })
  })
})
