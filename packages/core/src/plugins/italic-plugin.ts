import { definePlugin, TextStyleEvents, CoreEvents } from '@/core'
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

  defaultOptions: {
    eventName: TextStyleEvents.ITALIC_CLICKED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? TextStyleEvents.ITALIC_CLICKED]: {
      // `BEFORE` 단계: 기울임 서식 적용 가능 여부 확인
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Italic blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 기울임 명령 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('italic', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'italic' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute italic command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등
      after: () => {},
    },
  }),
})

/**
 * 기본 기울임 플러그인 인스턴스
 */
export const ItalicPlugin = createItalicPlugin()
