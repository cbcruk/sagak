import { useDisclosure } from '../hooks/use-disclosure'

/**
 * `ColorPicker` 컴포넌트 속성
 */
export interface ColorPickerProps {
  /** 현재 선택된 색상 */
  value?: string
  /** 선택 가능한 색상 목록 */
  colors?: string[]
  /** 색상 선택 시 콜백 */
  onSelect: (color: string) => void
  /** 버튼 레이블 */
  label?: string
  /** 버튼의 아이콘 또는 콘텐츠 */
  icon?: string
}

/** 기본 색상 팔레트 */
const DEFAULT_COLORS = [
  '#000000', // Black
  '#434343', // Dark Gray
  '#666666', // Gray
  '#999999', // Light Gray
  '#B7B7B7', // Lighter Gray
  '#CCCCCC', // Very Light Gray
  '#D9D9D9', // Super Light Gray
  '#EFEFEF', // Almost White
  '#F3F3F3', // White-ish
  '#FFFFFF', // White
  '#980000', // Dark Red
  '#FF0000', // Red
  '#FF9900', // Orange
  '#FFFF00', // Yellow
  '#00FF00', // Green
  '#00FFFF', // Cyan
  '#4A86E8', // Blue
  '#0000FF', // Pure Blue
  '#9900FF', // Purple
  '#FF00FF', // Magenta
]

/**
 * 색상 선택 컴포넌트
 *
 * @param props - `ColorPicker` 속성
 * @returns `ColorPicker` 컴포넌트
 *
 * @example
 * ```tsx
 * <ColorPicker
 *   value="#FF0000"
 *   onSelect={(color) => changeTextColor(color)}
 *   label="Text Color"
 *   icon="A"
 * />
 * ```
 */
export function ColorPicker({
  value,
  colors = DEFAULT_COLORS,
  onSelect,
  label = 'Color',
  icon,
}: ColorPickerProps) {
  const { isOpen, toggle, close, ref } = useDisclosure<HTMLDivElement>()

  const handleColorSelect = (color: string) => {
    onSelect(color)
    close()
  }

  return (
    <div
      ref={ref}
      data-scope="color-picker"
      data-part="root"
      data-state-open={isOpen || undefined}
    >
      <button
        type="button"
        data-part="trigger"
        data-state-open={isOpen || undefined}
        onClick={toggle}
        title={label}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {icon && <span data-part="icon">{icon}</span>}
        <span
          data-part="swatch"
          style={{ backgroundColor: value || '#000000' }}
        />
      </button>

      {isOpen && (
        <div data-part="palette" role="listbox">
          {colors.map((color) => {
            const selected = color === value

            return (
              <button
                key={color}
                type="button"
                data-part="item"
                data-state-selected={selected || undefined}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
                role="option"
                aria-selected={selected}
              >
                {selected && <span data-part="check">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
