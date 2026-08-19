import { definePlugin, ParagraphEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 단락 플러그인 설정 옵션
 */
export interface ParagraphPluginOptions extends BasePluginOptions {
  /**
   * 단락 명령을 수신할 이벤트 이름
   * @default 'FORMAT_PARAGRAPH'
   */
  eventName?: string
}

/**
 * 단락 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 텍스트를 일반 단락으로 형식화합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const paragraphPlugin = createParagraphPlugin({
 *   eventName: 'FORMAT_PARAGRAPH',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(paragraphPlugin);
 * eventBus.emit('FORMAT_PARAGRAPH'); // Format as paragraph
 * ```
 */
export const createParagraphPlugin = definePlugin<ParagraphPluginOptions>({
  name: 'paragraph:format',

  compositionLabel: 'Paragraph format',

  defaultOptions: {
    eventName: ParagraphEvents.FORMAT_PARAGRAPH,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.FORMAT_PARAGRAPH]: ({
      reportError,
      runCommand,
    }) => {
      try {
        const result = runCommand('formatBlock', '<p>')
        return result
      } catch (error) {
        reportError(error, 'Failed to execute paragraph format command:')
        return false
      }
    },
  }),
})

/**
 * 기본 단락 플러그인 인스턴스
 */
export const ParagraphPlugin = createParagraphPlugin()
