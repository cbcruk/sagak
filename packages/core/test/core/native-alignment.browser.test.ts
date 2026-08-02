import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CommandRegistry,
  type CommandContext,
} from '@/core/command-registry'
import { registerNativeAlignment } from '@/core/commands/native-alignment'
import { registerLegacyExecCommands } from '@/core/legacy-exec-command'
import { EventBus } from '@/core/event-bus'

/**
 * 네이티브 정렬 커맨드 테스트
 *
 * Why: execCommand 없이 블록의 text-align을 직접 설정하는 자체 구현 검증
 * How: (입력 HTML + 선택) → 출력 DOM 스타일 단언, 판단 불가 시 레거시 위임 확인
 */
describe('native alignment', () => {
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
    registerNativeAlignment(registry)
  })

  afterEach(() => {
    document.body.removeChild(element)
    vi.restoreAllMocks()
  })

  it('선택된 블록에 text-align을 설정해야 함', () => {
    element.innerHTML = '<p>Hello World</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 0, text, 5)

    expect(registry.run('justifyCenter')).toBe(true)
    expect(
      (element.querySelector('p') as HTMLElement).style.textAlign
    ).toBe('center')
  })

  it('커서만 있어도(collapsed) 해당 블록에 적용해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 2, text, 2)

    expect(registry.run('justifyRight')).toBe(true)
    expect(
      (element.querySelector('p') as HTMLElement).style.textAlign
    ).toBe('right')
  })

  it('여러 블록에 걸친 선택은 모든 블록에 적용해야 함', () => {
    element.innerHTML = '<p>First</p><p>Second</p><p>Third</p>'
    const ps = element.querySelectorAll('p')
    selectRange(ps[0].firstChild!, 1, ps[2].firstChild!, 3)

    expect(registry.run('justifyCenter')).toBe(true)
    for (const p of ps) {
      expect((p as HTMLElement).style.textAlign).toBe('center')
    }
  })

  it('중첩 구조에서는 최내곽 블록에만 적용해야 함', () => {
    element.innerHTML = '<ul><li>Item</li></ul>'
    const li = element.querySelector('li')!
    selectRange(li.firstChild!, 0, li.firstChild!, 4)

    expect(registry.run('justifyCenter')).toBe(true)
    expect(li.style.textAlign).toBe('center')
  })

  it('기존 정렬을 새 정렬로 교체해야 함', () => {
    element.innerHTML = '<p style="text-align: left">Hello</p>'
    const text = element.querySelector('p')!.firstChild as Text
    selectRange(text, 0, text, 5)

    expect(registry.run('justifyFull')).toBe(true)
    expect(
      (element.querySelector('p') as HTMLElement).style.textAlign
    ).toBe('justify')
  })

  it('선택 영역이 없으면 레거시로 위임해야 함', () => {
    element.innerHTML = '<p>Hello</p>'
    window.getSelection()?.removeAllRanges()

    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true)
    registerLegacyExecCommands(registry)

    expect(registry.run('justifyLeft')).toBe(true)
    expect(execSpy).toHaveBeenCalledWith('justifyLeft', false)
    expect(
      (element.querySelector('p') as HTMLElement).style.textAlign
    ).toBe('')
  })

  it('편집 가능 영역 밖의 선택은 레거시로 위임해야 함', () => {
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)
    selectRange(outside.firstChild!, 0, outside.firstChild!, 3)

    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(false)
    registerLegacyExecCommands(registry)

    expect(registry.run('justifyLeft')).toBe(false)
    expect(execSpy).toHaveBeenCalled()
    expect(outside.style.textAlign).toBe('')

    document.body.removeChild(outside)
  })
})
