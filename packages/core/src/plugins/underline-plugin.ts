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

  compositionLabel: 'Underline',

  defaultOptions: {
    eventName: TextStyleEvents.UNDERLINE_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.UNDERLINE_CLICKED]: ({
      emit,
      reportError,
      runCommand,
    }) => {
      try {
        const result = runCommand('underline')
        if (result) {
          emit(CoreEvents.STYLE_CHANGED, { style: 'underline' })
        }
        return result
      } catch (error) {
        reportError(error, 'Failed to execute underline command:')
        return false
      }
    },
  }),
})

/**
 * 기본 밑줄 플러그인 인스턴스
 */
export const UnderlinePlugin = createUnderlinePlugin()
