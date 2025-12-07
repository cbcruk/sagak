import { definePlugin, CoreEvents } from '@sagak/core'
import type { BasePluginOptions } from '@sagak/core'

/**
 * 위 첨자 플러그인 옵션
 */
export interface SuperscriptPluginOptions extends BasePluginOptions {
  /**
   * 위 첨자 명령을 수신할 이벤트 이름
   * @default `'SUPERSCRIPT_CLICKED'`
   */
  eventName?: string
}

/**
 * 위 첨자 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 위 첨자 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const superscriptPlugin = createSuperscriptPlugin({
 *   eventName: 'TOGGLE_SUPERSCRIPT',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(superscriptPlugin);
 * eventBus.emit('TOGGLE_SUPERSCRIPT'); // Applies superscript
 * ```
 */
export const createSuperscriptPlugin = definePlugin<SuperscriptPluginOptions>({
  name: 'text-style:superscript',

  defaultOptions: {
    eventName: 'SUPERSCRIPT_CLICKED',
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? 'SUPERSCRIPT_CLICKED']: {
      // `BEFORE` 단계: 위 첨자 서식 적용 가능 여부 확인
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Superscript blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 위 첨자 명령 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('superscript', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'superscript' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute superscript command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등
      after: () => {},
    },
  }),
})

/**
 * 기본 위 첨자 플러그인 인스턴스
 */
export const SuperscriptPlugin = createSuperscriptPlugin()
