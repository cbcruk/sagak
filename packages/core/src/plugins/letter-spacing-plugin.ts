import { logger } from '@/core/logger'
import { definePlugin, FontEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

export interface LetterSpacingPluginOptions extends BasePluginOptions {
  eventName?: string
}

function extractLetterSpacing(data: unknown): string | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'letterSpacing' in data) {
    const letterSpacing = (data as { letterSpacing: unknown }).letterSpacing

    if (letterSpacing === undefined || letterSpacing === null) {
      return null
    }

    return String(letterSpacing)
  }

  return null
}

/**
 * 자간.
 *
 * 줄 간격과 같은 이유로 커맨드 레지스트리로 넘깁니다. 다만 **붙는 자리가
 * 달라집니다** — 예전에는 걸친 블록의 `style.letterSpacing` 을 박았지만
 * 모델에서 자간은 **인라인 마크**라 고른 글자에만 붙습니다
 * (`docs/prosemirror-migration.md` §7-1 의 값 붙는 마크 여섯 중 하나).
 *
 * 문단 일부만 골라 자간을 줄 수 있다는 뜻이고, 반대로 문단 전체에 주려면
 * 문단 전체를 골라야 합니다.
 */
export const createLetterSpacingPlugin =
  definePlugin<LetterSpacingPluginOptions>({
    name: 'text-style:letter-spacing',

    compositionLabel: 'Letter spacing',

    defaultOptions: {
      eventName: FontEvents.LETTER_SPACING_CHANGED,
      checkComposition: true,
    },

    handlers: (options) => ({
      [options.eventName ?? FontEvents.LETTER_SPACING_CHANGED]: (
        { reportError, runCommand },
        data?: unknown
      ) => {
        const letterSpacing = extractLetterSpacing(data)

        if (letterSpacing === null) {
          logger.warn('Letter spacing blocked: Invalid letter spacing')
          return false
        }

        /* 툴바는 배수만 넘깁니다 — CSS 단위를 붙이는 자리는 여기입니다 */
        const cssValue = letterSpacing === '0' ? 'normal' : `${letterSpacing}em`

        try {
          const result = runCommand('letterSpacing', cssValue)

          return result
        } catch (error) {
          reportError(error, 'Failed to apply letter spacing:')
          return false
        }
      },
    }),
  })

export const LetterSpacingPlugin = createLetterSpacingPlugin()
