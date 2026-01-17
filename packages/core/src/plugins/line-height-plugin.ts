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

function getBlockParent(node: Node | null): HTMLElement | null {
  const blockTags = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']

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

export const createLineHeightPlugin = definePlugin<LineHeightPluginOptions>({
  name: 'text-style:line-height',

  defaultOptions: {
    eventName: FontEvents.LINE_HEIGHT_CHANGED,
    checkComposition: true,
  },

  handlers: (options) => ({
    [options.eventName ?? FontEvents.LINE_HEIGHT_CHANGED]: {
      before: ({ selectionManager, options: opts }, data?: unknown) => {
        if (opts.checkComposition && selectionManager?.getIsComposing()) {
          console.warn('Line height blocked: IME composition in progress')
          return false
        }

        const lineHeight = extractLineHeight(data)

        if (lineHeight === null) {
          console.warn('Line height blocked: Invalid line height')
          return false
        }

        return true
      },

      on: ({ emit }, data?: unknown) => {
        try {
          const lineHeight = extractLineHeight(data)

          if (lineHeight === null) {
            return false
          }

          emit(CoreEvents.CAPTURE_SNAPSHOT)

          const selection = window.getSelection()
          if (!selection || selection.rangeCount === 0) {
            return false
          }

          const range = selection.getRangeAt(0)
          const commonAncestor = range.commonAncestorContainer

          // Get all block elements in the selection
          const blocksToStyle = new Set<HTMLElement>()

          if (range.collapsed) {
            // If no selection, apply to current block
            const block = getBlockParent(commonAncestor)
            if (block) {
              blocksToStyle.add(block)
            }
          } else {
            // Get start and end blocks
            const startBlock = getBlockParent(range.startContainer)
            const endBlock = getBlockParent(range.endContainer)

            if (startBlock) blocksToStyle.add(startBlock)
            if (endBlock) blocksToStyle.add(endBlock)

            // If common ancestor is a block, check its children
            if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
              const element = commonAncestor as HTMLElement
              const blockChildren = element.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote')
              blockChildren.forEach((child) => {
                if (selection.containsNode(child, true)) {
                  blocksToStyle.add(child as HTMLElement)
                }
              })
            }
          }

          // Apply line-height to all affected blocks
          blocksToStyle.forEach((block) => {
            block.style.lineHeight = lineHeight
          })

          if (blocksToStyle.size > 0) {
            emit(CoreEvents.STYLE_CHANGED, {
              style: 'lineHeight',
              value: lineHeight,
            })
            return true
          }

          return false
        } catch (error) {
          console.error('Failed to apply line height:', error)
          return false
        }
      },

      after: () => {},
    },
  }),
})

export const LineHeightPlugin = createLineHeightPlugin()
