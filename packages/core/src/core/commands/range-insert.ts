import { closestEditableHost } from './selection-blocks'

/**
 * 현재 선택 범위에 HTML을 삽입합니다 (Range API 기반)
 *
 * `execCommand('insertHTML')` 대신 `createContextualFragment`로 조각을 만들어
 * 삽입하고 커서를 삽입 지점 뒤로 옮깁니다. `SelectionManager`가 없는 경로
 * (단독 `WysiwygArea` 사용, 붙여넣기 처리)에서 사용합니다.
 *
 * @param html 삽입할 HTML
 * @returns 삽입에 성공하면 `true`
 */
export function insertHTMLAtSelection(html: string): boolean {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  if (!closestEditableHost(range.commonAncestorContainer)) return false

  range.deleteContents()

  const fragment = range.createContextualFragment(html)
  const last = fragment.lastChild
  range.insertNode(fragment)

  if (last) {
    range.setStartAfter(last)
  }
  range.collapse(true)

  selection.removeAllRanges()
  selection.addRange(range)

  return true
}

/**
 * 현재 선택 범위에 일반 텍스트를 삽입합니다 (Range API 기반)
 *
 * `execCommand('insertText')` 대신 텍스트 노드를 직접 삽입합니다.
 * HTML로 해석되지 않으므로 이스케이프가 필요 없습니다.
 *
 * @param text 삽입할 텍스트
 * @returns 삽입에 성공하면 `true`
 */
export function insertTextAtSelection(text: string): boolean {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const range = selection.getRangeAt(0)
  if (!closestEditableHost(range.commonAncestorContainer)) return false

  range.deleteContents()

  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)

  selection.removeAllRanges()
  selection.addRange(range)

  return true
}
