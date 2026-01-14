import { definePlugin, ParagraphEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 들여쓰기 플러그인 설정 옵션
 */
export interface IndentPluginOptions extends BasePluginOptions {
  /**
   * 들여쓰기 명령을 수신할 이벤트 이름
   * @default 'INDENT_CLICKED'
   */
  eventName?: string
}

/**
 * 들여쓰기 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 들여쓰기를 증가시킵니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const indentPlugin = createIndentPlugin({
 *   eventName: 'INDENT_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(indentPlugin);
 * eventBus.emit('INDENT_CLICKED'); // Increase indentation
 * ```
 */
export const createIndentPlugin = definePlugin<IndentPluginOptions>({
  name: 'paragraph:indent',

  defaultOptions: {
    eventName: ParagraphEvents.INDENT_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.INDENT_CLICKED]: {
      // `BEFORE` 단계: 검증
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Indent blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 들여쓰기 명령 실행
      on: ({ emit }) => {
        try {
          emit(CoreEvents.CAPTURE_SNAPSHOT)
          const result = document.execCommand('indent', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'indent' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute indent command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등 가능
      after: () => {},
    },
  }),
})

/**
 * 기본 들여쓰기 플러그인 인스턴스
 */
export const IndentPlugin = createIndentPlugin()
