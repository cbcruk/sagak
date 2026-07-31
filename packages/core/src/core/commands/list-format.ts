import { selectedBlocks, BLOCK_SELECTOR } from './selection-blocks'

/**
 * 리스트 종류
 */
export type ListType = 'ol' | 'ul'

/**
 * 들여쓰기 단계당 여백 (px)
 *
 * 리스트 밖 블록의 들여쓰기에 사용합니다.
 */
export const INDENT_STEP = 40

/**
 * 리스트 항목으로 변환할 수 있는 블록 태그
 *
 * 표·리스트 컨테이너 같은 구조적 요소는 제외합니다.
 */
const CONVERTIBLE = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'blockquote',
  'pre',
])

/**
 * 요소가 리스트 항목인지 확인합니다
 */
function isListItem(el: HTMLElement): el is HTMLLIElement {
  return el.tagName === 'LI'
}

/**
 * 항목이 속한 리스트 컨테이너를 가져옵니다
 */
function listOf(li: HTMLElement): HTMLElement | null {
  const parent = li.parentElement
  if (!parent) return null
  const tag = parent.tagName.toLowerCase()
  return tag === 'ol' || tag === 'ul' ? parent : null
}

/**
 * 요소의 자식 중 블록 요소가 있는지 확인합니다
 */
function hasBlockChild(el: HTMLElement): boolean {
  return el.querySelector(BLOCK_SELECTOR) !== null
}

/**
 * 블록을 `<li>`로 변환합니다 (자식 보존)
 */
function toListItem(block: HTMLElement): HTMLLIElement {
  const li = document.createElement('li')
  while (block.firstChild) {
    li.appendChild(block.firstChild)
  }
  return li
}

/**
 * `<li>`를 문단으로 변환합니다 (자식 보존)
 */
function toParagraph(li: HTMLElement): HTMLElement {
  const p = document.createElement('p')
  while (li.firstChild) {
    p.appendChild(li.firstChild)
  }
  return p
}

/**
 * 인접한 동일 종류 리스트를 병합합니다 (정규형 유지)
 */
function mergeAdjacentLists(list: HTMLElement): void {
  const prev = list.previousElementSibling
  if (prev instanceof HTMLElement && prev.tagName === list.tagName) {
    while (list.firstChild) {
      prev.appendChild(list.firstChild)
    }
    list.remove()
    mergeAdjacentLists(prev)
    return
  }

  const next = list.nextElementSibling
  if (next instanceof HTMLElement && next.tagName === list.tagName) {
    while (next.firstChild) {
      list.appendChild(next.firstChild)
    }
    next.remove()
  }
}

/**
 * 리스트가 비었으면 제거합니다
 */
function removeIfEmpty(list: HTMLElement | null): void {
  if (list && list.children.length === 0) {
    list.remove()
  }
}

/**
 * 연속된 블록들을 하나의 리스트로 감쌉니다
 */
function wrapAsList(blocks: HTMLElement[], type: ListType): void {
  const list = document.createElement(type)
  blocks[0].parentNode!.insertBefore(list, blocks[0])

  for (const block of blocks) {
    list.appendChild(toListItem(block))
    block.remove()
  }

  mergeAdjacentLists(list)
}

/**
 * 리스트 항목들을 문단으로 되돌립니다 (리스트에서 제거)
 */
function unwrapItems(items: HTMLElement[]): void {
  for (const li of items) {
    const list = listOf(li)
    if (!list) continue

    const paragraph = toParagraph(li)

    // 항목 뒤에 남는 형제가 있으면 리스트를 분할합니다
    const following: HTMLElement[] = []
    let sibling = li.nextElementSibling
    while (sibling) {
      following.push(sibling as HTMLElement)
      sibling = sibling.nextElementSibling
    }

    list.parentNode!.insertBefore(paragraph, list.nextSibling)
    li.remove()

    if (following.length > 0) {
      const tail = document.createElement(list.tagName.toLowerCase())
      for (const node of following) {
        tail.appendChild(node)
      }
      paragraph.parentNode!.insertBefore(tail, paragraph.nextSibling)
    }

    removeIfEmpty(list)
  }
}

