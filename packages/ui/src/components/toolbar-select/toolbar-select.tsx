import type { ComponentChildren } from 'preact'
import { Select } from 'kinu'
import { useEditorContext } from '../../context/editor-context'

export interface ToolbarSelectOption {
  label: string
  value: string
  /** 옵션 자체에 적용할 폰트 — 미리보기가 필요한 곳에서만 씁니다 */
  fontFamily?: string
  /**
   * 같은 값을 가진 옵션끼리 `<optgroup>` 으로 묶입니다. 없으면 묶지 않습니다.
   *
   * 목록이 둘 이상의 출처에서 올 때 씁니다 — 폰트 메뉴가 내장 목록과 시스템
   * 폰트를 함께 보여주는 경우입니다.
   */
  group?: string
}

interface OptionGroup {
  label: string | undefined
  options: ToolbarSelectOption[]
}

/**
 * 순서를 지키면서 인접한 같은 그룹끼리 묶습니다.
 *
 * 정렬하지 않는 이유는 부르는 쪽이 정한 순서가 있기 때문입니다 — 폰트 메뉴는
 * 내장 목록이 먼저 오고 시스템 폰트가 뒤에 옵니다.
 */
function groupOptions(options: ToolbarSelectOption[]): OptionGroup[] {
  const groups: OptionGroup[] = []

  for (const option of options) {
    const last = groups[groups.length - 1]
    if (last && last.label === option.group) last.options.push(option)
    else groups.push({ label: option.group, options: [option] })
  }

  return groups
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
  /**
   * 고정 폭. 주면 **목록 내용과 무관하게** 이 폭을 유지하고 넘치는 라벨은
   * 말줄임으로 잘립니다.
   *
   * 목록이 실행 중에 바뀌는 셀렉트에 필요합니다 — 안 주면 가장 긴 항목이 폭을
   * 정하므로, 항목이 늘어나는 순간 툴바가 밀립니다.
   */
  width?: number
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
  width,
}: ToolbarSelectProps): ComponentChildren {
  const { selectionManager } = useEditorContext()

  const save = (): void => {
    selectionManager?.saveSelection()
  }

  return (
    <Select
      title={title}
      aria-label={title}
      style={
        width === undefined
          ? undefined
          : {
              width,
              /*
               * `<select>` 는 닫혀 있을 때 고른 항목만 보여줍니다. 폭을 넘는
               * 이름은 잘라내야 옆이 안 밀립니다.
               */
              textOverflow: 'ellipsis',
            }
      }
      value={value}
      defaultValue={defaultValue}
      onMouseDown={save}
      onFocus={save}
      onChange={(event) => {
        onSelect((event.currentTarget as HTMLSelectElement).value)
      }}
    >
      {groupOptions(options).map((group) => {
        const children = group.options.map(
          ({ label, value: optionValue, fontFamily }) => (
            <option key={label} value={optionValue} style={{ fontFamily }}>
              {label}
            </option>
          )
        )

        return group.label === undefined ? (
          children
        ) : (
          <optgroup key={group.label} label={group.label}>
            {children}
          </optgroup>
        )
      })}
    </Select>
  )
}
