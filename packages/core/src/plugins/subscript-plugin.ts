import { definePlugin, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

/**
 * 아래 첨자 플러그인 옵션
 */
export interface SubscriptPluginOptions extends BasePluginOptions {
  /**
   * 아래 첨자 명령을 수신할 이벤트 이름
   * @default `'SUBSCRIPT_CLICKED'`
   */
  eventName?: string
}

/**
 * 아래 첨자 플러그인 생성
 *
 * 네이티브 `execCommand` API를 사용하여 선택된 텍스트에 아래 첨자 서식을 적용합니다.
 * CJK/IME 지원을 위해 `SelectionManager`와 통합됩니다.
 *
 * @param options - 플러그인 옵션
 * @returns 플러그인 인스턴스
 *
 * @example
 * ```typescript
 * const subscriptPlugin = createSubscriptPlugin({
 *   eventName: 'TOGGLE_SUBSCRIPT',
 *   checkComposition: true
 * });
 *
 * await pluginManager.register(subscriptPlugin);
 * eventBus.emit('TOGGLE_SUBSCRIPT'); // Applies subscript
 * ```
 */
export const createSubscriptPlugin = definePlugin<SubscriptPluginOptions>({
  name: 'text-style:subscript',

  defaultOptions: {
    eventName: 'SUBSCRIPT_CLICKED',
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? 'SUBSCRIPT_CLICKED']: {
      // `BEFORE` 단계: 아래 첨자 서식 적용 가능 여부 확인
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Subscript blocked: IME composition in progress')
          return false
        }
        return true
      },

      // `ON` 단계: 아래 첨자 명령 실행
      on: ({ emit }) => {
        try {
          const result = document.execCommand('subscript', false)
          if (result) {
            emit(CoreEvents.STYLE_CHANGED, { style: 'subscript' })
          }
          return result
        } catch (error) {
          console.error('Failed to execute subscript command:', error)
          return false
        }
      },

      // `AFTER` 단계: UI 상태 업데이트, 분석 로깅 등
      after: () => {},
    },
  }),
})

/**
 * 기본 아래 첨자 플러그인 인스턴스
 */
export const SubscriptPlugin = createSubscriptPlugin()
