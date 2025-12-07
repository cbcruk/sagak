import { FontEvents } from '@sagak/core'
import { Dropdown, type DropdownOption } from './dropdown'
import { useEditorContext } from '../context/editor-context'

/**
 * `FontFamilyDropdown` 컴포넌트 속성
 */
export interface FontFamilyDropdownProps {
  /** 사용 가능한 폰트 목록 */
  fonts?: string[]
}

/** 기본 폰트 목록 */
const DEFAULT_FONTS = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Helvetica',
  'Tahoma',
  'Trebuchet MS',
]

/**
 * 폰트 패밀리 드롭다운 컴포넌트
 *
 * @param props - `FontFamilyDropdown` 속성
 * @returns `FontFamilyDropdown` 컴포넌트
 *
 * @example
 * ```tsx
 * <FontFamilyDropdown fonts={['Arial', 'Georgia', 'Courier New']} />
 * ```
 */
export function FontFamilyDropdown({
  fonts = DEFAULT_FONTS,
}: FontFamilyDropdownProps) {
  const { eventBus } = useEditorContext()

  const options: DropdownOption<string>[] = fonts.map((font) => ({
    value: font,
    label: font,
  }))

  const handleSelect = (fontFamily: string) => {
    eventBus.emit(FontEvents.FONT_FAMILY_CHANGED, { fontFamily })
  }

  return (
    <Dropdown options={options} onSelect={handleSelect} placeholder="Font" />
  )
}
