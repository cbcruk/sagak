import { describe, it, expect } from 'vitest'
import { para, debugString, type Doc } from '../src/doc'
import { applyChanges, insertSize, sliceOf } from '../src/change'
import { diffParagraphs } from '../src/read-dom'
import { mapPos } from '../src/map'

/**
 * 문단 구조가 달라진 DOM 을 읽어 변경 하나로 되짚습니다.
 *
 * ## 왜 두 겹으로 깎는가
 *
 * 문단 단위로만 깎으면 변경이 통째로 커집니다. 텍스트는 그래도 맞지만
 * **커서 예측이 무너집니다** — `mapPos` 의 ③번(지워진 구간 안은 경계로
 * 접힘)에 걸리기 때문입니다. 그래서 글자 단위로 한 번 더 깎습니다.
 *
 * 깎고 나면 "문단을 합친다" 가 **경계 토큰 둘을 지운다** 로 정확히
 * 표현됩니다.
 */
describe('구조 변경 읽기', () => {
  /** 진단한 변경을 적용하면 DOM 과 같아져야 합니다 — 언제나 */
  const roundTrip = (doc: Doc, dom: string[]): void => {
    const changes = diffParagraphs(doc, dom)
    const after = applyChanges(doc, changes)
    expect(after.map((p) => p.text)).toEqual(dom)
  }

  describe('Enter — 문단 나누기', () => {
    const doc: Doc = [para('ab')]

    it('가운데에서 나누면 경계 하나만 넣습니다', () => {
      const changes = diffParagraphs(doc, ['a', 'b'])

      expect(changes).toEqual([{ from: 2, to: 2, insert: { texts: ['', ''] } }])
      roundTrip(doc, ['a', 'b'])
    })

    it('끝에서 나누기', () => {
      expect(diffParagraphs(doc, ['ab', ''])).toEqual([
        { from: 3, to: 3, insert: { texts: ['', ''] } },
      ])
      roundTrip(doc, ['ab', ''])
    })

    it('앞에서 나누기', () => {
      expect(diffParagraphs(doc, ['', 'ab'])).toEqual([
        { from: 1, to: 1, insert: { texts: ['', ''] } },
      ])
      roundTrip(doc, ['', 'ab'])
    })
  })

  describe('Backspace — 문단 합치기', () => {
    const doc: Doc = [para('ab'), para('cd')]

    /**
     * ```
     * 0     1  2  3     4     5  6  7     8
     * <p>   a  b  </p>  <p>   c  d  </p>
     *                ╰──┬──╯
     *                 3..5 — 경계 토큰 둘
     * ```
     */
    it('경계 토큰 둘만 지웁니다', () => {
      expect(diffParagraphs(doc, ['abcd'])).toEqual([
        { from: 3, to: 5, insert: { texts: [''] } },
      ])
      roundTrip(doc, ['abcd'])
    })

    /**
     * 깎지 않았다면 `1..7 → "abcd"` 가 됐을 것이고, 커서 예측이 틀립니다.
     * 이 테스트가 그 차이를 못박아 둡니다.
     */
    it('깎지 않은 진단이면 커서 예측이 틀립니다', () => {
      const trimmed = diffParagraphs(doc, ['abcd'])
      const coarse = [{ from: 1, to: 7, insert: 'abcd' }]

      // 커서는 둘째 문단 첫 자리(5) 에 있었고, 합쳐지면 3 이 돼야 합니다
      expect(mapPos(5, trimmed, 1)).toBe(3)
      expect(mapPos(5, coarse, 1)).toBe(5)

      // 그런데 텍스트 결과는 둘 다 같습니다 — 그래서 조용히 틀립니다
      expect(debugString(applyChanges(doc, coarse))).toBe(
        debugString(applyChanges(doc, trimmed))
      )
    })

    it('문단을 가로지르는 선택 삭제', () => {
      // "b" 부터 "c" 까지 지워 "ad" 한 문단으로
      expect(diffParagraphs(doc, ['ad'])).toEqual([
        { from: 2, to: 6, insert: { texts: [''] } },
      ])
      roundTrip(doc, ['ad'])
    })
  })

  describe('문단 여럿', () => {
    it('가운데 문단 삭제', () => {
      const doc: Doc = [para('a'), para('b'), para('c')]
      roundTrip(doc, ['a', 'c'])
    })

    it('여러 문단 붙여넣기', () => {
      const doc: Doc = [para('ad')]
      roundTrip(doc, ['ab', 'c', 'd'])
    })

    it('앞뒤로 그대로인 문단은 건드리지 않습니다', () => {
      const doc: Doc = [para('머리'), para('ab'), para('꼬리')]
      const changes = diffParagraphs(doc, ['머리', 'a', 'b', '꼬리'])

      expect(changes).toHaveLength(1)
      // 첫 문단(크기 4) 을 지나 둘째 문단의 a 뒤
      expect(changes[0].from).toBe(6)
      expect(changes[0].to).toBe(6)
      roundTrip(doc, ['머리', 'a', 'b', '꼬리'])
    })
  })

  describe('변화가 없으면', () => {
    it('빈 목록', () => {
      const doc: Doc = [para('a'), para('b')]
      expect(diffParagraphs(doc, ['a', 'b'])).toEqual([])
    })
  })

  /**
   * 크기 산술이 맞는지 — 진단한 변경의 증감이 실제 문서 크기 변화와
   * 같아야 합니다. 안 맞으면 그 뒤의 모든 좌표가 조용히 틀어집니다.
   */
  it('진단한 크기 변화가 실제와 맞습니다', () => {
    const cases: [Doc, string[]][] = [
      [[para('ab')], ['a', 'b']],
      [[para('ab'), para('cd')], ['abcd']],
      [[para('ad')], ['ab', 'c', 'd']],
      [
        [para('a'), para('b'), para('c')],
        ['a', 'c'],
      ],
      [[para('가나다')], ['가', '나다']],
    ]

    for (const [doc, dom] of cases) {
      const changes = diffParagraphs(doc, dom)
      const predicted = changes.reduce(
        (sum, c) => sum + insertSize(c.insert) - (c.to - c.from),
        0
      )
      const before = doc.reduce((s, p) => s + p.text.length + 2, 0)
      const after = dom.reduce((s, t) => s + t.length + 2, 0)

      expect(predicted, JSON.stringify({ dom, changes })).toBe(after - before)
    }
  })

  it('한 문단 안의 변화는 조각 하나짜리로 남습니다', () => {
    const doc: Doc = [para('hello')]
    const changes = diffParagraphs(doc, ['hi'])

    expect(sliceOf(changes[0].insert).texts).toHaveLength(1)
  })
})
