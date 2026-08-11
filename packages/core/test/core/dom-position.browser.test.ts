import { describe, it, expect, afterEach } from 'vitest'
import {
  contentSize,
  domToPos,
  nodeSize,
  posToDom,
  readSelectionPositions,
  writeSelectionPositions,
} from '@/core/dom-position'

/**
 * **`docs/spike-to-product.md` 가 착수 전 확인하라고 못박은 관문입니다.**
 *
 * > 표·목록이 있는 문서에서도 좌표가 서는지. 평평한 문단에서만 되면
 * > 반쪽입니다. 이건 재고 시작해야 합니다.
 *
 * 여기서 재는 것은 **왕복**입니다 — 문서 안의 모든 유효한 위치에 대해
 * `domToPos(posToDom(p)) === p` 여야 합니다. 하나라도 어긋나면 그 자리에
 * 캐럿을 되돌릴 수 없습니다.
 *
 * 손으로 고른 예시로는 부족하므로 본체가 실제로 만드는 구조를 그대로
 * 넣었습니다 — `table-plugin` 은 빈 칸에 `<br>` 을 넣고, 목록은 `<li>` 를
 * 중첩합니다.
 */

let root: HTMLElement

function mount(html: string): HTMLElement {
  root = document.createElement('div')
  root.contentEditable = 'true'
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  root?.remove()
})

/** 본체가 실제로 만드는 구조들 */
const FIXTURES: Record<string, string> = {
  문단만: '<p>hello world</p><p>second</p>',
  '빈 문단': '<p><br></p><p>after</p>',
  '인라인 서식': '<p>a <strong>bold</strong> and <em>em</em> z</p>',
  '중첩 인라인': '<p><strong><em>both</em></strong> tail</p>',
  목록: '<ul><li>one</li><li>two</li></ul>',
  '중첩 목록': '<ul><li>one<ul><li>deep</li></ul></li><li>two</li></ul>',
  '표 (빈 칸은 br)':
    '<table><tbody><tr><td><br></td><td>x</td></tr><tr><td>y</td><td><br></td></tr></tbody></table>',
  '표 + 문단':
    '<p>before</p><table><tbody><tr><td>cell</td></tr></tbody></table><p>after</p>',
  이미지: '<p>a<img src="data:," alt="">b</p>',
  가로줄: '<p>a</p><hr><p>b</p>',
  링크: '<p>see <a href="#x">this</a> here</p>',
  '한글·이모지': '<p>안녕하세요 👋 반갑습니다</p>',
  '깊은 중첩':
    '<table><tbody><tr><td><ul><li><strong>deep</strong></li></ul></td></tr></tbody></table>',
}

