import { logger } from '@/core/logger'
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
      [options.eventName ?? ContentEvents.SPECIAL_CHARACTER_INSERT]: {
        before: (_ctx, data?: unknown) => {
          const character = extractCharacter(data)
          if (!character) {
            logger.warn('Special character blocked: No character provided')
            return false
          }

          return true
        },

        on: ({ emit, reportError }, data?: unknown) => {
          try {
            const character = extractCharacter(data)
            if (!character) {
              return false
            }

            emit(CoreEvents.CAPTURE_SNAPSHOT)

            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
              return false
            }

            const range = selection.getRangeAt(0)
            range.deleteContents()

            const textNode = document.createTextNode(character)
            range.insertNode(textNode)

            const newRange = document.createRange()
            newRange.setStartAfter(textNode)
            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)

            emit(CoreEvents.STYLE_CHANGED, {
              style: 'specialCharacter',
              value: character,
            })
            return true
          } catch (error) {
            reportError(error, 'Failed to insert special character:')
            return false
          }
        },
      },
    }),
  })

export const SpecialCharacterPlugin = createSpecialCharacterPlugin()
