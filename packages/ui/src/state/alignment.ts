import type { Readable } from 'svelte/store'
import { alignmentOf } from 'sagak-core'
import type { Alignment, EditorContext } from 'sagak-core'
import { fromState } from './from-state'
import { exec } from './exec'

/**
 * 지금 문단의 정렬 — **모델에서 읽습니다.**
 *
 * 예전에는 캐럿에서 `parentNode` 를 타고 올라가며 `getComputedStyle(...)
 * .textAlign` 을 봤습니다. 그러면 CSS 가 준 정렬과 사용자가 준 정렬을 구별할
 * 수 없고, 어느 에디터의 선택인지도 알 수 없었습니다.
 */
export type AlignmentType = Alignment

export interface AlignmentCommands {
  align: (align: AlignmentType) => void
}

export function alignmentStore(
  editor: EditorContext
): Readable<AlignmentType> {
  return fromState(editor, () => alignmentOf(editor), 'left')
}

/** 정렬은 방향마다 커맨드가 따로입니다 — `execCommand` 시절의 이름 그대로입니다 */
const ALIGN_COMMANDS = {
  left: 'justifyLeft',
  center: 'justifyCenter',
  right: 'justifyRight',
  justify: 'justifyFull',
} as const

export function alignmentCommands(editor: EditorContext): AlignmentCommands {
  return {
    align: (align) => void exec(editor, ALIGN_COMMANDS[align]),
  }
}
