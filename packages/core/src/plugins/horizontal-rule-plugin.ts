import { definePlugin, ContentEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

export interface HorizontalRulePluginOptions extends BasePluginOptions {
  eventName?: string
}

/**
 * 가로줄.
 *
 * `range.insertNode(hr)` 로 DOM 에 직접 꽂던 것을 커맨드 레지스트리로 넘깁니다.
 * 생김새(테두리·여백)는 이제 스타일시트의 몫입니다 — 문서에 인라인 스타일로
 * 박아 두면 스키마를 지날 때 어차피 떨어져 나갑니다.
 */
export const createHorizontalRulePlugin =
  definePlugin<HorizontalRulePluginOptions>({
    name: 'content:horizontal-rule',

    compositionLabel: 'Horizontal rule',

    defaultOptions: {
      eventName: ContentEvents.HORIZONTAL_RULE_INSERT,
      checkComposition: true,
    },

    handlers: (options) => ({
      [options.eventName ?? ContentEvents.HORIZONTAL_RULE_INSERT]: ({
        reportError,
        runCommand,
      }) => {
        try {
          const result = runCommand('insertHorizontalRule')

          return result
        } catch (error) {
          reportError(error, 'Failed to insert horizontal rule:')
          return false
        }
      },
    }),
  })

export const HorizontalRulePlugin = createHorizontalRulePlugin()
