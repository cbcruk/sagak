import type { ComponentChildren, JSX } from 'preact'
import { Toggle, ToggleGroup } from 'kinu'
import { Bold, Italic, Underline, Strikethrough } from 'lucide-preact'
import { useFormattingState } from '../../hooks'

const ICON_SIZE = 16

const buttonStyle: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 26,
  padding: 0,
}

/** 상태를 `Toolbar` 에서 여기(잎)로 내렸습니다 */
export function FormatToggles(): ComponentChildren {
  const {
    isBold, isItalic, isUnderline, isStrikeThrough,
    toggleBold, toggleItalic, toggleUnderline, toggleStrikeThrough,
  } = useFormattingState()

  return (
    <ToggleGroup role="group" aria-label="Text style">
      <Toggle pressed={isBold} onClick={toggleBold} style={buttonStyle} title="Bold (⌘B)" aria-label="Bold">
        <Bold size={ICON_SIZE} strokeWidth={2.5} aria-hidden="true" />
      </Toggle>
      <Toggle pressed={isItalic} onClick={toggleItalic} style={buttonStyle} title="Italic (⌘I)" aria-label="Italic">
        <Italic size={ICON_SIZE} aria-hidden="true" />
      </Toggle>
      <Toggle pressed={isUnderline} onClick={toggleUnderline} style={buttonStyle} title="Underline (⌘U)" aria-label="Underline">
        <Underline size={ICON_SIZE} aria-hidden="true" />
      </Toggle>
      <Toggle pressed={isStrikeThrough} onClick={toggleStrikeThrough} style={buttonStyle} title="Strikethrough" aria-label="Strikethrough">
        <Strikethrough size={ICON_SIZE} aria-hidden="true" />
      </Toggle>
    </ToggleGroup>
  )
}
