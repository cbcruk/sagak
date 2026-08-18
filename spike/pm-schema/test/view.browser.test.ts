import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cdp, userEvent } from '@vitest/browser/context'
import { TextSelection } from 'prosemirror-state'
import { mountView, type Spike } from '../src/view'

/**
 * **2단계 — `prosemirror-view` 가 편집 표면을 가져가면 어떻게 되는가.**
 *
 * 스키마는 1단계에서 닫혔습니다. 여기서 재는 것은 **입력**입니다. 이주에서
 * 제일 비싸고 제일 잘 새는 자리이고, 여기가 안 되면 나머지가 다 옳아도
 * 무너집니다.
 *
 * ## 한글이 첫 관문입니다
 *
 * `spike/doc-model` 이 이미 재 뒀습니다 — **조합 중 입력은 막을 수 없습니다.**
 * `beforeinput` 의 `insertCompositionText` 는 `cancelable === false` 이고,
 * 조합 이벤트를 전부 `preventDefault` 해도 글자는 들어갑니다.
 *
 * 그러니 질문은 "막을 수 있는가" 가 아니라 **"PM 이 그 뒤를 제대로 수습하는가"**
 * 입니다. `EditorView` 는 조합 중에는 DOM 이 앞서게 두고 `compositionend` 에서
 * 모델을 맞춥니다. 그 수습이 한글에서 도는지를 봅니다.
 *
 * ## 진짜 조합을 일으키는 방법
 *
 * `new CompositionEvent(...)` 를 dispatch 하는 건 소용이 없습니다 — 내 코드가
 * 내 코드를 확인하는 것이지 플랫폼을 재는 게 아닙니다. CDP 의
 * `Input.imeSetComposition` 으로 렌더러의 **진짜 조합 상태**를 만듭니다
 * (`spike/doc-model/test/composition.browser.test.ts` 와 같은 기법).
 */

let container: HTMLElement
let spike: Spike

beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)

  spike = mountView(container, '<p>가나</p>')

  /* 실제 포커스가 있어야 CDP 입력이 이 요소로 갑니다 */
  await userEvent.click(spike.view.dom)
})

afterEach(() => {
  spike.destroy()
  container.remove()
})

/** 캐럿을 문서 끝에 둡니다 */
function caretToEnd(): void {
  const { state, dispatch } = spike.view
  const end = state.doc.content.size - 1
  dispatch(state.tr.setSelection(TextSelection.create(state.doc, end)))
  spike.view.focus()
}

/** 한글 조합 ㅎ → 하 → 한, 그리고 커밋 */
async function composeHan(): Promise<void> {
  const client = cdp()

  for (const text of ['ㅎ', '하', '한']) {
    await client.send('Input.imeSetComposition', {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    })
  }

  await client.send('Input.insertText', { text: '한' })
}

describe('한글 조합', () => {
  it('조합한 글자가 모델에 한 번만 들어갑니다', async () => {
    caretToEnd()
    await composeHan()

    /* '가나한' — 조합 중간값이 남거나 겹치면 여기서 드러납니다 */
    expect(spike.text()).toBe('가나한')
  })

  it('조합 뒤에도 문서 구조가 멀쩡합니다', async () => {
    caretToEnd()
    await composeHan()

    expect(spike.html()).toBe('<p>가나한</p>')
  })

  it('조합을 두 번 이어서 해도 겹치지 않습니다', async () => {
    caretToEnd()
    await composeHan()
    await composeHan()

    expect(spike.text()).toBe('가나한한')
  })
})

describe('조합과 되돌리기', () => {
  /**
   * 이주 문서가 2단계 게이트로 적어 둔 것입니다 — "조합 중 서식·undo·붙여넣기".
   *
   * 조합이 **한 덩어리로** 되돌아가야 합니다. 자모 단위로 풀리면
   * `prosemirror-history` 가 조합 경계를 못 보고 있다는 뜻입니다.
   */
  it('조합한 글자가 한 번에 되돌아갑니다', async () => {
    caretToEnd()
    await composeHan()
    expect(spike.text()).toBe('가나한')

    spike.undo()
    expect(spike.text()).toBe('가나')
  })

  it('되돌린 것을 다시 할 수 있습니다', async () => {
    caretToEnd()
    await composeHan()
    spike.undo()
    spike.redo()

    expect(spike.text()).toBe('가나한')
  })
})

describe('조합 중 서식', () => {
  /**
   * 조합이 끝난 직후 서식을 걸면 무엇이 굵어지는가.
   *
   * 조합 중에는 DOM 이 모델보다 앞서 있으므로, 수습이 안 끝난 상태에서 트랜잭션을
   * 밀어 넣으면 위치가 어긋납니다. PM 이 그 순서를 지키는지 봅니다.
   */
  it('조합 직후 전체를 굵게 해도 글자가 안 깨집니다', async () => {
    caretToEnd()
    await composeHan()

    const { state, dispatch } = spike.view
    dispatch(
      state.tr.setSelection(
        TextSelection.create(state.doc, 1, state.doc.content.size - 1)
      )
    )
    spike.bold()

    expect(spike.text()).toBe('가나한')
    expect(spike.html()).toContain('<strong>')
  })
})

describe('붙여넣기', () => {
  /**
   * PM 은 붙여넣기를 **자기 경로**로 처리합니다 (`clipboardParser`). jsdom 에서
   * 잰 `DOMParser` 왕복 결과가 그대로 적용된다고 볼 수 없어서 따로 잽니다.
   */
  function paste(html: string): void {
    const data = new DataTransfer()
    data.setData('text/html', html)

    spike.view.dom.dispatchEvent(
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

    expect(spike.text()).toContain('붙인 글')
  })

  it('구글 문서 껍데기가 문서를 굵게 만들지 않습니다', () => {
    caretToEnd()
    paste(
      `<b style="font-weight:normal"><p dir="ltr"><span style="font-size:11pt;font-weight:400">보통 글</span></p></b>`
    )

    expect(spike.text()).toContain('보통 글')
    expect(spike.html()).not.toContain('<strong>')
  })

  it('코드블록의 줄바꿈이 남습니다', () => {
    caretToEnd()
    paste('<pre><code>a\nb</code></pre>')

    expect(spike.text()).toContain('a\nb')
  })
})
