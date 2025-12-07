import { useDisclosure } from '../hooks/use-disclosure'

/**
 * 드롭다운 옵션 인터페이스
 */
export interface DropdownOption<T = string> {
  /** 옵션 값 */
  value: T
  /** 옵션 레이블 */
  label: string
  /** 옵션 비활성화 여부 */
  disabled?: boolean
}

/**
 * `Dropdown` 컴포넌트 속성
 */
export interface DropdownProps<T = string> {
  /** 현재 선택된 값 */
  value?: T
  /** 옵션 목록 */
  options: DropdownOption<T>[]
  /** 옵션 선택 시 콜백 */
  onSelect: (value: T) => void
  /** 값이 선택되지 않았을 때 플레이스홀더 텍스트 */
  placeholder?: string
  /** 현재 값에 대한 커스텀 레이블 */
  label?: string
  /** 비활성화 상태 */
  disabled?: boolean
}

/**
 * 드롭다운 컴포넌트
 *
 * @param props - `Dropdown` 속성
 * @returns `Dropdown` 컴포넌트
 *
 * @example
 * ```tsx
 * <Dropdown
 *   value={currentFont}
 *   options={fontOptions}
 *   onSelect={(font) => changeFontFamily(font)}
 *   placeholder="Select font"
 * />
 * ```
 */
export function Dropdown<T = string>({
  value,
  options,
  onSelect,
  placeholder = 'Select...',
  label,
  disabled = false,
}: DropdownProps<T>) {
  const { isOpen, toggle, close, ref } = useDisclosure<HTMLDivElement>()

  const handleToggle = () => {
    if (!disabled) {
      toggle()
    }
  }

  const handleSelect = (optionValue: T) => {
    onSelect(optionValue)
    close()
  }

  const displayLabel = (() => {
    const currentOption = options.find((opt) => opt.value === value)
    return label || currentOption?.label || placeholder
  })()

  return (
    <div
      ref={ref}
      data-scope="dropdown"
      data-part="root"
      data-state-open={isOpen || undefined}
      data-state-disabled={disabled || undefined}
    >
      <button
        type="button"
        data-part="trigger"
        data-state-open={isOpen || undefined}
        data-state-disabled={disabled || undefined}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span data-part="label">{displayLabel}</span>
        <span data-part="arrow" data-state-open={isOpen || undefined}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div data-part="menu" role="listbox">
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={String(option.value)}
                type="button"
                data-part="item"
                data-state-selected={selected || undefined}
                data-state-disabled={option.disabled || undefined}
                onClick={() => !option.disabled && handleSelect(option.value)}
                disabled={option.disabled}
                role="option"
                aria-selected={selected}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
