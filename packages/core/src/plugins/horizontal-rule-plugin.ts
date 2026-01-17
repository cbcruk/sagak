import { definePlugin, ContentEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

export interface HorizontalRulePluginOptions extends BasePluginOptions {
  eventName?: string
}

export const createHorizontalRulePlugin = definePlugin<HorizontalRulePluginOptions>({
  name: 'content:horizontal-rule',

  defaultOptions: {
    eventName: ContentEvents.HORIZONTAL_RULE_INSERT,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? ContentEvents.HORIZONTAL_RULE_INSERT]: {
      before: ({ selectionManager, options: opts }) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Horizontal rule blocked: IME composition in progress')
          return false
        }
        return true
      },

      on: ({ emit }) => {
        try {
          emit(CoreEvents.CAPTURE_SNAPSHOT)

          const selection = window.getSelection()
          if (!selection || selection.rangeCount === 0) {
            return false
          }

          const range = selection.getRangeAt(0)
          range.deleteContents()

          const hr = document.createElement('hr')
          hr.style.border = 'none'
          hr.style.borderTop = '1px solid #d4d4d4'
          hr.style.margin = '1em 0'

          range.insertNode(hr)

          const newRange = document.createRange()
          newRange.setStartAfter(hr)
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)

          emit(CoreEvents.STYLE_CHANGED, { style: 'horizontalRule' })
          return true
        } catch (error) {
          console.error('Failed to insert horizontal rule:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

export const HorizontalRulePlugin = createHorizontalRulePlugin()
