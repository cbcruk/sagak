import { definePlugin, ParagraphEvents, CoreEvents } from '@sagak/core'
import type { BasePluginOptions } from '@sagak/core'

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

  defaultOptions: {
    eventName: ParagraphEvents.FORMAT_PARAGRAPH,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.FORMAT_PARAGRAPH]: {
      // `BEFORE` 단계: 형식화 가능 여부 확인
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Paragraph format blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 단락 형식화 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('formatBlock', false, '<p>')
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'paragraph' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute paragraph format command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등 가능
      after: () => {},
    },
  }),
})

/**
 * 기본 단락 플러그인 인스턴스
 */
export const ParagraphPlugin = createParagraphPlugin()