describe('DOM 정수 좌표', () => {
  describe('크기 세기', () => {
    it('텍스트는 글자 수', () => {
      mount('<p>abc</p>')
      expect(nodeSize(root.firstChild!.firstChild!)).toBe(3)
    })

    it('요소는 여는 토큰 + 안 + 닫는 토큰', () => {
      mount('<p>abc</p>')
      expect(nodeSize(root.firstChild!)).toBe(5)
      expect(contentSize(root)).toBe(5)
    })

    it('빈 문단도 2 를 차지합니다 — 캐럿을 놓을 자리가 있어야 합니다', () => {
      mount('<p></p>')
      expect(contentSize(root)).toBe(2)
    })

    it('안이 없는 요소는 1 입니다', () => {
      mount('<p><br></p>')
      // <p> 여는 1 + <br> 1 + 닫는 1
      expect(contentSize(root)).toBe(3)
    })

    it('이모지는 UTF-16 단위로 셉니다 — Range 오프셋과 같은 기준', () => {
      mount('<p>👋</p>')
      // 서러게이트 쌍이라 2
      expect(contentSize(root)).toBe(4)
    })
  })

  /**
   * **관문입니다.** 모든 위치가 왕복해야 합니다.
   */
  describe('왕복 — 모든 위치가 제자리로 돌아와야 합니다', () => {
    for (const [name, html] of Object.entries(FIXTURES)) {
      it(name, () => {
        mount(html)
        const size = contentSize(root)
        expect(size).toBeGreaterThan(0)

        for (let pos = 0; pos <= size; pos += 1) {
          const point = posToDom(root, pos)
          expect(
            point,
            `${name} — 위치 ${pos} 를 DOM 으로 못 옮깁니다`
          ).not.toBeNull()

          const back = domToPos(root, point!.node, point!.offset)
          expect(back, `${name} — 위치 ${pos} 왕복 실패`).toBe(pos)
        }
      })
    }
  })

  /**
   * **왕복만으로는 부족합니다.**
   *
   * `domToPos` 와 `posToDom` 이 **같이** 틀리면 왕복은 그대로 통과합니다.
   * 실제로 `<br>` 크기를 1 대신 0 으로 고장 내 보니 왕복 테스트 13개가
   * 전부 통과했습니다 — 두 방향이 사이좋게 틀렸기 때문입니다.
   * `spike/doc-model` 에서 오라클이 순환했던 것과 같은 종류입니다.
   *
   * 그래서 좌표계를 **밖에 있는 것**에 묶습니다. 크기는 이렇게도 셀 수
   * 있습니다 —
   *
   * ```
   * 글자 수 + 2 × (안이 있는 요소 수) + 1 × (안이 없는 요소 수)
   * ```
   *
   * 글자 수는 `Range.toString()`, 요소 수는 `querySelectorAll` 로 구합니다.
   * 둘 다 브라우저가 세 주는 것이라 `nodeSize` 와 독립입니다.
   */
  describe('독립 계산과 맞는가 — 왕복이 못 잡는 것', () => {
    const LEAF = 'br,img,hr,input,area,col,embed,source,track,wbr'

    function independentSize(el: HTMLElement): number {
      const range = el.ownerDocument.createRange()
      range.selectNodeContents(el)
      const chars = range.toString().length

      const all = Array.from(el.querySelectorAll('*'))
      const leaves = all.filter((n) => n.matches(LEAF)).length
      const boxes = all.length - leaves

      return chars + 2 * boxes + leaves
    }

    for (const [name, html] of Object.entries(FIXTURES)) {
      it(name, () => {
        mount(html)
        expect(contentSize(root)).toBe(independentSize(root))
      })
    }
  })

  /**
   * 같은 위치를 가리키는 DOM 좌표가 여럿일 때 무엇을 고르는지 —
   * 왕복은 어느 쪽을 골라도 통과하므로 따로 못박아 둡니다.
   *
   * 캐럿을 놓는 것이 목적이라 **텍스트 노드 쪽**이어야 합니다. 요소 경계에
   * 놓인 캐럿은 브라우저마다 다르게 굽니다.
   */
  describe('애매한 자리에서는 텍스트 노드를 고릅니다', () => {
    it('텍스트 시작', () => {
      mount('<p>ab</p>')
      const point = posToDom(root, 1)
      expect(point?.node.nodeType).toBe(Node.TEXT_NODE)
      expect(point?.offset).toBe(0)
    })

    it('텍스트 끝', () => {
      mount('<p>ab</p>')
      const point = posToDom(root, 3)
      expect(point?.node.nodeType).toBe(Node.TEXT_NODE)
      expect(point?.offset).toBe(2)
    })

    it('인라인 요소 앞은 바깥 텍스트의 끝으로', () => {
      mount('<p>a<strong>b</strong></p>')
      // 위치 2 = "a" 뒤 = <strong> 앞
      const point = posToDom(root, 2)
      expect(point?.node.nodeType).toBe(Node.TEXT_NODE)
      expect(point?.node.nodeValue).toBe('a')
      expect(point?.offset).toBe(1)
    })
  })

  describe('범위 밖', () => {
    it('음수와 초과는 null', () => {
      mount('<p>ab</p>')
      expect(posToDom(root, -1)).toBeNull()
      expect(posToDom(root, contentSize(root) + 1)).toBeNull()
    })

    it('root 밖의 노드는 null', () => {
      mount('<p>ab</p>')
      const outside = document.createElement('p')
      document.body.appendChild(outside)
      expect(domToPos(root, outside, 0)).toBeNull()
      outside.remove()
    })
  })

  /**
   * 실제로 쓰이는 방식입니다 — 캐럿을 놓고, 읽고, 내용을 갈아끼우고,
   * 되돌립니다.
   */
  describe('선택 영역 읽고 쓰기', () => {
    it('캐럿을 읽고 그대로 되돌립니다', () => {
      mount('<p>hello world</p>')
      expect(writeSelectionPositions(root, { anchor: 7, head: 7 })).toBe(true)
      expect(readSelectionPositions(root)).toEqual({ anchor: 7, head: 7 })
    })

    it('선택 영역도 읽고 되돌립니다', () => {
      mount('<p>hello world</p>')
      expect(writeSelectionPositions(root, { anchor: 3, head: 8 })).toBe(true)
      expect(readSelectionPositions(root)).toEqual({ anchor: 3, head: 8 })
    })

    it('표 안의 칸에도 캐럿이 갑니다', () => {
      mount(FIXTURES['표 (빈 칸은 br)'])
      const size = contentSize(root)

      for (let pos = 0; pos <= size; pos += 1) {
        if (!writeSelectionPositions(root, { anchor: pos, head: pos })) continue
        const read = readSelectionPositions(root)
        expect(read?.anchor, `위치 ${pos}`).toBe(pos)
      }
    })

    /**
     * **핵심입니다.** `innerHTML` 을 갈아끼워도 정수는 살아남습니다.
     * `Range` 로는 안 되는 것이 이것입니다.
     */
    it('innerHTML 을 갈아끼워도 같은 자리로 돌아옵니다', () => {
      mount('<p>hello brave world</p>')
      writeSelectionPositions(root, { anchor: 12, head: 12 })
      const saved = readSelectionPositions(root)
      expect(saved).toEqual({ anchor: 12, head: 12 })

      // 같은 내용을 다시 넣습니다 — 노드는 전부 새것입니다
      root.innerHTML = '<p>hello brave world</p>'
      expect(writeSelectionPositions(root, saved!)).toBe(true)
      expect(readSelectionPositions(root)).toEqual({ anchor: 12, head: 12 })
    })

    it('문서가 줄어들면 끝으로 접습니다', () => {
      mount('<p>hello brave world</p>')
      root.innerHTML = '<p>hi</p>'
      expect(writeSelectionPositions(root, { anchor: 12, head: 12 })).toBe(true)
      expect(readSelectionPositions(root)?.anchor).toBe(contentSize(root))
    })
  })

  /**
   * 대조군입니다. `Range` 를 저장했다가 되돌리는 기존 방식이 왜 안 되는지 —
   * **예외도 없이 조용히 0 으로 갑니다.**
   */
  it('대조군 — cloneRange 는 innerHTML 교체를 못 견딥니다', () => {
    mount('<p>hello brave world</p>')

    const range = document.createRange()
    range.setStart(root.firstChild!.firstChild!, 11)
    range.collapse(true)
    const saved = range.cloneRange()

    root.innerHTML = '<p>hello brave world</p>'

    const selection = getSelection()!
    selection.removeAllRanges()
    selection.addRange(saved) // 예외가 안 납니다

    expect(selection.rangeCount).toBe(1)
    expect(readSelectionPositions(root)).not.toEqual({ anchor: 11, head: 11 })
  })
})
