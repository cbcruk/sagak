import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cdp, userEvent } from 'vitest/browser'

/**
 * **2단계의 출발점입니다.**
 *
 * 1단계 README 에 이렇게 적었습니다 —
 *
 * > 첫 벽은 IME 일 것입니다. 조합 중인 입력은 `preventDefault` 로 막을 수
 * > 없어서 "입력을 가로채 모델만 고친다" 는 설계가 한글 앞에서 무너집니다.
 *
 * 그건 **잰 게 아니라 아는 척한 것**이었습니다. 스파이크는 그런 문장을
 * 확인하는 자리이므로 여기서 실제로 잽니다.
 *
 * ## 어떻게 진짜 조합을 일으키는가
 *
 * `new CompositionEvent(...)` 를 dispatch 하는 건 소용이 없습니다. 합성
 * 이벤트의 `cancelable` 은 내가 정한 값이고, `preventDefault` 를 불러도
 * 막을 브라우저 동작 자체가 없습니다. 그건 내 코드가 내 코드를 확인하는
 * 것이지 플랫폼을 재는 게 아닙니다.
 *
 * 그래서 CDP 의 `Input.imeSetComposition` 으로 **렌더러의 진짜 조합
 * 상태**를 만듭니다. 한글 IME 로 ㅎ→하→한 을 치는 것과 같은 경로입니다.
 *
 * ## 재고 나서 바뀐 것
 *
 * 결론(막을 수 없다)은 맞았지만 **이유가 틀렸습니다.** 크롬에서
 * `compositionstart`·`compositionupdate`·`compositionend` 는 전부
 * `cancelable === true` 로 보고됩니다. 표준은 `compositionupdate`/`end` 를
 * 취소 불가로 정의하는데도 그렇습니다.
 *
 * 그러니까 `cancelable` 을 보고 "막을 수 있겠구나" 하고 판단하면 틀립니다.
 * 실제로 막히는 것은 `beforeinput` 의 `insertCompositionText` 뿐이고,
 * **그건 정직하게 `cancelable === false` 입니다.**
 */

interface Seen {
  type: string
  inputType: string
  cancelable: boolean
}

let root: HTMLElement
let seen: Seen[]
/** 여기 든 타입만 preventDefault 합니다 */
let block: Set<string>

function record(event: Event): void {
  seen.push({
    type: event.type,
    inputType: event instanceof InputEvent ? event.inputType : '',
    cancelable: event.cancelable,
  })

  if (block.has(event.type)) event.preventDefault()
}

const EVENTS = [
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
] as const

beforeEach(async () => {
  seen = []
  block = new Set()

  root = document.createElement('div')
  root.contentEditable = 'true'
  root.style.minHeight = '40px'
  document.body.appendChild(root)

  for (const type of EVENTS) root.addEventListener(type, record)

  // 실제 포커스가 있어야 CDP 입력이 이 요소로 갑니다
  await userEvent.click(root)
})

afterEach(() => {
  for (const type of EVENTS) root.removeEventListener(type, record)
  root.remove()
})

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

const of = (type: string, inputType?: string): Seen[] =>
  seen.filter(
    (s) => s.type === type && (!inputType || s.inputType === inputType)
  )

describe('조합 중 입력을 preventDefault 로 막을 수 있는가', () => {
  /**
   * 대조군입니다. 이게 통과해야 "막혔다/안 막혔다" 를 재는 계기가
   * 제대로 붙어 있다는 뜻입니다.
   */
  describe('대조군 — 일반 입력', () => {
    it('막으면 안 들어갑니다', async () => {
      block = new Set(['beforeinput'])
      await userEvent.keyboard('a')

      expect(of('beforeinput', 'insertText')[0]?.cancelable).toBe(true)
      expect(root.textContent).toBe('')
    })

    it('안 막으면 들어갑니다', async () => {
      await userEvent.keyboard('a')
      expect(root.textContent).toBe('a')
    })
  })

  /**
   * **여기가 이 스파이크에서 제일 놀란 지점입니다.**
   *
   * 세 조합 이벤트가 전부 `cancelable === true` 라고 말합니다. 표준상
   * `compositionupdate`/`compositionend` 는 취소 불가인데도 그렇습니다.
   * `cancelable` 을 근거로 설계하면 안 된다는 뜻입니다.
   */
  it('크롬은 조합 이벤트를 취소 가능하다고 보고합니다 — 표준과 다릅니다', async () => {
    await composeHan()

    expect(of('compositionstart')[0]?.cancelable).toBe(true)
    expect(of('compositionupdate')[0]?.cancelable).toBe(true)
    expect(of('compositionend')[0]?.cancelable).toBe(true)
  })

  /** 반대로 이쪽은 정직합니다 */
  it('조합 중 beforeinput 은 취소 가능하지 않다고 정직하게 말합니다', async () => {
    await composeHan()

    const composing = of('beforeinput', 'insertCompositionText')
    expect(composing.length).toBeGreaterThan(0)
    for (const event of composing) expect(event.cancelable).toBe(false)
  })

  /**
   * `cancelable` 이 뭐라고 말하든 **행동이 답입니다.**
   */
  describe('실제로 막히는가', () => {
    it('compositionstart 를 막아도 조합은 시작됩니다', async () => {
      block = new Set(['compositionstart'])
      await composeHan()

      expect(root.textContent).toBe('한')
    })

    it('전부 막아도 조합된 글자는 들어갑니다', async () => {
      block = new Set(EVENTS)
      await composeHan()

      expect(root.textContent).toBe('한')
    })
  })

  /**
   * 화해 고리를 언제 돌릴지 결정하는 사실입니다.
   *
   * `compositionend` 가 **마지막 `input` 뒤에** 옵니다. "조합이 끝나면
   * `input` 이 한 번 더 오겠지" 하고 기다리는 설계는 그대로 멈춥니다.
   * `EditorView` 가 `compositionend` 에서 직접 flush 하는 이유입니다.
   */
  it('compositionend 는 마지막 input 뒤에 옵니다', async () => {
    await composeHan()

    const order = seen.map((s) => s.type)
    const lastInput = order.lastIndexOf('input')
    const end = order.lastIndexOf('compositionend')

    expect(end).toBeGreaterThan(lastInput)
  })
})
