import { mount, unmount } from 'svelte'
import type { CreateEditorOptions, Editor, EditorContext } from 'sagak-core'
import { expect } from 'vitest'
import Harness from './Harness.svelte'
import '../src/styles/index.css'

/**
 * 검사용 마운트 — 트리는 `Harness.svelte` 에 있습니다.
 *
 * 이 파일은 그것을 띄우고 기다리고 걷어내는 일과, 검사들이 함께 쓰는 자잘한
 * 도구(선택 영역 놓기·버튼 찾기·다이얼로그 찾기)만 갖습니다.
 */

const DEFAULT_CONTENT = `
<h1>사각사각</h1>
<p>글을 씁니다.</p>
<ul>
  <li>굵게 · 기울임 · 밑줄</li>
</ul>
`

let mountedContext: EditorContext | null = null

export interface MountedEditor {
  root: HTMLDivElement
  editable: HTMLElement
  /** 커맨드 레지스트리 등 코어 핸들 — 측정에 씁니다 */
  context: EditorContext
  unmount: () => void
}

const frame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** 마이크로태스크·렌더·이벤트가 정리될 때까지 기다립니다 */
export async function settle(frames = 3): Promise<void> {
  for (let i = 0; i < frames; i += 1) {
    await frame()
  }
}

export interface MountOptions {
  /**
   * 자동 저장 설정.
   *
   * `createEditor` 의 기본값은 `false` 이고 harness 도 켜지 않습니다 —
   * 앱과 달리 테스트마다 localStorage 를 건드리면 서로 간섭하기 때문입니다.
   * 필요한 테스트만 켜고 `storageKey` 를 따로 줍니다.
   */
  autoSave?: CreateEditorOptions['autoSave']

  /**
   * 자동 저장 표시를 툴바에 띄웁니다.
   *
   * 제품 기본값은 **꺼짐**입니다 (깜빡여서 내렸습니다 — `ToolbarProps` 참고).
   * 그 컴포넌트를 검사하는 테스트만 켭니다. 끄고 지나가면 되살릴 때 무엇이
   * 깨졌는지 알 길이 없어집니다.
   */
  showAutoSaveIndicator?: boolean

  /**
   * 문서 줄(제목·저장 메뉴)을 띄웁니다.
   *
   * 앱은 늘 띄우지만 harness 는 **끄고 시작합니다** — 문서 줄이 붙으면
   * OPFS 를 건드리므로, 상관없는 테스트끼리 저장소로 간섭하게 됩니다.
   */
  showDocumentBar?: boolean
}

export async function mountEditor(
  initialContent: string = DEFAULT_CONTENT,
  options: MountOptions = {}
): Promise<MountedEditor> {
  const root = document.createElement('div')
  document.body.appendChild(root)

  mountedContext = null
  const instance = mount(Harness, {
    target: root,
    props: {
      initialContent,
      autoSave: options.autoSave,
      showAutoSaveIndicator: options.showAutoSaveIndicator,
      showDocumentBar: options.showDocumentBar,
      onready: (editor: Editor) => {
        mountedContext = editor.context
      },
    },
  })

  // useEditor 의 비동기 초기화가 끝날 때까지 기다립니다
  let editable: HTMLElement | null = null
  for (let i = 0; i < 60 && !editable; i += 1) {
    await settle(1)
    editable = root.querySelector<HTMLElement>('[contenteditable="true"]')
  }

  if (!editable) throw new Error('에디터가 마운트되지 않았습니다')

  /*
   * 툴바는 **한 틱 늦게** 붙습니다.
   *
   * `SvelteHost` 가 `useEffect` 에서 마운트하기 때문입니다. 예전에는 Preact
   * 가 그린 뼈대는 곧바로 있고 Svelte 조각만 늦어서, 뼈대를 보고 돌려줬다가
   * **아직 없는 버튼을 찾으려다** 실패했습니다 (`theme.browser.test.tsx` 가
   * "Insert Table 버튼을 찾지 못했습니다" 로 걸렸습니다).
   *
   * 이제 툴바 자체가 Svelte 라 뼈대까지 늦습니다. 그래서 툴바가 생기고
   * 그 안의 컨트롤 하나가 나타날 때까지 기다립니다. 앱 진입점까지 Svelte 가
   * 되면 이 대기는 필요 없어집니다.
   */
  for (let i = 0; i < 60; i += 1) {
    if (root.querySelector('button[title="Insert Table"]')) break
    await settle(1)
  }

  if (!root.querySelector('[data-scope="toolbar"]')) {
    throw new Error('툴바가 마운트되지 않았습니다')
  }

  if (!mountedContext) throw new Error('에디터 컨텍스트를 찾지 못했습니다')

  return {
    root,
    editable,
    context: mountedContext,
    unmount: () => {
      void unmount(instance)
      root.remove()
    },
  }
}

/** 편집 영역 전체를 선택합니다 — 서식 커맨드는 선택 영역을 필요로 합니다 */
export function selectAll(editable: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(editable)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** 편집 영역의 첫 텍스트 노드 안에 캐럿을 둡니다 (타이핑 직후와 같은 상태) */
export function placeCaretInText(root: HTMLElement, offset = 0): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const text = walker.nextNode()
  if (!text) throw new Error('텍스트 노드를 찾지 못했습니다')
  placeCaret(text, Math.min(offset, text.textContent?.length ?? 0))
}

/** 특정 노드 안에 캐럿을 둡니다 */
export function placeCaret(node: Node, offset = 0): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}

export function button(root: HTMLElement, title: string): HTMLButtonElement {
  const el = root.querySelector<HTMLButtonElement>(`button[title="${title}"]`)
  expect(el, `"${title}" 버튼을 찾지 못했습니다`).not.toBeNull()
  return el!
}

export function dialog(label: string): HTMLDialogElement {
  const el = document.querySelector<HTMLDialogElement>(
    `dialog[aria-label="${label}"]`
  )
  expect(el, `"${label}" 다이얼로그를 찾지 못했습니다`).not.toBeNull()
  return el!
}

export function isOpen(el: HTMLDialogElement | null): boolean {
  return !!el?.hasAttribute('open')
}

/** 열려 있는 다이얼로그 개수 — 라벨이 바뀌는 경우에 씁니다 */
export function openDialogCount(): number {
  return [...document.querySelectorAll('dialog')].filter((d) =>
    d.hasAttribute('open')
  ).length
}

export async function click(el: HTMLElement): Promise<void> {
  el.click()
  await settle()
}

/** `<select>` 의 값을 바꾸고 change 를 발화합니다 */
export async function selectOption(
  el: HTMLSelectElement,
  value: string
): Promise<void> {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  el.value = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}

export async function fillInput(
  el: HTMLInputElement,
  value: string
): Promise<void> {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
}
