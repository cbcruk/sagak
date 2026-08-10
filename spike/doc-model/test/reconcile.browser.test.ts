import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cdp, userEvent } from '@vitest/browser/context'
import { para, debugString } from '../src/doc'
import { EditorView } from '../src/editor-view'
import { readCaret, writeCaret } from '../src/view'

/**
 * **2단계의 성공 기준입니다.**
 *
 * 1단계 README 의 종료 조건이 이랬습니다 —
 *
 * > 무작위 편집 열에 대해 오라클과 일치하고, **브라우저에서 한 문단 쓰는
 * > 동안 커서가 살아남으면** 멈추고 문서로 정리한다.
 *
 * 앞의 절반은 1단계에서 했습니다. 뒤의 절반이 여기입니다.
 *
 * ## 왜 이게 어려운 일인가
 *
 * 화살표를 뒤집으면 글자를 하나 칠 때마다 문단을 통째로 다시 그리게 됩니다.
 * 그러면 **네이티브 캐럿이 매번 죽습니다** — 캐럿이 붙어 있던 텍스트 노드가
 * 사라지니까요. 그래서 커서를 직접 다시 써 줘야 하고, "다시 쓸 자리" 를
 * 구하는 계산이 1단계에서 만든 `mapPos` 입니다.
 *
 * 매핑이 장식이 아니라 **동작 조건**이라는 게 여기서 드러납니다.
 */

let host: HTMLElement
let view: EditorView

function mount(doc = [para('')], options = {}): EditorView {
  host = document.createElement('div')
  host.style.minHeight = '60px'
  document.body.appendChild(host)
  return new EditorView(host, doc, options)
}

afterEach(() => {
  view?.destroy()
  host?.remove()
})

