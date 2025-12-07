import { FontEvents } from '@sagak/core'
import { ColorPicker } from './color-picker'
import { useEditorContext } from '../context/editor-context'

/**
 * `BackgroundColorPicker` 컴포넌트 속성
 */
export interface BackgroundColorPickerProps {
  /** 사용 가능한 색상 목록 */
  colors?: string[]
}

/**
 * 배경 색상 선택 컴포넌트
 *
 * @param props - `BackgroundColorPicker` 속성
 * @returns `BackgroundColorPicker` 컴포넌트
 *
 * @example
 * ```tsx
 * <BackgroundColorPicker />
 * ```
 */
export function BackgroundColorPicker({ colors }: BackgroundColorPickerProps) {
  const { eventBus } = useEditorContext()

  const handleSelect = (color: string) => {
    eventBus.emit(FontEvents.BACKGROUND_COLOR_CHANGED, { color })
  }

  return (
    <ColorPicker
      onSelect={handleSelect}
      label="Background Color"
      icon="A"
      colors={colors}
    />
  )
}
