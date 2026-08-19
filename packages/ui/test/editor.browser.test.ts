import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditor, runCommand, type Editor, type EditorContext } from 'sagak-core'

describe('Editor Core', () => {
  let container: HTMLDivElement
  let editor: Editor

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('should initialize and render content', async () => {
    editor = createEditor({
      container,
      initialContent: '<p>Hello World</p>',
    })

    await editor.run()

    expect(container.innerHTML).toContain('Hello World')
  })

  it('should apply font family to selected text', async () => {
    editor = createEditor({
      container,
      initialContent: '<p>Test text</p>',
    })

    await editor.run()

    const editableArea = container.querySelector('[contenteditable="true"]')
    expect(editableArea).not.toBeNull()

    /*
     * 편집 영역이 선택을 자기 것으로 읽으려면 **포커스가 있어야 합니다** —
     * 밖에서 일어난 선택까지 문서 선택으로 받으면 안 되기 때문입니다.
     */
    ;(editableArea as HTMLElement).focus()

    const range = document.createRange()
    range.selectNodeContents(editableArea!)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    runCommand(
      editor.context.commandRegistry!,
      editor.context.eventBus,
      'fontName',
      'Georgia'
    )

    const content = await editor.getContent()
    expect(content).toContain('Georgia')
  })
})

describe('EventBus Integration', () => {
  let container: HTMLDivElement
  let editor: Editor
  let context: EditorContext

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)

    editor = createEditor({
      container,
      initialContent: '<p>Test</p>',
    })

    await editor.run()
    context = editor.context
  })

  afterEach(() => {
    container.remove()
  })

  it('커맨드 레지스트리로 글꼴을 겁니다', async () => {
    const editableArea = container.querySelector('[contenteditable="true"]')
    expect(editableArea).not.toBeNull()

    /*
     * 편집 영역이 선택을 자기 것으로 읽으려면 **포커스가 있어야 합니다** —
     * 밖에서 일어난 선택까지 문서 선택으로 받으면 안 되기 때문입니다.
     */
    ;(editableArea as HTMLElement).focus()

    const range = document.createRange()
    range.selectNodeContents(editableArea!)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    runCommand(
      context.commandRegistry!,
      context.eventBus,
      'fontName',
      'Courier New'
    )

    const content = await editor.getContent()
    expect(content).toContain('Courier New')
  })

  /**
   * Why: 커맨드가 성공하면 무엇이 바뀌었는지 알려야 합니다.
   * How: 예전에는 플러그인마다 `STYLE_CHANGED` 를 쐈고 이름이 UI 어휘였습니다
   *      (`fontFamily`). 이제 커맨드 경계 한 곳에서 쏘고 이름도 커맨드
   *      이름입니다 (`fontName`).
   */
  it('커맨드가 성공하면 STYLE_CHANGED 를 쏩니다', () => {
    const handler = vi.fn()
    context.eventBus.on('STYLE_CHANGED', 'on', handler)

    const editableArea = container.querySelector('[contenteditable="true"]')
    /*
     * 편집 영역이 선택을 자기 것으로 읽으려면 **포커스가 있어야 합니다** —
     * 밖에서 일어난 선택까지 문서 선택으로 받으면 안 되기 때문입니다.
     */
    ;(editableArea as HTMLElement).focus()

    const range = document.createRange()
    range.selectNodeContents(editableArea!)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    runCommand(
      context.commandRegistry!,
      context.eventBus,
      'fontName',
      'Verdana'
    )

    expect(handler).toHaveBeenCalledWith({
      style: 'fontName',
      value: 'Verdana',
    })
  })
})
