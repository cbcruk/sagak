import { definePlugin, TextStyleEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 밑줄 플러그인 옵션
 */
export interface UnderlinePluginOptions extends BasePluginOptions {
  /**
   * 밑줄 명령을 수신할 이벤트 이름
   * @default `'UNDERLINE_CLICKED'`
   */
  eventName?: string
}

/**
 * 밑줄 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 밑줄 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const underlinePlugin = createUnderlinePlugin({
 *   eventName: 'UNDERLINE_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(underlinePlugin);
 * eventBus.emit('UNDERLINE_CLICKED'); // Applies underline
 * ```
 */
export const createUnderlinePlugin = definePlugin<UnderlinePluginOptions>({
  name: 'text-style:underline',

  defaultOptions: {
    eventName: TextStyleEvents.UNDERLINE_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.UNDERLINE_CLICKED]: {
      // `BEFORE` 단계: 밑줄 서식 적용 가능 여부 확인
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Underline blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 밑줄 명령 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('underline', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'underline' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute underline command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등
      after: () => {},
    },
  }),
})

/**
 * 기본 밑줄 플러그인 인스턴스
 */
export const UnderlinePlugin = createUnderlinePlugin()
