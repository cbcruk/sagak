import type { ComponentChildren, JSX } from 'preact'
import { Toggle, ToggleGroup } from 'kinu'
import { Bold, Italic, Underline, Strikethrough } from 'lucide-preact'
import type { Signal } from '@preact/signals'
import {
  useFormattingSignals,
  useFormattingCommands,
} from '../../hooks/use-formatting-signals'

const ICON_SIZE = 16

const buttonStyle: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  padding: 0,
}

/**
 * 신호를 **각 토글 안에서** 읽습니다.
 *
 * 부모(`FormatToggles`)에서 `.value` 를 읽으면 부모가 통째로 다시 그려져
 * 토글 4개가 전부 따라갑니다. 잎에서 읽어야 바뀐 하나만 그려집니다.
 */
function FormatToggle({
  pressed,
  onClick,
  title,
  label,
  children,
}: {
  pressed: Signal<boolean>
  onClick: () => void
  title: string
  label: string
  children: ComponentChildren
}): ComponentChildren {
  return (
    <Toggle
      pressed={pressed.value}
      onClick={onClick}
      style={buttonStyle}
      title={title}
      aria-label={label}
    >
      {children}
    </Toggle>
  )
}

export function FormatToggles(): ComponentChildren {
  const s = useFormattingSignals()
  const c = useFormattingCommands()

  return (
    <ToggleGroup role="group" aria-label="Text style">
      <FormatToggle pressed={s.isBold} onClick={c.toggleBold} title="Bold (⌘B)" label="Bold">
        <Bold size={ICON_SIZE} strokeWidth={2.5} aria-hidden="true" />
      </FormatToggle>
      <FormatToggle pressed={s.isItalic} onClick={c.toggleItalic} title="Italic (⌘I)" label="Italic">
        <Italic size={ICON_SIZE} aria-hidden="true" />
      </FormatToggle>
      <FormatToggle pressed={s.isUnderline} onClick={c.toggleUnderline} title="Underline (⌘U)" label="Underline">
        <Underline size={ICON_SIZE} aria-hidden="true" />
      </FormatToggle>
      <FormatToggle pressed={s.isStrikeThrough} onClick={c.toggleStrikeThrough} title="Strikethrough" label="Strikethrough">
        <Strikethrough size={ICON_SIZE} aria-hidden="true" />
      </FormatToggle>
    </ToggleGroup>
  )
}
