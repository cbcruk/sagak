import { keymap } from 'prosemirror-keymap'
import type { Plugin, EditorContext } from '@/core'
import { createDefaultCommandRegistry, runCommand } from '@/core'
import type { CommandName } from '@/core/command-map'

/**
 * 단축키 하나.
 *
 * `key` 는 `prosemirror-keymap` 의 표기를 씁니다 — `'Mod-b'` 의 `Mod` 는
 * mac 에서 `Cmd`, 나머지에서 `Ctrl` 입니다. 예전에는 `metaKey`/`ctrlKey` 를
 * 각각 적어 같은 단축키를 **두 줄씩** 썼습니다.
 */
export interface ShortcutDefinition {
  key: string
  run: CommandName
}

export interface KeyboardShortcutsPluginOptions {
  /** 더하거나 덮어쓸 단축키 */
  shortcuts?: ShortcutDefinition[]

  /** 기본 단축키 사용 여부 @default true */
  useDefaults?: boolean
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  { key: 'Mod-b', run: 'bold' },
  { key: 'Mod-i', run: 'italic' },
  { key: 'Mod-u', run: 'underline' },
  { key: 'Mod-z', run: 'undo' },
  { key: 'Shift-Mod-z', run: 'redo' },
  { key: 'Mod-y', run: 'redo' },
]

/**
 * 키보드 단축키.
 *
 * ## `prosemirror-keymap` 위로 옮겼습니다
 *
 * 예전에는 편집 영역이 `keydown` 을 버스에 실어 보내고, 이 플러그인이 그것을
 * 받아 `metaKey`/`ctrlKey`/`shiftKey` 를 손으로 맞춰 봤습니다. PM 은 그 자리를
 * **이미 갖고 있습니다** — 그리고 그쪽이 더 잘합니다.
 *
 * | | 버스로 받던 때 | PM 키맵 |
 * | --- | --- | --- |
 * | mac/윈도 차이 | `metaKey`·`ctrlKey` 두 줄씩 | `Mod-` 한 줄 |
 * | 조합 중 | 걸러야 함 | PM 이 안 부름 |
 * | 다른 키맵과의 순서 | 알 수 없음 | precedence 로 정해짐 |
 *
 * `Enter`·`Backspace` 같은 편집 키맵과 **같은 줄에 서는 것**이 특히 중요합니다.
 * 버스로 받으면 그 둘의 순서를 아무도 모릅니다.
 */
export function createKeyboardShortcutsPlugin(
  options: KeyboardShortcutsPluginOptions = {}
): Plugin {
  const { shortcuts = [], useDefaults = true } = options
  const all = useDefaults ? [...DEFAULT_SHORTCUTS, ...shortcuts] : shortcuts

  let detach: (() => void) | undefined

  return {
    name: 'utility:keyboard-shortcuts',

    initialize(context: EditorContext) {
      const area = context.editingAreaManager?.getCurrentArea()

      if (!area?.addPlugin) return

      const registry =
        context.commandRegistry ?? createDefaultCommandRegistry(context)

      const bindings: Record<string, () => boolean> = {}

      for (const shortcut of all) {
        bindings[shortcut.key] = () =>
          runCommand(registry, shortcut.run as 'bold', ...([] as []))
      }

      detach = area.addPlugin(keymap(bindings))
    },

    destroy() {
      detach?.()
      detach = undefined
    },
  }
}

export const KeyboardShortcutsPlugin = createKeyboardShortcutsPlugin()
