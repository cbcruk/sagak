import { logger } from '@/core/logger'
import { definePlugin, FontEvents, CoreEvents } from '@/core'
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

function getBlockParent(node: Node | null): HTMLElement | null {
  const blockTags = [
    'P',
    'DIV',
    'LI',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'BLOCKQUOTE',
  ]

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      if (blockTags.includes(element.tagName)) {
        return element
      }
    }
    node = node.parentNode
  }

  return null
}

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
        { emit, reportError },
        data?: unknown
      ) => {
        const letterSpacing = extractLetterSpacing(data)

        if (letterSpacing === null) {
          logger.warn('Letter spacing blocked: Invalid letter spacing')
          return false
        }

        try {
          emit(CoreEvents.CAPTURE_SNAPSHOT)

          const selection = window.getSelection()
          if (!selection || selection.rangeCount === 0) {
            return false
          }

          const range = selection.getRangeAt(0)
          const commonAncestor = range.commonAncestorContainer

          const blocksToStyle = new Set<HTMLElement>()

          if (range.collapsed) {
            const block = getBlockParent(commonAncestor)
            if (block) {
              blocksToStyle.add(block)
            }
          } else {
            const startBlock = getBlockParent(range.startContainer)
            const endBlock = getBlockParent(range.endContainer)

            if (startBlock) blocksToStyle.add(startBlock)
            if (endBlock) blocksToStyle.add(endBlock)

            if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
              const element = commonAncestor as HTMLElement
              const blockChildren = element.querySelectorAll(
                'p, div, li, h1, h2, h3, h4, h5, h6, blockquote'
              )
              blockChildren.forEach((child) => {
                if (selection.containsNode(child, true)) {
                  blocksToStyle.add(child as HTMLElement)
                }
              })
            }
          }

          const cssValue =
            letterSpacing === '0' ? 'normal' : `${letterSpacing}em`

          blocksToStyle.forEach((block) => {
            block.style.letterSpacing = cssValue
          })

          if (blocksToStyle.size > 0) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'letterSpacing',
              value: letterSpacing,
            })
            return true
          }

          return false
        } catch (error) {
          reportError(error, 'Failed to apply letter spacing:')
          return false
        }
      },
    }),
  })

export const LetterSpacingPlugin = createLetterSpacingPlugin()
