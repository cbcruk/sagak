/** 에디터 모드 타입 */
export type EditorMode = 'wysiwyg' | 'html' | 'text'

/** 모드 옵션 목록 */
const MODES: Array<{ value: EditorMode; label: string; title: string }> = [
  { value: 'wysiwyg', label: 'WYSIWYG', title: 'Visual editing mode' },
  { value: 'html', label: 'HTML', title: 'HTML source editing mode' },
  { value: 'text', label: 'Text', title: 'Plain text editing mode' },
]

/**
 * `ModeSelector` 컴포넌트 속성
 */
export interface ModeSelectorProps {
  /** 현재 활성 모드 */
  mode: EditorMode
  /** 모드 변경 시 호출될 콜백 */
  onModeChange: (mode: EditorMode) => void
}

/**
 * 모드 선택기 컴포넌트
 *
 * WYSIWYG, HTML, 텍스트 편집 모드 간 전환을 위한 탭을 표시합니다
 *
 * @param props - `ModeSelector` 속성
 * @returns 모드 선택기 컴포넌트
 *
 * @example
 * ```tsx
 * <ModeSelector
 *   mode={currentMode}
 *   onModeChange={setMode}
 * />
 * ```
 */
export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div data-scope="mode-selector" data-part="root" role="tablist">
      {MODES.map((m) => {
        const active = mode === m.value
        return (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-part="tab"
            data-state-active={active || undefined}
            onClick={() => onModeChange(m.value)}
            title={m.title}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