/**
 * 리스트 컨테이너의 종류를 변경합니다 (ol ↔ ul)
 */
function changeListType(list: HTMLElement, type: ListType): HTMLElement {
  const replacement = document.createElement(type)
  for (const attr of Array.from(list.attributes)) {
    replacement.setAttribute(attr.name, attr.value)
  }
  while (list.firstChild) {
    replacement.appendChild(list.firstChild)
  }
  list.replaceWith(replacement)
  mergeAdjacentLists(replacement)
  return replacement
}

/**
 * 주어진 블록들에 리스트를 토글합니다 (코어 — 전역 selection 미접근)
 *
 * - 모든 블록이 이미 해당 종류의 리스트 항목이면 → 리스트 해제(문단으로)
 * - 다른 종류의 리스트 항목이면 → 리스트 종류 변경
 * - 일반 블록이면 → 리스트로 변환 (연속 블록은 하나의 리스트로 묶음)
 *
 * @param blocks 대상 블록들 (최내곽)
 * @param type 리스트 종류
 * @returns 처리했으면 `true`, 판단 불가 시 `null` (레거시 위임)
 */
export function toggleListForBlocks(
  blocks: HTMLElement[],
  type: ListType
): boolean | null {
  if (blocks.length === 0) return null

  const items = blocks.filter(isListItem)

  // 모두 같은 종류의 리스트 항목 → 해제
  if (
    items.length === blocks.length &&
    items.every((li) => listOf(li)?.tagName.toLowerCase() === type)
  ) {
    unwrapItems(items)
    return true
  }

  // 모두 다른 종류의 리스트 항목 → 종류 변경
  if (items.length === blocks.length) {
    const lists = new Set(
      items.map((li) => listOf(li)).filter((l): l is HTMLElement => l !== null)
    )
    if (lists.size === 0) return null
    for (const list of lists) {
      changeListType(list, type)
    }
    return true
  }

  // 리스트 항목과 일반 블록이 섞인 경우는 레거시에 위임합니다
  if (items.length > 0) return null

  // 변환 불가 블록이 있으면 위임합니다
  for (const block of blocks) {
    if (!CONVERTIBLE.has(block.tagName.toLowerCase())) return null
    // 중첩 블록을 담은 요소는 변환 시 구조가 깨질 수 있어 위임합니다
    if (hasBlockChild(block)) return null
  }

  // 연속된 블록끼리 묶어 각각 하나의 리스트로 변환합니다
  let group: HTMLElement[] = []
  const flush = () => {
    if (group.length > 0) {
      wrapAsList(group, type)
      group = []
    }
  }

  for (const block of blocks) {
    const last = group[group.length - 1]
    if (last && last.nextElementSibling !== block) {
      flush()
    }
    group.push(block)
  }
  flush()

  return true
}

/**
 * 리스트 항목을 한 단계 들여씁니다
 *
 * 이전 형제 항목의 자식으로 중첩 리스트를 만들어 이동시킵니다.
 * 첫 항목은 들여쓸 수 없습니다(HTML 리스트 구조상 부모가 없음).
 *
 * @returns 처리했으면 `true`
 */
function indentListItem(li: HTMLElement): boolean {
  const list = listOf(li)
  if (!list) return false

  const prev = li.previousElementSibling
  if (!(prev instanceof HTMLElement) || prev.tagName !== 'LI') {
    // 첫 항목은 들여쓸 대상이 없습니다
    return false
  }

  const type = list.tagName.toLowerCase() as ListType
  const lastChild = prev.lastElementChild

  if (
    lastChild instanceof HTMLElement &&
    lastChild.tagName.toLowerCase() === type
  ) {
    lastChild.appendChild(li)
  } else {
    const nested = document.createElement(type)
    nested.appendChild(li)
    prev.appendChild(nested)
  }

  return true
}

