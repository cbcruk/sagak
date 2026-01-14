import { definePlugin, TextStyleEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * Bold 플러그인 옵션
 */
export interface BoldPluginOptions extends BasePluginOptions {
  /**
   * Bold 명령을 수신할 이벤트 이름
   * @default `'BOLD_CLICKED'`
   */
  eventName?: string
}

/**
 * Bold 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 Bold 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const boldPlugin = createBoldPlugin({
 *   eventName: 'BOLD_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(boldPlugin);
 * eventBus.emit('BOLD_CLICKED'); // Applies bold
 * ```
 */
export const createBoldPlugin = definePlugin<BoldPluginOptions>({
  name: 'text-style:bold',

  defaultOptions: {
    eventName: TextStyleEvents.BOLD_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.BOLD_CLICKED]: {
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Bold blocked: IME composition in progress')
          return false
        }
        return true
      },

      on: ({ emit }) => {
        try {
          emit(CoreEvents.CAPTURE_SNAPSHOT)
          const result = document.execCommand('bold', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'bold' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute bold command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 Bold 플러그인 인스턴스
 */
export const BoldPlugin = createBoldPlugin()
