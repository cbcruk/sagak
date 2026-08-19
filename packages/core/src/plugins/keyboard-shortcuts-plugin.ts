import type { Plugin, EditorContext } from '@/core'
import {
  WysiwygEvents,
  HistoryEvents,
  createDefaultCommandRegistry,
  runCommand,
} from '@/core'
import type { CommandName } from '@/core/command-map'

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean

  /**
   * 부를 커맨드 — 서식은 이쪽입니다.
   *
   * 예전에는 전부 이벤트였습니다. 툴바가 커맨드 레지스트리를 직접 부르게
   * 되면서 단축키도 같은 문으로 들어옵니다 — 같은 일에 길이 둘이면 하나만
   * 고쳐도 통과하는 검사가 생깁니다.
   */
  run?: CommandName

  /** 커맨드가 아닌 것 — 되돌리기처럼 버스가 받는 일 */
  event?: string
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
  { key: 'b', metaKey: true, run: 'bold' },
  { key: 'b', ctrlKey: true, run: 'bold' },
  { key: 'i', metaKey: true, run: 'italic' },
  { key: 'i', ctrlKey: true, run: 'italic' },
  { key: 'u', metaKey: true, run: 'underline' },
  { key: 'u', ctrlKey: true, run: 'underline' },

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
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDefinition
): boolean {
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
      const commandRegistry =
        context.commandRegistry ?? createDefaultCommandRegistry(context)

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

              if (shortcut.run) {
                runCommand(
                  commandRegistry,
                  eventBus,
                  shortcut.run as 'bold',
                  ...([] as [])
                )
              } else if (shortcut.event) {
                eventBus.emit(shortcut.event, shortcut.data)
              }

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
