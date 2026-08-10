import { describe, it, expect } from 'vitest'
import { para, debugString, docSize, type Doc } from '../src/doc'
import {
  applyChanges,
  insertSize,
  SPLIT,
  type ChangeSet,
  type Slice,
} from '../src/change'
import { mapPos } from '../src/map'

/**
 * **3단계의 성공 기준입니다.**
 *
 * 1·2단계는 "한 문단 안" 이라는 울타리를 치고 있었습니다. 그 울타리를 친
 * 것이 좌표계가 아니라 **변경의 표현**이었다는 것을 여기서 확인합니다.
 *
 * 좌표계는 처음부터 문단 경계를 위치로 세고 있었습니다 —
 * `paraSize = 텍스트 길이 + 2`. 경계를 가리킬 수는 있는데 만들 수가 없었던
 * 것뿐입니다. `insert` 가 글자열이었으니까요.
 */
describe('구조 변경 — 문단 나누기와 합치기', () => {
  describe('경계도 위치를 먹습니다', () => {
    it('글자만 넣으면 글자 수만큼', () => {
      expect(insertSize('abc')).toBe(3)
      expect(insertSize({ texts: ['abc'] })).toBe(3)
    })

    /** 경계 하나 = 닫는 토큰 + 여는 토큰 */
    it('조각이 둘이면 경계 하나만큼 2 가 더 붙습니다', () => {
      expect(insertSize(SPLIT)).toBe(2)
      expect(insertSize({ texts: ['ab', 'cd'] })).toBe(6)
    })

    it('조각이 셋이면 경계 둘', () => {
      expect(insertSize({ texts: ['', '', ''] })).toBe(4)
    })
  })

  /**
   * ```
   * 0     1  2  3     4
   * <p>   a  b  </p>
   * ```
   * 위치 2 (a 와 b 사이) 에 경계를 넣습니다.
   */
  describe('나누기', () => {
    const doc: Doc = [para('ab')]

    it('문단 가운데', () => {
      const after = applyChanges(doc, [{ from: 2, to: 2, insert: SPLIT }])
      expect(debugString(after)).toBe('<p>a</p><p>b</p>')
    })

    it('문단 끝', () => {
      const after = applyChanges(doc, [{ from: 3, to: 3, insert: SPLIT }])
      expect(debugString(after)).toBe('<p>ab</p><p></p>')
    })

    it('문단 앞', () => {
      const after = applyChanges(doc, [{ from: 1, to: 1, insert: SPLIT }])
      expect(debugString(after)).toBe('<p></p><p>ab</p>')
    })

    it('문서가 정확히 2 만큼 커집니다', () => {
      const after = applyChanges(doc, [{ from: 2, to: 2, insert: SPLIT }])
      expect(docSize(after)).toBe(docSize(doc) + 2)
    })
  })

  /**
   * 합치기는 **경계 토큰 두 개를 지우는 것**입니다.
   *
   * ```
   * 0     1  2  3     4     5  6  7     8
   * <p>   a  b  </p>  <p>   c  d  </p>
   *                ╰──┬──╯
   *                 3..5 를 지웁니다
   * ```
   */
  describe('합치기', () => {
    const doc: Doc = [para('ab'), para('cd')]

    it('경계를 지우면 두 문단이 하나가 됩니다', () => {
      const after = applyChanges(doc, [{ from: 3, to: 5, insert: '' }])
      expect(debugString(after)).toBe('<p>abcd</p>')
      expect(docSize(after)).toBe(docSize(doc) - 2)
    })

    it('문단을 가로지르는 삭제', () => {
      // "b" 부터 "c" 까지 — 경계를 포함해서 지웁니다
      const after = applyChanges(doc, [{ from: 2, to: 6, insert: '' }])
      expect(debugString(after)).toBe('<p>ad</p>')
    })

    it('문단을 가로지르는 치환', () => {
      const after = applyChanges(doc, [{ from: 2, to: 6, insert: 'X' }])
      expect(debugString(after)).toBe('<p>aXd</p>')
    })
  })

  it('문단 여러 개를 한 번에 넣습니다 — 붙여넣기', () => {
    const doc: Doc = [para('ad')]
    const insert: Slice = { texts: ['b', 'c', ''] }
    const after = applyChanges(doc, [{ from: 2, to: 2, insert }])

    expect(debugString(after)).toBe('<p>ab</p><p>c</p><p>d</p>')
  })

  /**
   * ## 여기가 이 단계의 요점입니다
   *
   * `applyChanges` 와 읽기 단계는 다시 썼는데 `mapPos` 는 `insert.length` 를
   * `insertSize(insert)` 로 바꾼 것이 전부입니다. **구조 변경을 아는 코드가
   * 매핑 안에는 한 줄도 없습니다.**
   *
   * 좌표계가 경계를 위치로 세고 있었기 때문에, 경계를 만드는 편집도 그 안에서
   * 그냥 "2 만큼 늘어나는 변경" 입니다.
   */
  describe('매핑은 구조 변경을 몰라도 됩니다', () => {
    const doc: Doc = [para('hello')]

    it('나누기 뒤의 위치가 2 만큼 밀립니다', () => {
      const changes: ChangeSet = [{ from: 3, to: 3, insert: SPLIT }]
      // "hello" 의 o 뒤 (위치 6) → 새 둘째 문단 안
      expect(mapPos(6, changes)).toBe(8)
    })

    it('나눈 자리에 걸친 커서는 새 문단 앞으로 갑니다', () => {
      const changes: ChangeSet = [{ from: 3, to: 3, insert: SPLIT }]
      expect(mapPos(3, changes, 1)).toBe(5) // 둘째 문단 안 첫 자리
      expect(mapPos(3, changes, -1)).toBe(3) // 첫 문단 안 끝자리
    })

    it('합치기 뒤의 위치가 2 만큼 당겨집니다', () => {
      const merged: ChangeSet = [{ from: 3, to: 5, insert: '' }]
      expect(mapPos(6, merged)).toBe(4)
    })

    it('문서 끝은 언제나 새 문서 끝으로 갑니다', () => {
      for (const changes of [
        [{ from: 3, to: 3, insert: SPLIT }],
        [{ from: 1, to: 1, insert: { texts: ['x', 'y', 'z'] } }],
        [{ from: 2, to: 4, insert: '' }],
      ] as ChangeSet[]) {
        const after = applyChanges(doc, changes)
        expect(mapPos(docSize(doc), changes)).toBe(docSize(after))
      }
    })
  })

  /**
   * 마크는 지워지는 범위 **밖**만 살립니다. 구조 변경은 마크 구간을 문단째로
   * 찢을 수 있어서 정확히 옮기려면 마크도 조각열로 들고 다녀야 합니다 —
   * ProseMirror 의 `Slice` 가 실제로 그렇습니다. 여기서는 잘랐습니다.
   */
  it('나눠도 앞 문단의 마크는 남습니다', () => {
    const doc: Doc = [para('abcd', [{ type: 'bold', from: 0, to: 2 }])]
    const after = applyChanges(doc, [{ from: 4, to: 4, insert: SPLIT }])

    expect(debugString(after)).toBe('<p>abc</p><p>d</p>')
    expect(after[0].marks).toEqual([{ type: 'bold', from: 0, to: 2 }])
  })
})
