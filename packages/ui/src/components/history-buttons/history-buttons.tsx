import type { ComponentChildren } from 'preact'
import type { Signal } from '@preact/signals'
import { Undo2, Redo2 } from 'lucide-preact'
import {
  useHistorySignals,
  useHistoryCommands,
} from '../../hooks/use-editor-signals'
import { ToolbarButton } from '../toolbar-button/toolbar-button'

const ICON_SIZE = 16

/** `format-toggles` 와 같은 이유로 읽는 지점을 잎에 둡니다 */
function HistoryButton({
  enabled,
  onClick,
  title,
  label,
  children,
}: {
  enabled: Signal<boolean>
  onClick: () => void
  title: string
  label: string
  children: ComponentChildren
}): ComponentChildren {
  return (
    <ToolbarButton
      title={title}
      aria-label={label}
      onClick={onClick}
      disabled={!enabled.value}
    >
      {children}
    </ToolbarButton>
  )
}

export function HistoryButtons(): ComponentChildren {
  const history = useHistorySignals()
  const commands = useHistoryCommands()

  return (
    <div data-part="icon-button-group" role="group" aria-label="History">
      <HistoryButton
        enabled={history.canUndo}
        onClick={commands.undo}
        title="Undo (⌘Z)"
        label="Undo"
      >
        <Undo2 size={ICON_SIZE} aria-hidden="true" />
      </HistoryButton>
      <HistoryButton
        enabled={history.canRedo}
        onClick={commands.redo}
        title="Redo (⌘⇧Z)"
        label="Redo"
      >
        <Redo2 size={ICON_SIZE} aria-hidden="true" />
      </HistoryButton>
    </div>
  )
}
