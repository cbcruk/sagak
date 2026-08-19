import { definePlugin, TextStyleEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 기울임 플러그인 옵션
 */
export interface ItalicPluginOptions extends BasePluginOptions {
  /**
   * 기울임 명령을 수신할 이벤트 이름
   * @default `'ITALIC_CLICKED'`
   */
  eventName?: string
}

/**
 * 기울임 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 기울임 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const italicPlugin = createItalicPlugin({
 *   eventName: 'ITALIC_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(italicPlugin);
 * eventBus.emit('ITALIC_CLICKED'); // Applies italic
 * ```
 */
export const createItalicPlugin = definePlugin<ItalicPluginOptions>({
  name: 'text-style:italic',

  compositionLabel: 'Italic',

  defaultOptions: {
    eventName: TextStyleEvents.ITALIC_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.ITALIC_CLICKED]: ({
      reportError,
      runCommand,
    }) => {
      try {
        const result = runCommand('italic')
        return result
      } catch (error) {
        reportError(error, 'Failed to execute italic command:')
        return false
      }
    },
  }),
})

/**
 * 기본 기울임 플러그인 인스턴스
 */
export const ItalicPlugin = createItalicPlugin()
