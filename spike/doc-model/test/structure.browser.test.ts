import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { userEvent } from '@vitest/browser/context'
import { para, debugString } from '../src/doc'
import { EditorView } from '../src/editor-view'
import { posToDom, readCaret, writeCaret } from '../src/view'

/**
 * **3단계의 성공 기준입니다.**
 *
 * 2단계는 한 문단 안에서 커서가 살아남는 것까지였고, Enter 를 누르면
 * 읽기 단계가 거부했습니다. 이제 거부하지 않습니다.
 *
 * > 문단을 만들고 지우는 동안 **모델과 DOM 이 갈라지지 않고 커서가
 * > 살아남는다.**
 *
 * 브라우저가 다시 정답지 노릇을 합니다 — `mapPos` 가 예측한 커서와
 * 브라우저가 실제로 둔 커서를 매번 비교합니다.
 */

let host: HTMLElement
let view: EditorView

function mount(texts: string[] = ['']): EditorView {
  host = document.createElement('div')
  host.style.minHeight = '80px'
  document.body.appendChild(host)
  return new EditorView(
    host,
    texts.map((t) => para(t))
  )
}

/** 캐럿을 놓고 타이핑합니다 */
async function typeAt(pos: number, keys: string): Promise<void> {
  await userEvent.click(host)
  writeCaret(host, pos)
  await userEvent.keyboard(keys)
}

/** 문단을 가로지르는 선택 — 브라우저에게 지우게 하려고 */
function select(from: number, to: number): void {
  const start = posToDom(host, from)
  const end = posToDom(host, to)
  if (!start || !end) throw new Error(`선택할 수 없는 범위: ${from}..${to}`)

  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)

  const selection = host.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** 모델과 DOM 이 같은 이야기를 하는가 */
function inSync(): void {
  const dom = Array.from(host.children).map((el) => el.textContent ?? '')
  expect(dom).toEqual(view.doc.map((p) => p.text))
}

/** 예측이 실제와 맞는가 */
function caretPredicted(): void {
  for (const flush of view.flushes) {
    expect(flush.predicted, JSON.stringify(flush)).toBe(flush.browser)
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  view?.destroy()
  host?.remove()
})

