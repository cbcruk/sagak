import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cdp, userEvent } from '@vitest/browser/context'
import { TextSelection } from 'prosemirror-state'
import { undo, redo } from 'prosemirror-history'
import { EventBus } from '@/core/event-bus'
import { WysiwygArea } from '@/editor/editing-area/modes/wysiwyg-area'

/**
 * **한글이 이 이주의 관문입니다.**
 *
 * 스파이크에서 `EditorView` 하나만 놓고 이미 쟀습니다
 * (`spike/pm-schema/test/view.browser.test.ts`). 여기서 다시 재는 것은 대상이
 * 다르기 때문입니다 — 이제 **제품의 편집 영역**이고, 그 위에 버스 발행·
 * 히스토리 배선·데코레이션이 얹혀 있습니다. 얹은 것들이 조합을 방해하지
 * 않는지는 따로 봐야 확인됩니다.
 *
 * ## 진짜 조합을 일으키는 방법
 *
 * `new CompositionEvent(...)` 를 dispatch 하는 것은 내 코드가 내 코드를
 * 확인하는 것이라 재는 값이 없습니다. CDP 의 `Input.imeSetComposition` 으로
 * 렌더러의 **진짜 조합 상태**를 만듭니다.
 *
 * 조합 중 입력은 **막을 수 없습니다** — `insertCompositionText` 는
 * `cancelable === false` 입니다. 그래서 질문은 "막는가" 가 아니라
 * **"PM 이 그 뒤를 제대로 수습하는가"** 입니다.
 */

let container: HTMLElement
let area: WysiwygArea
let eventBus: EventBus

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)

  eventBus = new EventBus()
  area = new WysiwygArea({ container, eventBus })
  area.setRawContent('<p>가나</p>')
  await area.show()

  /* 실제 포커스가 있어야 CDP 입력이 이 요소로 갑니다 */
  await userEvent.click(area.getElement())
})

afterEach(() => {
  area.destroy()
  container.remove()
})

const text = (): string => {
  const state = area.getStateHandle().getState()!

  return state.doc.textBetween(0, state.doc.content.size, '\n')
}

/** 캐럿을 문서 끝에 둡니다 */
function caretToEnd(): void {
  const handle = area.getStateHandle()
  const state = handle.getState()!

  handle.dispatch(
    state.tr.setSelection(
      TextSelection.create(state.doc, state.doc.content.size - 1)
    )
  )
  area.focus()
}

/** 한글 조합 ㅎ → 하 → 한, 그리고 커밋 */
async function composeHan(): Promise<void> {
  const client = cdp()

  for (const composing of ['ㅎ', '하', '한']) {
    await client.send('Input.imeSetComposition', {
      text: composing,
      selectionStart: composing.length,
      selectionEnd: composing.length,
    })
  }

  await client.send('Input.insertText', { text: '한' })
}

describe('한글 조합 — 제품의 편집 영역에서', () => {
  it('조합한 글자가 모델에 한 번만 들어갑니다', async () => {
    caretToEnd()
    await composeHan()

    /* '가나한' — 조합 중간값이 남거나 겹치면 여기서 드러납니다 */
    expect(text()).toBe('가나한')
    expect(area.getRawContent()).toBe('<p>가나한</p>')
  })

  it('조합을 두 번 이어서 해도 겹치지 않습니다', async () => {
    caretToEnd()
    await composeHan()
    await composeHan()

    expect(text()).toBe('가나한한')
  })

  /**
   * 조합이 **한 덩어리로** 되돌아가야 합니다. 자모 단위로 풀리면
   * `prosemirror-history` 가 조합 경계를 못 보고 있다는 뜻입니다.
   */
  it('조합한 글자가 한 번에 되돌아갑니다', async () => {
    caretToEnd()
    await composeHan()
    expect(text()).toBe('가나한')

    /* 되돌리기도 커맨드입니다 — 다른 것과 같은 문으로 들어옵니다 */
    const handle = area.getStateHandle()
    undo(handle.getState()!, handle.dispatch)
    expect(text()).toBe('가나')

    redo(handle.getState()!, handle.dispatch)
    expect(text()).toBe('가나한')
  })

  /**
   * 얹은 것이 조합을 방해하지 않는지 보는 자리입니다.
   *
   * 내용 변경은 트랜잭션에서 나오므로 조합 중에도 나갑니다. 중요한 것은
   * **조합이 끝났을 때 실려 나가는 내용이 맞는가**입니다.
   */
  it('내용 변경 구독이 조합 결과를 봅니다', async () => {
    const seen: string[] = []
    area.subscribe(() => {
      seen.push(area.getRawContent())
    })

    caretToEnd()
    await composeHan()

    expect(seen.at(-1)).toBe('<p>가나한</p>')
  })

  /**
   * 조합 중에는 DOM 이 모델보다 앞서 있습니다. 수습이 안 끝난 상태에서
   * 트랜잭션을 밀어 넣으면 위치가 어긋납니다.
   */
  it('조합 직후 서식을 걸어도 글자가 안 깨집니다', async () => {
    caretToEnd()
    await composeHan()

    const handle = area.getStateHandle()
    const state = handle.getState()!
    handle.dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, 1, state.doc.content.size - 1)
      )
    )

    /* 모델 커맨드를 그대로 부릅니다 — 툴바가 하는 것과 같은 길입니다 */
    const { commands } = await import('@/model/commands')
    commands.bold(handle.getState()!, handle.dispatch)

    expect(text()).toBe('가나한')
    expect(area.getRawContent()).toContain('<strong>')
  })

  it('조합 중인지 뷰에서 읽힙니다', () => {
    expect(area.isComposing()).toBe(false)
  })
})

describe('붙여넣기 — PM 의 클립보드 경로', () => {
  /**
   * PM 은 붙여넣기를 자기 파서로 처리합니다. 소독기를 뗀 자리라, 위험한 것이
   * 스키마에서 걸리는지를 여기서 봅니다.
   */
  function paste(html: string): void {
    const data = new DataTransfer()
    data.setData('text/html', html)

    area.getElement().dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    )
  }

  it('평범한 문단이 들어옵니다', () => {
    caretToEnd()
    paste('<p>붙인 글</p>')

    expect(text()).toContain('붙인 글')
  })

  it('구글 문서 껍데기가 문서를 굵게 만들지 않습니다', () => {
    caretToEnd()
    paste(
      '<b style="font-weight:normal"><p dir="ltr">' +
        '<span style="font-size:11pt;font-weight:400">보통 글</span></p></b>'
    )

    expect(text()).toContain('보통 글')
    expect(area.getRawContent()).not.toContain('<strong>')
  })

  /**
   * 소독기를 뗀 자리입니다 — 스키마가 그 몫을 합니다.
   *
   * `<script>` 는 노드가 없어 못 들어오고, `onerror` 는 이미지 노드의 속성이
   * 아니라 버려지고, `javascript:` 주소는 `safeUrl` 이 막습니다.
   */
  it('스크립트와 이벤트 핸들러는 애초에 못 들어옵니다', () => {
    caretToEnd()
    paste(
      '<p>안전</p><script>alert(1)</script>' +
        '<img src="x" onerror="alert(1)">' +
        '<a href="javascript:alert(1)">링크</a>'
    )

    const html = area.getRawContent()
    expect(html).toContain('안전')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })

})
