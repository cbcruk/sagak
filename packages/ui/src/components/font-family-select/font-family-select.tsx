import type { ReactNode } from 'preact/compat'
import { useFontState } from '../../hooks'
import { ToolbarSelect } from '../toolbar-select/toolbar-select'

const fonts = [
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: 'Times New Roman, serif' },
  { label: 'Courier', value: 'Courier New, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
]

/** 각 옵션을 자기 폰트로 렌더해 미리보기가 되게 합니다 */
const options = fonts.map((font) => ({ ...font, fontFamily: font.value }))

export function FontFamilySelect(): ReactNode {
  const { fontFamily, setFontFamily } = useFontState()

  const currentValue = fonts.some((font) => font.value === fontFamily)
    ? fontFamily
    : fonts[0].value

  return (
    <ToolbarSelect
      title="Font Family"
      options={options}
      value={currentValue}
      onSelect={setFontFamily}
    />
  )
}