describe('구조 변경 — 브라우저에서', () => {
  describe('Enter', () => {
    it('문단 가운데에서 나눕니다', async () => {
      view = mount(['ab'])
      await typeAt(2, '{Enter}')

      expect(debugString(view.doc)).toBe('<p>a</p><p>b</p>')
      expect(readCaret(host)).toBe(4) // 둘째 문단 안 첫 자리
      inSync()
      caretPredicted()
    })

    it('문단 끝에서 나누고 이어서 칩니다', async () => {
      view = mount(['ab'])
      await typeAt(3, '{Enter}xy')

      expect(debugString(view.doc)).toBe('<p>ab</p><p>xy</p>')
      inSync()
      caretPredicted()
    })

    it('문단 앞에서 나눕니다', async () => {
      view = mount(['ab'])
      await typeAt(1, '{Enter}')

      expect(debugString(view.doc)).toBe('<p></p><p>ab</p>')
      inSync()
      caretPredicted()
    })

    it('빈 줄을 여러 개 만듭니다', async () => {
      view = mount(['ab'])
      await typeAt(3, '{Enter}{Enter}{Enter}')

      expect(debugString(view.doc)).toBe('<p>ab</p><p></p><p></p><p></p>')
      inSync()
      caretPredicted()
    })
  })

  describe('Backspace', () => {
    /**
     * 이게 3단계에서 제일 중요한 케이스입니다.
     *
     * 진단을 글자 단위로 깎지 않으면 텍스트는 맞는데 **커서만 조용히
     * 틀립니다** (예측 5, 실제 3). `read-structure.test.ts` 가 그 차이를
     * 못박아 뒀고, 여기서 브라우저로 확인합니다.
     */
    it('문단 앞에서 지우면 앞 문단과 합쳐지고 커서가 이음매에 남습니다', async () => {
      view = mount(['ab', 'cd'])
      await typeAt(5, '{Backspace}') // 둘째 문단 첫 자리

      expect(debugString(view.doc)).toBe('<p>abcd</p>')
      expect(readCaret(host)).toBe(3) // b 와 c 사이
      inSync()
      caretPredicted()
    })

    it('합친 뒤 이어서 칩니다', async () => {
      view = mount(['ab', 'cd'])
      await typeAt(5, '{Backspace}XY')

      expect(debugString(view.doc)).toBe('<p>abXYcd</p>')
      inSync()
      caretPredicted()
    })

    it('빈 문단을 지웁니다', async () => {
      view = mount(['ab', '', 'cd'])
      await typeAt(5, '{Backspace}') // 빈 문단 안

      expect(debugString(view.doc)).toBe('<p>ab</p><p>cd</p>')
      inSync()
      caretPredicted()
    })
  })

  describe('문단을 가로지르는 선택', () => {
    it('지우면 두 문단이 합쳐집니다', async () => {
      view = mount(['ab', 'cd'])
      await userEvent.click(host)
      select(2, 6) // "b" 부터 "c" 까지
      await userEvent.keyboard('{Backspace}')

      expect(debugString(view.doc)).toBe('<p>ad</p>')
      inSync()
      caretPredicted()
    })

    it('덮어쓰면 그 자리에 글자가 들어갑니다', async () => {
      view = mount(['ab', 'cd'])
      await userEvent.click(host)
      select(2, 6)
      await userEvent.keyboard('X')

      expect(debugString(view.doc)).toBe('<p>aXd</p>')
      inSync()
      caretPredicted()
    })
  })

  /**
   * ## 편집 열을 넓히다가 나온 것들
   *
   * 3단계를 "종료 조건 충족" 으로 선언할 때 편집 열은 씨앗 **셋**이었습니다.
   * 나중에 25개로 넓히니 8개가 깨졌고, 60개 × 60걸음으로 넓히니 또 다른
   * 종류가 둘 나왔습니다. 아래 둘은 그때 찾은 것을 결정론적으로 고정한
   * 것입니다 — 무작위에 다시 기대지 않으려고요.
   */
  describe('편집 열이 잡아낸 것', () => {
    /**
     * 빈 문단이 양쪽에 똑같이 있으면 **문단 단위 훑기가 편집 지점을
     * 지나칩니다.** 문단 0 끝에서 Enter 를 친 것과 문단 1 앞에서 친 것이
     * 같은 문서를 만들기 때문입니다.
     *
     * 글자 단위에서 커서로 보정한 것과 같은 애매함이 한 층 위에 있었고,
     * 3단계에서는 "구조 쪽에도 있다" 고 적어만 두고 넘어갔습니다.
     */
    it('빈 문단 앞에서 나눠도 진단이 편집 지점을 지나치지 않습니다', async () => {
      view = mount(['시작a', ''])
      await typeAt(4, '{Enter}') // 문단 0 의 끝

      expect(debugString(view.doc)).toBe('<p>시작a</p><p></p><p></p>')
      expect(view.flushes[0].changes).toEqual([
        { from: 4, to: 4, insert: { texts: ['', ''] } },
      ])
      inSync()
      caretPredicted()
    })

    /**
     * 브라우저는 `beforeinput` 을 보내 놓고 **아무것도 안 바꾸기도 합니다** —
     * 문서 맨 앞에서 Backspace 가 그렇습니다. 그러면 `input` 이 오지 않아
     * `flush()` 가 돌지 않고, 적어 둔 커서가 남아 **다음 편집을 망칩니다.**
     *
     * 씨앗 58 의 23번째 걸음이 이걸 잡았습니다. 25개 × 40걸음에서는
     * 안 나왔습니다.
     */
    it('아무 일도 안 일어난 Backspace 가 다음 편집을 망치지 않습니다', async () => {
      view = mount(['', 'ab'])

      await typeAt(1, '{Backspace}') // 맨 앞 — 브라우저가 무시합니다
      expect(view.flushes).toHaveLength(0)

      await typeAt(4, '{Enter}') // 다른 자리에서 편집
      expect(debugString(view.doc)).toBe('<p></p><p>a</p><p>b</p>')
      inSync()
      caretPredicted()
    })
  })

  /**
   * **종료 조건입니다.** 씨앗을 고정한 무작위 편집 열을 브라우저에 먹이고,
   * **매 flush 마다** 모델과 DOM 이 같은지 · 커서 예측이 맞는지 봅니다.
   *
   * 1단계는 id 배열이 오라클이었고, 여기서는 브라우저 자신이 오라클입니다.
   */
  describe('무작위 편집 열', () => {
    /** mulberry32 — 씨앗으로 재현 가능한 난수 */
    function rng(seed: number): () => number {
      let a = seed >>> 0
      return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    const KEYS = ['a', 'b', '가', '{Enter}', '{Backspace}', '{Enter}', 'c']

    /**
     * **커서를 무작위로 옮기는 것이 핵심입니다.**
     *
     * 처음엔 이 줄이 없었고, 그러면 커서가 늘 마지막 편집 자리에 붙어 있어서
     * Enter 는 문단 끝에서만 · Backspace 는 방금 만든 빈 문단에서만
     * 일어났습니다. 그 조합은 진단을 깎든 안 깎든 커서 예측이 우연히
     * 일치해서, 글자 단위 깎기를 통째로 지워도 **이 테스트가 통과했습니다.**
     *
     * 무작위 열이라고 다 센 게 아닙니다. 무엇이 흔들리는지를 봐야 합니다.
     */
    function jump(random: () => number): void {
      const size = view.doc.reduce((s, p) => s + p.text.length + 2, 0)
      const pos = 1 + Math.floor(random() * Math.max(size - 2, 1))
      writeCaret(host, pos)
    }

    /*
     * **씨앗 수를 셋에서 스물로 늘렸습니다.**
     *
     * 셋일 때 종료 조건을 선언했는데, 나중에 25개로 넓히자 8개가 깨졌습니다.
     * 60개 × 60걸음까지 밀어 보고 통과하는 것을 확인했지만, 매번 1분씩
     * 걸리는 것을 상시 테스트로 두지는 않았습니다. 스물이 타협점입니다.
     *
     * 넓힌 사냥에서 나온 것들은 위에 결정론적 테스트로 고정해 뒀습니다.
     */
    for (const seed of Array.from({ length: 20 }, (_, i) => i + 1)) {
      it(`씨앗 ${seed} — 40번 편집하는 동안 갈라지지 않습니다`, async () => {
        view = mount(['시작'])
        const random = rng(seed)

        await userEvent.click(host)
        writeCaret(host, 3)

        for (let step = 0; step < 40; step += 1) {
          if (random() < 0.4) jump(random)

          const key = KEYS[Math.floor(random() * KEYS.length)]
          const before = view.flushes.length
          await userEvent.keyboard(key)

          const dom = Array.from(host.children).map(
            (el) => el.textContent ?? ''
          )
          expect(dom, `seed=${seed} step=${step} key=${key}`).toEqual(
            view.doc.map((p) => p.text)
          )

          for (const flush of view.flushes.slice(before)) {
            expect(
              flush.predicted,
              `seed=${seed} step=${step} key=${key} ${JSON.stringify(flush)}`
            ).toBe(flush.browser)
          }
        }

        expect(view.flushes.length).toBeGreaterThan(15)
        expect(view.doc.length).toBeGreaterThan(1) // 구조 변경이 실제로 일어났는지
      })
    }
  })
})
