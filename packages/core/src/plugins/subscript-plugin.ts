import { definePlugin, CoreEvents, TextStyleEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 아래 첨자 플러그인 옵션
 */
export interface SubscriptPluginOptions extends BasePluginOptions {
  /**
   * 아래 첨자 명령을 수신할 이벤트 이름
   * @default `'SUBSCRIPT_CLICKED'`
   */
  eventName?: string
}

/**
 * 아래 첨자 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 아래 첨자 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const subscriptPlugin = createSubscriptPlugin({
 *   eventName: 'TOGGLE_SUBSCRIPT',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(subscriptPlugin);
 * eventBus.emit('TOGGLE_SUBSCRIPT'); // Applies subscript
 * ```
 */
export const createSubscriptPlugin = definePlugin<SubscriptPluginOptions>({
  name: 'text-style:subscript',

  compositionLabel: 'Subscript',

  defaultOptions: {
    eventName: TextStyleEvents.TOGGLE_SUBSCRIPT,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.TOGGLE_SUBSCRIPT]: ({
      emit,
      reportError,
      runCommand,
    }) => {
      try {
        const result = runCommand('subscript')
        if (result) {
          emit(CoreEvents.STYLE_CHANGED, { style: 'subscript' })
        }
        return result
      } catch (error) {
        reportError(error, 'Failed to execute subscript command:')
        return false
      }
    },
  }),
})

/**
 * 기본 아래 첨자 플러그인 인스턴스
 */
export const SubscriptPlugin = createSubscriptPlugin()
