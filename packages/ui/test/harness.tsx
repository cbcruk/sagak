import { render } from 'preact'
import type { CreateEditorOptions, EditorContext } from 'sagak-core'
import { expect } from 'vitest'
import {
  useEditor,
  EditorProvider,
  EditorContainer,
  Toolbar,
  AutocompletePopover,
  AutoSaveIndicator,
} from '../src'
import '../src/styles/index.css'

/**
 * `apps/editor` 와 같은 구성으로 에디터를 띄웁니다.
 *
 * 이번 세션에서 찾은 UI 버그 — 다크 모드 분열, 다이얼로그가 안 닫힘, 툴바를 쓴
 * 뒤 타이핑 유실 — 는 전부 **컴포넌트를 따로 마운트해서는 보이지 않았습니다.**
 * 툴바와 편집 영역이 같은 에디터 컨텍스트로 이어져야 드러납니다. 그래서
 * 앱 진입점의 트리를 그대로 재현합니다.
 */

const DEFAULT_CONTENT = `
<h1>사각사각</h1>
<p>글을 씁니다.</p>
<ul>
  <li>굵게 · 기울임 · 밑줄</li>
</ul>
`

let mountedContext: EditorContext | null = null

function Harness({
  initialContent,
  autoSave,
}: {
  initialContent: string
  autoSave?: CreateEditorOptions['autoSave']
}) {
  const { containerRef, editor, ready } = useEditor({
    initialContent,
    autoSave,
  })
  if (editor) mountedContext = editor.context

  return (
    <main data-scope="app">
      <EditorContainer>
        {ready && editor ? (
          <EditorProvider context={editor.context}>
            <Toolbar />
            <AutoSaveIndicator />
            <AutocompletePopover />
          </EditorProvider>
        ) : null}
        <div ref={containerRef} data-scope="editing-area" data-part="wysiwyg" />
      </EditorContainer>
    </main>
  )
}

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
}

export async function mountEditor(
  initialContent: string = DEFAULT_CONTENT,
  options: MountOptions = {}
): Promise<MountedEditor> {
  const root = document.createElement('div')
  document.body.appendChild(root)

  render(
    <Harness initialContent={initialContent} autoSave={options.autoSave} />,
    root
  )

  // useEditor 의 비동기 초기화가 끝나고 툴바가 붙을 때까지 기다립니다
  let editable: HTMLElement | null = null
  for (let i = 0; i < 60 && !editable; i += 1) {
    await settle(1)
    editable = root.querySelector<HTMLElement>('[contenteditable="true"]')
  }

  if (!editable || !root.querySelector('[data-scope="toolbar"]')) {
    throw new Error('에디터가 마운트되지 않았습니다')
  }

  if (!mountedContext) throw new Error('에디터 컨텍스트를 찾지 못했습니다')

  return {
    root,
    editable,
    context: mountedContext,
    unmount: () => {
      render(null, root)
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
