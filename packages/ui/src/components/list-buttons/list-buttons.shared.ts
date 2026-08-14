/**
 * 캐럿이 어떤 목록 안에 있는지 — **렌더러와 무관한 순수 함수**입니다.
 *
 * 이 값 하나가 툴바 버튼의 아이콘(글머리/번호)·켜짐 표시·메뉴에서 고른 항목
 * 표시를 함께 정합니다. 표 다이얼로그의 `findTableAtSelection` 과 같은 자리에
 * 있습니다.
 */

export type ListType = 'ordered' | 'unordered' | 'none'

export function getCurrentListType(): ListType {
  const selection = window.getSelection()
  if (!selection || !selection.anchorNode) return 'none'

  let node: Node | null = selection.anchorNode

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as Element).tagName
      if (tagName === 'OL') return 'ordered'
      if (tagName === 'UL') return 'unordered'
    }
    node = node.parentNode
  }

  return 'none'
}
