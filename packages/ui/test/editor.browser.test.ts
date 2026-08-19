import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createEditor, FontEvents, type Editor, type EditorContext } from 'sagak-core'

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

    editor.exec(FontEvents.FONT_FAMILY_CHANGED, { fontFamily: 'Georgia' })

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

  it('should emit FONT_FAMILY_CHANGED via eventBus', async () => {
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

    context.eventBus.emit(FontEvents.FONT_FAMILY_CHANGED, { fontFamily: 'Courier New' })

    const content = await editor.getContent()
    expect(content).toContain('Courier New')
  })

  it('should call after handler when FONT_FAMILY_CHANGED succeeds', () => {
    const handler = vi.fn()
    context.eventBus.on(FontEvents.FONT_FAMILY_CHANGED, 'after', handler)

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

    context.eventBus.emit(FontEvents.FONT_FAMILY_CHANGED, { fontFamily: 'Verdana' })

    expect(handler).toHaveBeenCalledWith({ fontFamily: 'Verdana' })
  })
})
