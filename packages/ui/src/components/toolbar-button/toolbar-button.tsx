import type { ComponentChildren } from 'preact'

export interface ToolbarButtonProps {
  title: string
  children: ComponentChildren
  onClick?: (event: MouseEvent) => void
  disabled?: boolean
  /**
   * 켜짐(`on`)은 편집할 대상이 선택되어 있다는 뜻입니다 — 링크 위에 커서가 있을 때처럼.
   * 활성(`active`)은 서식이 지금 적용되어 있다는 뜻입니다 — 가운데 정렬처럼.
   */
  state?: 'on' | 'active'
  /** 아이콘 하나보다 넓은 내용을 담을 때 (드롭다운 화살표 등) */
  wide?: boolean
  /**
   * kinu 의 `Dialog.Trigger` / `DropdownMenuTrigger` 는 자체 요소를 만들지 않고
   * 자식에 `commandfor`/`command` 를 얹습니다. 그 속성들이 실제 `<button>` 까지
   * 닿아야 다이얼로그가 열리므로 나머지 prop 을 그대로 넘깁니다.
   */
  [prop: string]: unknown
}

/**
 * 툴바의 아이콘 버튼입니다.
 *
 * 컴포넌트 9곳이 같은 인라인 스타일(`#fff` / `#333` / `#d4d4d4`)을 복사해 두고
 * 있었고, 그래서 kinu 를 들인 뒤 다크 모드에서 이 버튼들만 흰색으로 남았습니다.
 * 색은 `styles/index.css` 의 `[data-part='icon-button']` 한 곳에 있습니다.
 */
export function ToolbarButton({
  title,
  children,
  onClick,
  disabled,
  state,
  wide,
  ...rest
}: ToolbarButtonProps): ComponentChildren {
  return (
    <button
      {...rest}
      type="button"
      data-part="icon-button"
      data-state={state}
      data-width={wide ? 'auto' : undefined}
      title={title}
      aria-label={(rest['aria-label'] as string) ?? title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
