/**
 * 이미지 다이얼로그의 **렌더러와 무관한 부분**.
 *
 * Preact 판과 Svelte 판이 같은 것을 봐야 합니다. 특히 허용 형식과 크기 제한은
 * 사용자에게 보이는 문구(`max 5MB`)와 짝이라 갈리면 안 됩니다.
 */

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const MAX_FILE_SIZE = 5 * 1024 * 1024

export function getSelectedImage(): HTMLImageElement | null {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return null

  const node = selection.anchorNode

  // Case 1: anchorNode is IMG element
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName === 'IMG'
  ) {
    return node as HTMLImageElement
  }

  // Case 2: anchorNode is parent element, check child at offset
  if (node.nodeType === Node.ELEMENT_NODE) {
    const offset = selection.anchorOffset
    // Check node before cursor (image click places cursor after image)
    if (offset > 0) {
      const prevChild = node.childNodes[offset - 1]
      if (
        prevChild?.nodeType === Node.ELEMENT_NODE &&
        (prevChild as Element).tagName === 'IMG'
      ) {
        return prevChild as HTMLImageElement
      }
    }
    // Check node at cursor
    const childAtOffset = node.childNodes[offset]
    if (
      childAtOffset?.nodeType === Node.ELEMENT_NODE &&
      (childAtOffset as Element).tagName === 'IMG'
    ) {
      return childAtOffset as HTMLImageElement
    }
  }

  // Case 3: anchorNode is text node, check siblings
  if (node.nodeType === Node.TEXT_NODE) {
    const prev = node.previousSibling
    if (
      prev?.nodeType === Node.ELEMENT_NODE &&
      (prev as Element).tagName === 'IMG'
    ) {
      return prev as HTMLImageElement
    }
    const next = node.nextSibling
    if (
      next?.nodeType === Node.ELEMENT_NODE &&
      (next as Element).tagName === 'IMG'
    ) {
      return next as HTMLImageElement
    }
  }

  return null
}
