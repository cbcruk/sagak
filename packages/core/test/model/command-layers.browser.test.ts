import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createEditor, type Editor } from '@/create-editor'
import { TextSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'

/**
 * **아래 층이 아직 잡히는가.**
 *
 * 커맨드 레지스트리는 precedence 체인입니다.
 *
 * ```
 * 100  모델        (src/model/register.ts)
 *   0  네이티브    (src/core/commands/*)
 * -100 레거시      (src/core/legacy-exec-command.ts — document.execCommand)
 * ```
 *
 * 편집 영역이 문서 모델을 갖게 된 뒤로 모델 층이 늘 먼저 답합니다. 그러면
 * 아래 둘은 **한 번도 안 잡히는데**, 그건 추측이라 여기서 잽니다 — 3단계에서
 * 무엇을 지워도 되는지가 이 측정에 달려 있습니다.
 *
 * 재는 방법은 `document.execCommand` 를 세는 것입니다. 레거시 층은 그것 하나로
 * 되어 있어 호출이 0 이면 도달하지 않은 것입니다.
 */

let container: HTMLDivElement
let editor: Editor
let execCalls: string[]
let originalExec: typeof document.execCommand

/** 툴바가 부르는 이름 전부 — 값이 필요한 것은 값까지 */
const COMMANDS: Array<[string, string?]> = [
  ['bold'],
  ['italic'],
  ['underline'],
  ['strikeThrough'],
  ['subscript'],
  ['superscript'],
  ['fontName', 'Georgia'],
  ['fontSize', '24px'],
  ['foreColor', '#ff0000'],
  ['backColor', '#00ff00'],
  ['letterSpacing', '0.2em'],
  ['lineHeight', '2'],
  ['formatBlock', '<h2>'],
  ['justifyLeft'],
  ['justifyCenter'],
  ['justifyRight'],
  ['justifyFull'],
  ['indent'],
  ['outdent'],
  ['insertUnorderedList'],
  ['insertOrderedList'],
  ['insertHorizontalRule'],
  ['createLink', 'https://a.example'],
  ['unlink'],
]

const STATE_QUERIES = [
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'subscript',
  'superscript',
]

const VALUE_QUERIES = [
  'fontName',
  'fontSize',
  'fontSizeCss',
  'foreColor',
  'backColor',
  'letterSpacing',
  'lineHeight',
]

function stateOf(): EditorState {
  return editor.context.editingAreaManager!
    .getCurrentArea()!
    .getStateHandle!()
    .getState()!
}

/** 글자를 골라 둡니다 — 서식 커맨드는 범위를 필요로 합니다 */
function selectAll(): void {
  const handle = editor.context.editingAreaManager!
    .getCurrentArea()!
    .getStateHandle!()
  const state = handle.getState()!

  handle.dispatch(
    state.tr.setSelection(
      TextSelection.create(state.doc, 1, state.doc.content.size - 1)
    )
  )
}

/**
 * 커맨드 하나마다 문서를 처음으로 되돌립니다.
 *
 * 안 그러면 앞 커맨드의 결과 위에서 다음 것을 재게 됩니다 — 제목이 된 문단은
 * 목록으로 감쌀 수 없어서, 커맨드가 아니라 **순서**를 재게 됩니다.
 */
async function fresh(html = '<p>가나다라</p>'): Promise<void> {
  await editor.setContent(html)
  selectAll()
}

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)

  editor = createEditor({ container, initialContent: '<p>가나다라</p>' })
  await editor.run()

  execCalls = []
  originalExec = document.execCommand.bind(document)
  document.execCommand = ((command: string, ...rest: unknown[]) => {
    execCalls.push(command)
    return (originalExec as (...args: unknown[]) => boolean)(command, ...rest)
  }) as typeof document.execCommand
})

afterEach(() => {
  document.execCommand = originalExec
  editor.destroy()
  container.remove()
})

describe('커맨드 층 — 아래로 새는 것이 있는가', () => {
  it('툴바 커맨드 전부가 모델에서 끝나야 함', async () => {
    const registry = editor.context.commandRegistry!
    const unhandled: string[] = []

    for (const [name, value] of COMMANDS) {
      /* 링크를 벗기려면 링크가 있어야 합니다 */
      await fresh(
        name === 'unlink'
          ? '<p><a href="https://a.example">가나다라</a></p>'
          : '<p>가나다라</p>'
      )

      if (!registry.run(name, value)) {
        unhandled.push(name)
      }
    }

    /* 모델이 전부 처리했으면 `execCommand` 는 한 번도 안 불립니다 */
    expect(execCalls, `레거시로 샌 커맨드: ${execCalls.join(', ')}`).toEqual([])
    expect(unhandled, `아무도 처리 못 한 커맨드: ${unhandled.join(', ')}`).toEqual(
      []
    )
  })

  it('눌림 표시 조회도 모델에서 끝나야 함', () => {
    const registry = editor.context.commandRegistry!

    selectAll()
    for (const name of STATE_QUERIES) {
      registry.queryState(name)
    }

    expect(execCalls).toEqual([])
  })

  /**
   * Why: 값 조회는 **일부러 아래로 넘깁니다.**
   * How: 문서에 그 값이 안 걸려 있으면 모델이 `undefined` 를 주고, 화면에
   *      실제로 그려진 값(`getComputedStyle`)이 답합니다. 서식 없는 글의
   *      크기가 그렇습니다 — 모델에는 없고 화면에는 15px 로 보입니다.
   */
  it('값 조회는 안 걸린 것만 아래로 넘겨야 함', () => {
    const registry = editor.context.commandRegistry!

    selectAll()
    registry.run('fontSize', '24px')
    selectAll()

    expect(registry.queryValue('fontSize')).toBe('24px')
    expect(registry.queryValue('fontSizeCss')).toBe('24px')

    for (const name of VALUE_QUERIES) {
      registry.queryValue(name)
    }

    expect(execCalls).toEqual([])
  })

  /**
   * Why: 제목이 마지막까지 새고 있었습니다.
   * How: `formatBlock` 이 모델에 없어 `execCommand('formatBlock')` 로
   *      내려갔습니다. 문서가 실제로 바뀌는지로 확인합니다.
   */
  it('제목이 모델을 지나야 함', () => {
    const registry = editor.context.commandRegistry!

    selectAll()
    registry.run('formatBlock', '<h2>')

    expect(stateOf().doc.firstChild?.type.name).toBe('heading')
    expect(stateOf().doc.firstChild?.attrs.level).toBe(2)
    expect(execCalls).toEqual([])
  })
})
