import { definePlugin, ParagraphEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 내어쓰기 플러그인 설정 옵션
 */
export interface OutdentPluginOptions extends BasePluginOptions {
  /**
   * 내어쓰기 명령을 수신할 이벤트 이름
   * @default 'OUTDENT_CLICKED'
   */
  eventName?: string
}

/**
 * 내어쓰기 플러그인 인스턴스를 생성합니다
 *
 * 네이티브 `execCommand` API를 사용하여 들여쓰기를 감소시킵니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 설정 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const outdentPlugin = createOutdentPlugin({
 *   eventName: 'OUTDENT_CLICKED',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(outdentPlugin);
 * eventBus.emit('OUTDENT_CLICKED'); // Decrease indentation
 * ```
 */
export const createOutdentPlugin = definePlugin<OutdentPluginOptions>({
  name: 'paragraph:outdent',

  defaultOptions: {
    eventName: ParagraphEvents.OUTDENT_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ParagraphEvents.OUTDENT_CLICKED]: {
      // `BEFORE` 단계: 검증
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Outdent blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 내어쓰기 명령 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('outdent', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'outdent' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute outdent command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등 가능
      after: () => {},
    },
  }),
})

/**
 * 기본 내어쓰기 플러그인 인스턴스
 */
export const OutdentPlugin = createOutdentPlugin()
