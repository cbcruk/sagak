import { definePlugin, ParagraphEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 순서있는 목록 플러그인 설정 옵션
 */
export interface OrderedListPluginOptions extends BasePluginOptions {
  /**
   * 순서있는 목록 명령을 수신할 이벤트 이름
   * @default 'ORDERED_LIST_CLICKED'
   */
  eventName?: string
}

/**
 * 순서있는 목록 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 순서있는 목록을 생성합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const orderedListPlugin = createOrderedListPlugin({
 *   eventName: 'ORDERED_LIST_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(orderedListPlugin);
 * eventBus.emit('ORDERED_LIST_CLICKED'); // Toggle ordered list
 * ```
 */
export const createOrderedListPlugin = definePlugin<OrderedListPluginOptions>({
  name: 'paragraph:ordered-list',

  defaultOptions: {
    eventName: ParagraphEvents.ORDERED_LIST_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.ORDERED_LIST_CLICKED]: {
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Ordered list blocked: IME composition in progress')
          return false
        }
        return true
      },

      on: ({ emit }) => {
        try {
          const result = document.execCommand('insertOrderedList', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'orderedList' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute ordered list command:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

/**
 * 기본 순서있는 목록 플러그인 인스턴스
 */
export const OrderedListPlugin = createOrderedListPlugin()
