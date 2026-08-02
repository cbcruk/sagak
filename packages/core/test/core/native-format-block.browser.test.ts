import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CommandRegistry,
  type CommandContext,
} from '@/core/command-registry'
import { registerNativeFormatBlock } from '@/core/commands/native-format-block'
import { registerLegacyExecCommands } from '@/core/legacy-exec-command'
import { EventBus } from '@/core/event-bus'

/**
 * 네이티브 formatBlock 커맨드 테스트
 *
 * Why: execCommand 없이 블록 태그를 직접 교체하는 자체 구현 검증
 * How: (입력 HTML + 선택) → 출력 DOM 단언, 판단 불가 시 레거시 위임 확인
 */
describe('native formatBlock', () => {
  let element: HTMLDivElement
  let registry: CommandRegistry
  let ctx: CommandContext

  const selectRange = (
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number
  ) => {
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()

    element = document.createElement('div')
    element.contentEditable = 'true'
    document.body.appendChild(element)

    ctx = { eventBus: new EventBus() }
    registry = new CommandRegistry(ctx)
    registerNativeFormatBlock(registry)
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  it('p를 h2로 변환해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 0, text, 5)

    expect(registry.run('formatBlock', '<h2>')).toBe(true)
    expect(element.querySelector('p')).toBeNull()
    expect(element.querySelector('h2')?.textContent).toBe('Hello')
  })

  it('h1을 p로 되돌려야 함', () => {
    element.innerHTML = '<h1>Title</h1>'
    const text = element.querySelector('h1')!.firstChild as Text
    selectRange(text, 0, text, 3)

    expect(registry.run('formatBlock', '<p>')).toBe(true)
    expect(element.querySelector('h1')).toBeNull()
    expect(element.querySelector('p')?.textContent).toBe('Title')
  })

  it('꺾쇠 없는 값도 허용해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 1, text, 1)

    expect(registry.run('formatBlock', 'h3')).toBe(true)
    expect(element.querySelector('h3')?.textContent).toBe('Hello')
  })

  it('자식 인라인 서식과 속성을 보존해야 함', () => {
    element.innerHTML = '<p id="x" style="color: red">A <strong>B</strong></p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 0, text, 1)

    expect(registry.run('formatBlock', '<h2>')).toBe(true)
    const h2 = element.querySelector('h2') as HTMLElement
    expect(h2.id).toBe('x')
    expect(h2.style.color).toBe('red')
    expect(h2.querySelector('strong')?.textContent).toBe('B')
  })

  it('여러 블록에 걸친 선택은 모든 블록을 변환해야 함', () => {
    element.innerHTML = '<p>First</p><p>Second</p>'
    const ps = element.querySelectorAll('p')
    selectRange(ps[0].firstChild!, 1, ps[1].firstChild!, 3)

    expect(registry.run('formatBlock', '<h2>')).toBe(true)
    expect(element.querySelectorAll('h2')).toHaveLength(2)
    expect(element.querySelector('p')).toBeNull()
  })

  it('변환 후 선택 영역이 유지되어야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 1, text, 4)

    registry.run('formatBlock', '<h2>')

    const selection = window.getSelection()!
    expect(selection.rangeCount).toBe(1)
    const range = selection.getRangeAt(0)
    expect(range.startContainer).toBe(text)
    expect(range.startOffset).toBe(1)
    expect(range.endOffset).toBe(4)
    expect(text.parentElement?.tagName).toBe('H2')
  })

  it('이미 목표 태그인 블록은 그대로 두고 성공해야 함', () => {
    element.innerHTML = '<h2>Hello</h2>'
    const h2 = element.querySelector('h2')!
    const text = h2.firstChild as Text
    selectRange(text, 0, text, 5)

    expect(registry.run('formatBlock', '<h2>')).toBe(true)
    // 동일 요소가 유지되어야 함 (교체 없음)
    expect(element.querySelector('h2')).toBe(h2)
  })

  it('리스트 항목이 포함되면 레거시로 위임해야 함', () => {
    element.innerHTML = '<ul><li>Item</li></ul>'
    const li = element.querySelector('li')!
    selectRange(li.firstChild!, 0, li.firstChild!, 4)

    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
    registerLegacyExecCommands(registry)

    expect(registry.run('formatBlock', '<h2>')).toBe(true)
    expect(execSpy).toHaveBeenCalledWith('formatBlock', false, '<h2>')
    // 네이티브가 손대지 않았어야 함
    expect(element.querySelector('li')).toBe(li)
  })

  it('지원하지 않는 태그 값은 레거시로 위임해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 0, text, 5)

    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
    registerLegacyExecCommands(registry)

    expect(registry.run('formatBlock', '<address>')).toBe(true)
    expect(execSpy).toHaveBeenCalledWith('formatBlock', false, '<address>')
  })

  it('선택 영역이 없으면 레거시로 위임해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    window.getSelection()?.removeAllRanges()

    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(false)
    registerLegacyExecCommands(registry)

    expect(registry.run('formatBlock', '<h2>')).toBe(false)
    expect(execSpy).toHaveBeenCalled()
    expect(element.querySelector('p')?.textContent).toBe('Hello')
  })
})
