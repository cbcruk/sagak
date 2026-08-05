import type { ReactNode } from 'preact/compat'
import { Select } from 'kinu'
import { useEditorContext } from '../../context/editor-context'

export interface ToolbarSelectOption {
  label: string
  value: string
  /** 옵션 자체에 적용할 폰트 — 미리보기가 필요한 곳에서만 씁니다 */
  fontFamily?: string
}

export interface ToolbarSelectProps {
  /** 툴바 버튼의 `title` 이자 접근성 레이블 */
  title: string
  options: ToolbarSelectOption[]
  /** 제어 모드 — 에디터 상태를 따라가야 할 때 */
  value?: string
  /** 비제어 모드 — 초기값만 정하면 되는 때 */
  defaultValue?: string
  onSelect: (value: string) => void
}

/**
 * 툴바의 드롭다운 5종이 공유하는 껍데기입니다.
 *
 * 네이티브 `<select>` 에는 base-ui 의 `onOpenChange` 에 해당하는 것이 없습니다.
 * 대신 포커스가 에디터를 떠나기 전에 선택 영역을 저장합니다 — 마우스는
 * `mousedown`, 키보드는 `focus` 가 그 시점입니다. `saveSelection()` 은 범위가
 * 에디터 밖이면 아무것도 하지 않으므로 두 번 불러도 안전합니다.
 */
export function ToolbarSelect({
  title,
  options,
  value,
  defaultValue,
  onSelect,
}: ToolbarSelectProps): ReactNode {
  const { selectionManager } = useEditorContext()

  const save = (): void => {
    selectionManager?.saveSelection()
  }

  return (
    <Select
      title={title}
      aria-label={title}
      value={value}
      defaultValue={defaultValue}
      onMouseDown={save}
      onFocus={save}
      onChange={(event) => {
        onSelect((event.currentTarget as HTMLSelectElement).value)
      }}
    >
      {options.map(({ label, value: optionValue, fontFamily }) => (
        <option key={label} value={optionValue} style={{ fontFamily }}>
          {label}
        </option>
      ))}
    </Select>
  )
}
