import { definePlugin, ParagraphEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 순서없는 목록 플러그인 설정 옵션
 */
export interface UnorderedListPluginOptions extends BasePluginOptions {
  /**
   * 순서없는 목록 명령을 수신할 이벤트 이름
   * @default 'UNORDERED_LIST_CLICKED'
   */
  eventName?: string
}

/**
 * 순서없는 목록 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 순서없는 목록을 생성합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const unorderedListPlugin = createUnorderedListPlugin({
 *   eventName: 'UNORDERED_LIST_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(unorderedListPlugin);
 * eventBus.emit('UNORDERED_LIST_CLICKED'); // Toggle unordered list
 * ```
 */
export const createUnorderedListPlugin =
  definePlugin<UnorderedListPluginOptions>({
    name: 'paragraph:unordered-list',

    defaultOptions: {
      eventName: ParagraphEvents.UNORDERED_LIST_CLICKED,
      checkComposition: true,
    },

    handlers: (options) => ({
      [options.eventName ?? ParagraphEvents.UNORDERED_LIST_CLICKED]: {
        before: ({ selectionManager, options: opts }) => {
          if (opts.checkComposition && selectionManager?.getIsComposing()) {
            console.warn('Unordered list blocked: IME composition in progress')
            return false
          }
          return true
        },

        on: ({ emit }) => {
          try {
            const result = document.execCommand('insertUnorderedList', false)
            if (result) {
              emit(CoreEvents.STYLE_CHANGED, { style: 'unorderedList' })
            }
            return result
          } catch (error) {
            console.error('Failed to execute unordered list command:', error)
            return false
          }
        },

        after: () => {},
      },
    }),
  })

/**
 * 기본 순서없는 목록 플러그인 인스턴스
 */
export const UnorderedListPlugin = createUnorderedListPlugin()
