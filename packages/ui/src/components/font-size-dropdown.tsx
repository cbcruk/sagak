import { FontEvents } from '@sagak/core'
import { Dropdown, type DropdownOption } from './dropdown'
import { useEditorContext } from '../context/editor-context'

/**
 * `FontSizeDropdown` 컴포넌트 속성
 */
export interface FontSizeDropdownProps {}

/** 폰트 크기 옵션 (HTML 스케일 1-7) */
const FONT_SIZE_OPTIONS: DropdownOption<number>[] = [
  { value: 1, label: 'Very Small (1)' },
  { value: 2, label: 'Small (2)' },
  { value: 3, label: 'Normal (3)' },
  { value: 4, label: 'Medium (4)' },
  { value: 5, label: 'Large (5)' },
  { value: 6, label: 'Very Large (6)' },
  { value: 7, label: 'Huge (7)' },
]

/**
 * 폰트 크기 드롭다운 컴포넌트
 *
 * @param props - `FontSizeDropdown` 속성
 * @returns `FontSizeDropdown` 컴포넌트
 *
 * @example
 * ```tsx
 * <FontSizeDropdown />
 * ```
 */
export function FontSizeDropdown({}: FontSizeDropdownProps) {
  const { eventBus } = useEditorContext()

  const handleSelect = (fontSize: number) => {
    eventBus.emit(FontEvents.FONT_SIZE_CHANGED, { fontSize })
  }

  return (
    <Dropdown
      options={FONT_SIZE_OPTIONS}
      onSelect={handleSelect}
      placeholder="Size"
    />
  )
}
