import type { ComponentChildren } from 'preact'
import { useFontState } from '../../hooks'
import { ToolbarSelect } from '../toolbar-select/toolbar-select'

const sizes = [
  { label: '9', value: '1' },
  { label: '10', value: '1' },
  { label: '11', value: '2' },
  { label: '12', value: '3' },
  { label: '14', value: '4' },
  { label: '18', value: '5' },
  { label: '24', value: '6' },
  { label: '36', value: '7' },
]

export function FontSizeSelect(): ComponentChildren {
  const { fontSize, setFontSize } = useFontState()

  const currentValue = sizes.some((size) => size.value === fontSize)
    ? fontSize
    : '3'

  return (
    <ToolbarSelect
      title="Font Size"
      options={sizes}
      value={currentValue}
      onSelect={setFontSize}
    />
  )
}
