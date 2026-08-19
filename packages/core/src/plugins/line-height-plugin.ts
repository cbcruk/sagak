import { logger } from '@/core/logger'
import { definePlugin, FontEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

export interface LineHeightPluginOptions extends BasePluginOptions {
  eventName?: string
}

function extractLineHeight(data: unknown): string | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'lineHeight' in data) {
    const lineHeight = (data as { lineHeight: unknown }).lineHeight

    if (lineHeight === undefined || lineHeight === null) {
      return null
    }

    return String(lineHeight)
  }

  return null
}

/**
 * 줄 간격.
 *
 * 예전에는 여기서 `window.getSelection()` 을 읽고 걸친 블록을 손으로 모아
 * `style.lineHeight` 를 직접 박았습니다. 편집 영역이 문서 모델을 갖게 되면서
 * **그 일을 여기서 하면 안 됩니다** — DOM 을 고쳐도 모델은 모르고, 다음 저장
 * 때 사라집니다.
 *
 * 커맨드 레지스트리로 넘깁니다. 줄 간격은 모델에서 **문단 속성**이라 선택이
 * 걸친 블록마다 붙는 것도 그쪽이 압니다.
 */
export const createLineHeightPlugin = definePlugin<LineHeightPluginOptions>({
  name: 'text-style:line-height',

  compositionLabel: 'Line height',

  defaultOptions: {
    eventName: FontEvents.LINE_HEIGHT_CHANGED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? FontEvents.LINE_HEIGHT_CHANGED]: (
      { emit, reportError, runCommand },
      data?: unknown
    ) => {
      const lineHeight = extractLineHeight(data)

      if (lineHeight === null) {
        logger.warn('Line height blocked: Invalid line height')
        return false
      }

      try {
        const result = runCommand('lineHeight', lineHeight)

        if (result) {
          emit(CoreEvents.STYLE_CHANGED, {
            style: 'lineHeight',
            value: lineHeight,
          })
        }

        return result
      } catch (error) {
        reportError(error, 'Failed to apply line height:')
        return false
      }
    },
  }),
})

export const LineHeightPlugin = createLineHeightPlugin()
