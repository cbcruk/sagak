import { ParagraphEvents } from '@sagak/core'
import { Dropdown, type DropdownOption } from './dropdown'
import { useEditorContext } from '../context/editor-context'

/**
 * `HeadingDropdown` 컴포넌트 속성
 */
export interface HeadingDropdownProps {}

/** 제목 레벨 옵션 */
const HEADING_OPTIONS: DropdownOption<number>[] = [
  { value: 0, label: 'Normal' },
  { value: 1, label: 'Heading 1' },
  { value: 2, label: 'Heading 2' },
  { value: 3, label: 'Heading 3' },
  { value: 4, label: 'Heading 4' },
  { value: 5, label: 'Heading 5' },
  { value: 6, label: 'Heading 6' },
]

/**
 * 제목 드롭다운 컴포넌트
 *
 * @param props - `HeadingDropdown` 속성
 * @returns `HeadingDropdown` 컴포넌트
 *
 * @example
 * ```tsx
 * <HeadingDropdown />
 * ```
 */
export function HeadingDropdown({}: HeadingDropdownProps) {
  const { eventBus } = useEditorContext()

  const handleSelect = (level: number) => {
    if (level === 0) {
      eventBus.emit(ParagraphEvents.FORMAT_PARAGRAPH)
    } else {
      eventBus.emit(ParagraphEvents.HEADING_CHANGED, { level })
    }
  }

  return (
    <Dropdown
      options={HEADING_OPTIONS}
      onSelect={handleSelect}
      placeholder="Format"
    />
  )
}
