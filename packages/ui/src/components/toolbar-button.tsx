import type { ComponentChildren } from 'preact'

/**
 * `ToolbarButton` 컴포넌트 속성
 */
export interface ToolbarButtonProps {
  /** 버튼 레이블 또는 아이콘 */
  children: ComponentChildren
  /** 버튼 활성 상태 여부 */
  active?: boolean
  /** 클릭 핸들러 */
  onClick?: () => void
  /** 버튼 타이틀 (툴팁) */
  title?: string
  /** 버튼 비활성화 여부 */
  disabled?: boolean
}

/**
 * 툴바 버튼 컴포넌트
 *
 * @param props - `ToolbarButton` 속성
 * @returns 버튼 컴포넌트
 */
export function ToolbarButton({
  children,
  active = false,
  onClick,
  title,
  disabled = false,
}: ToolbarButtonProps) {
  return (
    <button
      data-part="button"
      data-state-active={active || undefined}
      data-state-disabled={disabled || undefined}
      onClick={onClick}
      title={title}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  )
}