/** 캐럿을 놓고 타이핑합니다 */
async function typeAt(pos: number, text: string): Promise<void> {
  await userEvent.click(host)
  writeCaret(host, pos)
  await userEvent.keyboard(text)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('화해 고리 — 브라우저가 고치고, 읽고, 모델에 반영하고, 다시 그린다', () => {
  it('빈 문서에 친 글자가 모델에 들어옵니다', async () => {
    view = mount()
    await typeAt(1, 'hello')

    expect(debugString(view.doc)).toBe('<p>hello</p>')
  })

  /** **성공 기준.** 커서가 안 살아남으면 글자 순서가 뒤집힙니다 */
  it('한 문단 쓰는 동안 커서가 살아남습니다', async () => {
    view = mount()
    await typeAt(1, 'hello world')

    expect(debugString(view.doc)).toBe('<p>hello world</p>')
    expect(readCaret(host)).toBe(12) // 여는 토큰 1 + 글자 11
  })

  /**
   * 대조군입니다. 커서 복원을 끄면 같은 입력이 무너지는 것을 확인합니다 —
   * 안 그러면 `writeCaret` 이 실제로 일하고 있는지 알 수 없습니다.
   *
   * **글자가 뒤집힙니다.** 다시 그릴 때마다 캐럿이 문단 맨 앞으로 돌아가서
   * 다음 글자가 앞에 붙기 때문입니다. `hello` 를 치면 `olleh` 가 됩니다.
   * 매핑이 없으면 에디터가 "조금 이상해지는" 게 아니라 아예 못 씁니다.
   */
  it('커서 복원을 끄면 글자가 뒤집힙니다', async () => {
    view = mount([para('')], { restoreCaret: false })
    await typeAt(1, 'hello')

    expect(debugString(view.doc)).toBe('<p>olleh</p>')
  })

  it('문단 중간에 쳐도 그 자리에 들어갑니다', async () => {
    view = mount([para('ab')])
    await typeAt(2, 'XY') // a 와 b 사이

    expect(debugString(view.doc)).toBe('<p>aXYb</p>')
    expect(readCaret(host)).toBe(4)
  })

  it('지우기도 같은 고리를 탑니다', async () => {
    view = mount([para('abcd')])
    await typeAt(5, '{Backspace}{Backspace}')

    expect(debugString(view.doc)).toBe('<p>ab</p>')
    expect(readCaret(host)).toBe(3)
  })

  /**
   * `mapPos` 는 여기서 **예측**입니다. 브라우저가 실제로 캐럿을 어디에
   * 뒀는지와 비교할 수 있고, 어긋나면 매핑이 틀렸거나 진단이 틀린 것입니다.
   *
   * 브라우저라는 독립적인 정답지가 있다는 점에서 1단계의 id 배열 오라클과
   * 같은 역할입니다.
   */
  it('mapPos 의 예측이 브라우저가 옮긴 커서와 일치합니다', async () => {
    view = mount([para('hello')])
    await typeAt(3, 'ZZ')

    expect(view.flushes.length).toBeGreaterThan(0)
    for (const flush of view.flushes) {
      expect(flush.predicted).toBe(flush.browser)
    }
  })

  /**
   * **알려진 한계입니다.** 숨기지 않고 재 둡니다.
   *
   * `"aaa"` 의 맨 앞에 `a` 를 쳐도 `read-dom` 은 맨 뒤에 넣은 것으로
   * 진단합니다 — 문자열만 봐서는 구분이 안 되기 때문입니다. 텍스트는 어느
   * 쪽으로 봐도 맞으므로 **모델은 멀쩡하고 커서 예측만 어긋납니다.**
   *
   * 그래서 조용합니다. 브라우저가 보고한 자리(`browser`)라는 정답지가
   * 없었다면 못 찾았을 종류의 버그입니다. ProseMirror 가 진단에 선택 위치를
   * 섞는 이유가 이것이고, 3단계의 주제입니다.
   */
  it('같은 글자가 이어지면 커서 예측이 어긋납니다 — 알려진 한계', async () => {
    view = mount([para('aaa')])
    await typeAt(1, 'a') // 맨 앞에 칩니다

    expect(debugString(view.doc)).toBe('<p>aaaa</p>') // 텍스트는 맞습니다

    const flush = view.flushes[0]
    expect(flush.browser).toBe(2) // 브라우저는 친 자리 뒤에 뒀습니다
    expect(flush.predicted).toBe(1) // 진단이 뒤쪽이라 예측은 안 움직였습니다
    expect(flush.predicted).not.toBe(flush.browser)
  })

  /**
   * 조합 중에 다시 그리면 IME 가 붙어 있던 텍스트 노드가 사라져 조합이
   * 끊깁니다. 그래서 `compositionstart`~`compositionend` 사이에는 모델을
   * 건드리지 않습니다.
   */
  describe('IME', () => {
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

    it('조합이 끝난 뒤 한 번에 반영됩니다', async () => {
      view = mount()
      await userEvent.click(host)
      writeCaret(host, 1)

      await composeHan()

      expect(debugString(view.doc)).toBe('<p>한</p>')
      // 조합 3단계 × flush 가 아니라 커밋 후 한 번
      expect(view.flushes.length).toBe(1)
    })

    it('조합한 글자 뒤에 이어서 칠 수 있습니다', async () => {
      view = mount()
      await userEvent.click(host)
      writeCaret(host, 1)

      await composeHan()
      await userEvent.keyboard('!')

      expect(debugString(view.doc)).toBe('<p>한!</p>')
    })
  })

  /**
   * 1단계가 "하지 않는 것" 으로 미뤄 둔 구조 변경이 실제로 부딪히는 자리
   * 입니다. `applyChanges` 는 문단 안의 편집만 표현할 수 있으므로 읽기
   * 단계에서 거부하고 DOM 을 모델로 되돌립니다.
   *
   * **조용히 갈라지는 것보다 눈에 보이게 실패하는 편이 낫습니다.**
   */
  it('Enter 는 구조 변경이라 거부됩니다 — 3단계의 주제', async () => {
    view = mount([para('ab')])
    await typeAt(3, '{Enter}')

    expect(view.rejected.length).toBe(1)
    expect(view.rejected[0].before).toBe(1)
    expect(view.rejected[0].after).toBe(2)
    expect(debugString(view.doc)).toBe('<p>ab</p>')
  })
})
