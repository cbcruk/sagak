import { logger } from '@/core/logger'
import { runModelCommand } from '@/model/bridge'
import { insertText } from '@/model/commands'
import { definePlugin, ContentEvents, CoreEvents } from '@/core'
import type { BasePluginOptions } from '@/core'

export interface SpecialCharacterPluginOptions extends BasePluginOptions {
  eventName?: string
}

function extractCharacter(data: unknown): string | null {
  if (!data) {
    return null
  }

  if (typeof data === 'object' && data !== null && 'character' in data) {
    const character = (data as { character: unknown }).character

    if (typeof character === 'string' && character.length > 0) {
      return character
    }
  }

  return null
}

export const createSpecialCharacterPlugin =
  definePlugin<SpecialCharacterPluginOptions>({
    name: 'content:special-character',

    compositionLabel: 'Special character',

    defaultOptions: {
      eventName: ContentEvents.SPECIAL_CHARACTER_INSERT,
      checkComposition: true,
    },

    handlers: (options) => ({
      [options.eventName ?? ContentEvents.SPECIAL_CHARACTER_INSERT]: (
        { emit, reportError, context },
        data?: unknown
      ) => {
        const character = extractCharacter(data)
        if (!character) {
          logger.warn('Special character blocked: No character provided')
          return false
        }

        try {
          emit(CoreEvents.CAPTURE_SNAPSHOT)

          /*
           * 예전에는 DOM 범위에 텍스트 노드를 직접 꽂았습니다. 편집 영역이
           * 문서 모델을 갖게 된 뒤로 그 길은 모델을 지나지 않습니다.
           */
          const done = runModelCommand(context, insertText(character))

          if (done) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'specialCharacter',
              value: character,
            })
          }

          return done
        } catch (error) {
          reportError(error, 'Failed to insert special character:')
          return false
        }
      },
    }),
  })

export const SpecialCharacterPlugin = createSpecialCharacterPlugin()
