import type { Readable } from 'svelte/store'
import type { EditorContext } from 'sagak-core'
import { fromSelection } from './from-selection'

/**
 * 캐럿이 놓인 자리의 글꼴 이름 — 코어가 답하는 **날것 그대로**입니다.
 *
 * 목록의 어느 항목에 해당하는지는 여기서 안 정합니다. 그 짝짓기는 목록이
 * 있어야 하는데, 목록은 시스템 폰트를 받아 오며 실행 중에 늘어납니다
 * (`local-fonts.ts`). 두 소스를 합치는 일은 둘 다 보는 자리, 즉 컴포넌트가
 * 합니다.
 *
 * `commandRegistry` 가 없으면 `document.queryCommandValue` 로 떨어집니다 —
 * 옮겨 오기 전 컴포넌트가 하던 순서 그대로입니다.
 */
export function fontFamilyStore(editor: EditorContext): Readable<string> {
  return fromSelection(
    editor,
    () =>
      editor.commandRegistry?.queryValue('fontName') ??
      document.queryCommandValue('fontName'),
    ''
  )
}
