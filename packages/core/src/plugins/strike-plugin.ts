import { definePlugin, TextStyleEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 취소선 플러그인 옵션
 */
export interface StrikePluginOptions extends BasePluginOptions {
  /**
   * 취소선 명령을 수신할 이벤트 이름
   * @default `'STRIKE_CLICKED'`
   */
  eventName?: string
}

/**
 * 취소선 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 취소선 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const strikePlugin = createStrikePlugin({
 *   eventName: 'STRIKE_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(strikePlugin);
 * eventBus.emit('STRIKE_CLICKED'); // Applies strikethrough
 * ```
 */
export const createStrikePlugin = definePlugin<StrikePluginOptions>({
  name: 'text-style:strike',

  defaultOptions: {
    eventName: TextStyleEvents.STRIKE_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.STRIKE_CLICKED]: {
      // `BEFORE` 단계: 취소선 서식 적용 가능 여부 확인
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Strike blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 취소선 명령 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('strikeThrough', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'strike' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute strike command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등
      after: () => {},
    },
  }),
})

/**
 * 기본 취소선 플러그인 인스턴스
 */
export const StrikePlugin = createStrikePlugin()
