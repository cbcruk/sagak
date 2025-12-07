import { FontEvents } from '@sagak/core'
import { ColorPicker } from './color-picker'
import { useEditorContext } from '../context/editor-context'

/**
 * `TextColorPicker` 컴포넌트 속성
 */
export interface TextColorPickerProps {
  /** 사용 가능한 색상 목록 */
  colors?: string[]
}

/**
 * 텍스트 색상 선택 컴포넌트
 *
 * @param props - `TextColorPicker` 속성
 * @returns `TextColorPicker` 컴포넌트
 *
 * @example
 * ```tsx
 * <TextColorPicker />
 * ```
 */
export function TextColorPicker({ colors }: TextColorPickerProps) {
  const { eventBus } = useEditorContext()

  const handleSelect = (color: string) => {
    eventBus.emit(FontEvents.TEXT_COLOR_CHANGED, { color })
  }

  return (
    <ColorPicker
      onSelect={handleSelect}
      label="Text Color"
      icon="A"
      colors={colors}
    />
  )
}
