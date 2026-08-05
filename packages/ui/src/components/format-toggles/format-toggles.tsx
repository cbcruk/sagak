import type { ComponentChildren, JSX } from 'preact'
import type { Signal } from '@preact/signals'
import { Toggle, ToggleGroup } from 'kinu'
import { Bold, Italic, Underline, Strikethrough } from 'lucide-preact'
import {
  useFormattingSignals,
  useFormattingCommands,
} from '../../hooks/use-editor-signals'

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
 * 신호를 여기(잎)에서 읽습니다.
 *
 * `FormatToggles` 에서 `.value` 를 읽으면 부모가 통째로 다시 그려져 토글 4개가
 * 전부 따라갑니다. 이 컴포넌트가 있는 이유가 그것입니다 — 값이 바뀐 토글만
 * 그리려면 읽는 지점이 여기여야 합니다.
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
  const formatting = useFormattingSignals()
  const commands = useFormattingCommands()

  return (
    <ToggleGroup role="group" aria-label="Text style">
      <FormatToggle
        pressed={formatting.isBold}
        onClick={commands.toggleBold}
        title="Bold (⌘B)"
        label="Bold"
      >
        <Bold size={ICON_SIZE} strokeWidth={2.5} aria-hidden="true" />
      </FormatToggle>
      <FormatToggle
        pressed={formatting.isItalic}
        onClick={commands.toggleItalic}
        title="Italic (⌘I)"
        label="Italic"
      >
        <Italic size={ICON_SIZE} aria-hidden="true" />
      </FormatToggle>
      <FormatToggle
        pressed={formatting.isUnderline}
        onClick={commands.toggleUnderline}
        title="Underline (⌘U)"
        label="Underline"
      >
        <Underline size={ICON_SIZE} aria-hidden="true" />
      </FormatToggle>
      <FormatToggle
        pressed={formatting.isStrikeThrough}
        onClick={commands.toggleStrikeThrough}
        title="Strikethrough"
        label="Strikethrough"
      >
        <Strikethrough size={ICON_SIZE} aria-hidden="true" />
      </FormatToggle>
    </ToggleGroup>
  )
}
