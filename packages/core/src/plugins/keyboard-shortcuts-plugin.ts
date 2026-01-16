import type { Plugin, EditorContext } from '@/core'
import {
  WysiwygEvents,
  TextStyleEvents,
  HistoryEvents,
} from '@/core'

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  event: string
  data?: unknown
}

/**
 * Keyboard shortcuts plugin options
 */
export interface KeyboardShortcutsPluginOptions {
  /**
   * Custom shortcuts to add or override
   */
  shortcuts?: ShortcutDefinition[]

  /**
   * Whether to use default shortcuts
   * @default true
   */
  useDefaults?: boolean
}

/**
 * Default keyboard shortcuts
 */
const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // Text formatting
  { key: 'b', metaKey: true, event: TextStyleEvents.BOLD_CLICKED },
  { key: 'b', ctrlKey: true, event: TextStyleEvents.BOLD_CLICKED },
  { key: 'i', metaKey: true, event: TextStyleEvents.ITALIC_CLICKED },
  { key: 'i', ctrlKey: true, event: TextStyleEvents.ITALIC_CLICKED },
  { key: 'u', metaKey: true, event: TextStyleEvents.UNDERLINE_CLICKED },
  { key: 'u', ctrlKey: true, event: TextStyleEvents.UNDERLINE_CLICKED },

  // History
  { key: 'z', metaKey: true, event: HistoryEvents.UNDO },
  { key: 'z', ctrlKey: true, event: HistoryEvents.UNDO },
  { key: 'z', metaKey: true, shiftKey: true, event: HistoryEvents.REDO },
  { key: 'z', ctrlKey: true, shiftKey: true, event: HistoryEvents.REDO },
  { key: 'y', metaKey: true, event: HistoryEvents.REDO },
  { key: 'y', ctrlKey: true, event: HistoryEvents.REDO },
]

/**
 * Check if keyboard event matches shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutDefinition): boolean {
  const key = event.key.toLowerCase()

  if (key !== shortcut.key.toLowerCase()) {
    return false
  }

  const needsMeta = shortcut.metaKey === true
  const needsCtrl = shortcut.ctrlKey === true
  const needsShift = shortcut.shiftKey === true
  const needsAlt = shortcut.altKey === true

  if (needsMeta && !event.metaKey) return false
  if (needsCtrl && !event.ctrlKey) return false
  if (needsShift && !event.shiftKey) return false
  if (needsAlt && !event.altKey) return false

  if (!needsMeta && !needsCtrl && (event.metaKey || event.ctrlKey)) {
    return false
  }

  if (!needsShift && event.shiftKey && (needsMeta || needsCtrl)) {
    return false
  }

  return true
}

/**
 * Create keyboard shortcuts plugin
 *
 * @example
 * ```typescript
 * const keyboardShortcutsPlugin = createKeyboardShortcutsPlugin({
 *   shortcuts: [
 *     { key: 's', metaKey: true, event: 'SAVE_DOCUMENT' }
 *   ]
 * });
 * ```
 */
export function createKeyboardShortcutsPlugin(
  options: KeyboardShortcutsPluginOptions = {}
): Plugin {
  const { shortcuts = [], useDefaults = true } = options

  const allShortcuts = useDefaults
    ? [...DEFAULT_SHORTCUTS, ...shortcuts]
    : shortcuts

  const unsubscribers: Array<() => void> = []

  return {
    name: 'utility:keyboard-shortcuts',

    initialize(context: EditorContext) {
      const { eventBus } = context

      const unsubKeydown = eventBus.on(
        WysiwygEvents.WYSIWYG_KEYDOWN,
        'on',
        (data?: unknown) => {
          if (!data || typeof data !== 'object' || !('event' in data)) {
            return
          }

          const event = (data as { event: KeyboardEvent }).event

          for (const shortcut of allShortcuts) {
            if (matchesShortcut(event, shortcut)) {
              event.preventDefault()
              eventBus.emit(shortcut.event, shortcut.data)
              return
            }
          }
        }
      )

      unsubscribers.push(unsubKeydown)
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub())
      unsubscribers.length = 0
    },
  }
}

/**
 * Default keyboard shortcuts plugin instance
 */
export const KeyboardShortcutsPlugin = createKeyboardShortcutsPlugin()
