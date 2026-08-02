import {
  INLINE_FORMATS,
  findFormatAncestor,
  applyFormatToNodes,
  removeFormatFromNodes,
} from './inline-format'
import { closestEditableHost } from './selection-blocks'

/**
 * 보류 서식 상태 (stored marks)
 *
 * collapsed 커서에서 서식을 토글했을 때, "다음 입력에 적용할 서식"을 에디터가
 * 직접 보관합니다. `execCommand`가 브라우저 내부에 들고 있던 상태를 대체하며,
 * ProseMirror의 stored marks / CM6의 상태 필드에 해당합니다.
 *
 * 문서에는 하나의 커서만 존재하므로 문서 수준 단일 상태로 관리합니다.
 */
interface PendingState {
  /** 서식 이름 → 적용(`true`)/해제(`false`) */
  formats: Map<string, boolean>
  /** 보류 상태가 유효한 커서 위치 */
  anchor: { node: Node; offset: number }
}

let pending: PendingState | null = null

/**
 * 현재 collapsed 커서 위치를 가져옵니다
 */
function collapsedCursor(): { node: Node; offset: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null
  if (!closestEditableHost(range.startContainer)) return null

  return { node: range.startContainer, offset: range.startOffset }
}

/**
 * 보류 상태가 현재 커서 위치에서 유효한지 확인합니다
 */
function isValidAtCursor(): boolean {
  if (!pending) return false

  const cursor = collapsedCursor()
  if (!cursor) return false

  return (
    cursor.node === pending.anchor.node &&
    cursor.offset === pending.anchor.offset
  )
}

/**
 * collapsed 커서에서 서식을 토글해 보류 상태에 기록합니다
 *
 * 이미 같은 서식이 보류 중이면 반대 값으로 뒤집고, 그 결과가 조상 서식과
 * 같아지면 보류 항목을 제거합니다.
 *
 * @param formatName `INLINE_FORMATS`의 키
 * @returns 기록했으면 `true`, collapsed 커서가 아니면 `false`
 */
export function togglePendingFormat(formatName: string): boolean {
  if (!INLINE_FORMATS[formatName]) return false

  const cursor = collapsedCursor()
  if (!cursor) return false

  const host = closestEditableHost(cursor.node)
  if (!host) return false

  // 커서가 이동했으면 이전 보류 상태를 버립니다
  if (!isValidAtCursor()) {
    pending = { formats: new Map(), anchor: cursor }
  }

  const current = pending!.formats
  const inAncestor =
    findFormatAncestor(cursor.node, INLINE_FORMATS[formatName], host) !== null

  // 현재 유효 상태(보류 값이 있으면 그것, 없으면 조상 서식)를 뒤집습니다
  const effective = current.has(formatName)
    ? current.get(formatName)!
    : inAncestor
  const next = !effective

  if (next === inAncestor) {
    // 조상 서식과 같아지면 보류할 필요가 없습니다
    current.delete(formatName)
  } else {
    current.set(formatName, next)
  }

  if (current.size === 0) {
    pending = null
  }

  return true
}

/**
 * 현재 커서에서 보류 중인 서식 상태를 조회합니다
 *
 * @param formatName `INLINE_FORMATS`의 키
 * @returns 보류 값(`true`/`false`), 보류 중이 아니면 `undefined`
 */
export function getPendingFormat(formatName: string): boolean | undefined {
  if (!isValidAtCursor()) return undefined
  return pending!.formats.get(formatName)
}

/**
 * 보류 상태를 폐기합니다
 *
 * 선택 이동·문서 변경 시 호출합니다.
 */
export function clearPendingFormats(): void {
  pending = null
}

/**
 * 보류 상태가 존재하는지 확인합니다 (현재 커서 기준)
 */
export function hasPendingFormats(): boolean {
  return isValidAtCursor() && pending!.formats.size > 0
}

/**
 * 보류 서식을 적용해 텍스트를 삽입합니다
 *
 * 삽입한 텍스트 노드를 보류 중인 서식으로 감싸거나(적용), 조상 서식에서
 * 빼냅니다(해제). 삽입 후 커서는 텍스트 끝에 놓이고 보류 상태는 소비됩니다
 * — 이후 입력은 생성된 서식 요소 안에서 자연스럽게 이어집니다.
 *
 * @param text 삽입할 텍스트
 * @returns 처리했으면 `true`, 보류 상태가 없으면 `false`
 */
export function insertTextWithPendingFormats(text: string): boolean {
  if (!isValidAtCursor() || pending!.formats.size === 0) return false

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  const host = closestEditableHost(range.startContainer)
  if (!host) return false

  const node = document.createTextNode(text)
  range.insertNode(node)

  const formats = pending!.formats

  // 해제할 서식을 먼저 빼내고, 적용할 서식으로 감쌉니다
  for (const [name, active] of formats) {
    const format = INLINE_FORMATS[name]
    if (!format) continue

    if (active) {
      applyFormatToNodes([node], format, host)
    } else {
      removeFormatFromNodes([node], format, host)
    }
  }

  // 커서를 삽입한 텍스트 뒤로 옮깁니다
  const after = document.createRange()
  after.setStart(node, node.length)
  after.collapse(true)
  selection.removeAllRanges()
  selection.addRange(after)

  // 보류 상태 소비 — 이후 입력은 생성된 요소 안에서 이어집니다
  pending = null

  return true
}

/**
 * 편집 요소에 보류 서식 처리를 설치합니다
 *
 * `beforeinput`에서 텍스트 삽입을 가로채 보류 서식을 적용하고,
 * 선택이 이동하면 보류 상태를 폐기합니다.
 *
 * @param element 편집 가능한 요소
 * @returns 설치를 해제하는 함수
 */
export function installStoredMarks(element: HTMLElement): () => void {
  const handleBeforeInput = (event: Event): void => {
    const inputEvent = event as InputEvent

    if (inputEvent.inputType !== 'insertText' || !inputEvent.data) {
      // 텍스트 삽입 외의 입력은 보류 상태를 무효화합니다
      if (hasPendingFormats()) clearPendingFormats()
      return
    }

    if (!hasPendingFormats()) return

    if (insertTextWithPendingFormats(inputEvent.data)) {
      event.preventDefault()
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  const handleSelectionChange = (): void => {
    // 보류 상태의 기준 위치를 벗어나면 폐기합니다
    if (pending && !isValidAtCursor()) {
      clearPendingFormats()
    }
  }

  element.addEventListener('beforeinput', handleBeforeInput)
  document.addEventListener('selectionchange', handleSelectionChange)

  return () => {
    element.removeEventListener('beforeinput', handleBeforeInput)
    document.removeEventListener('selectionchange', handleSelectionChange)
    clearPendingFormats()
  }
}