/**
 * 리스트 항목을 한 단계 내어씁니다
 *
 * 중첩 리스트의 항목을 부모 항목 뒤로 이동시킵니다.
 *
 * @returns 처리했으면 `true`
 */
function outdentListItem(li: HTMLElement): boolean {
  const list = listOf(li)
  if (!list) return false

  const parentItem = list.parentElement
  if (!(parentItem instanceof HTMLElement) || parentItem.tagName !== 'LI') {
    // 최상위 리스트 항목의 내어쓰기는 리스트 해제로 처리합니다
    unwrapItems([li])
    return true
  }

  // 뒤따르는 형제는 이동하는 항목의 하위로 유지합니다
  const following: HTMLElement[] = []
  let sibling = li.nextElementSibling
  while (sibling) {
    following.push(sibling as HTMLElement)
    sibling = sibling.nextElementSibling
  }

  parentItem.parentNode!.insertBefore(li, parentItem.nextSibling)

  if (following.length > 0) {
    const tail = document.createElement(list.tagName.toLowerCase())
    for (const node of following) {
      tail.appendChild(node)
    }
    li.appendChild(tail)
  }

  removeIfEmpty(list)
  return true
}

/**
 * 블록의 들여쓰기 여백을 조정합니다 (리스트 밖 블록용)
 */
function shiftBlockIndent(block: HTMLElement, delta: number): boolean {
  const current = parseInt(block.style.marginLeft, 10) || 0
  const next = Math.max(0, current + delta)

  if (next === 0) {
    block.style.marginLeft = ''
    return current > 0
  }

  block.style.marginLeft = `${next}px`
  return true
}

/**
 * 주어진 블록들을 들여쓰거나 내어씁니다 (코어 — 전역 selection 미접근)
 *
 * 리스트 항목은 중첩 리스트로 구조를 바꾸고, 일반 블록은 `margin-left`를
 * 조정합니다.
 *
 * @param blocks 대상 블록들 (최내곽)
 * @param direction `1`이면 들여쓰기, `-1`이면 내어쓰기
 * @returns 하나라도 처리했으면 `true`, 아무 것도 못 하면 `null` (레거시 위임)
 */
export function shiftIndentForBlocks(
  blocks: HTMLElement[],
  direction: 1 | -1
): boolean | null {
  if (blocks.length === 0) return null

  let handled = false

  // 들여쓰기는 뒤에서부터 처리해야 형제 관계가 유지됩니다
  const ordered = direction === 1 ? [...blocks].reverse() : blocks

  for (const block of ordered) {
    if (isListItem(block)) {
      handled =
        (direction === 1 ? indentListItem(block) : outdentListItem(block)) ||
        handled
    } else if (CONVERTIBLE.has(block.tagName.toLowerCase())) {
      handled = shiftBlockIndent(block, direction * INDENT_STEP) || handled
    }
  }

  return handled ? true : null
}

/**
 * 현재 선택 범위에 리스트를 토글합니다 (셸)
 *
 * @returns 성공 시 `true`, 판단 불가 시 `undefined` (레거시 위임)
 */
export function toggleList(type: ListType): boolean | undefined {
  const found = selectedBlocks()
  if (!found) return undefined

  return toggleListForBlocks(found.blocks, type) ?? undefined
}

/**
 * 현재 선택 범위를 들여쓰거나 내어씁니다 (셸)
 *
 * @returns 성공 시 `true`, 판단 불가 시 `undefined` (레거시 위임)
 */
export function shiftIndent(direction: 1 | -1): boolean | undefined {
  const found = selectedBlocks()
  if (!found) return undefined

  return shiftIndentForBlocks(found.blocks, direction) ?? undefined
}
