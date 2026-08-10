import { describe, it, expect } from 'vitest'
import { mapPos } from '../src/map'
import type { ChangeSet } from '../src/change'

/**
 * `assoc` — 위치가 삽입 지점에 정확히 걸쳤을 때 앞뒤 어디에 붙는가.
 *
 * 이걸 빼면 매핑이 "돌아가는데" 커서가 이상하게 굽니다. 인자 하나짜리라
 * 처음에 넣는 것이 싸고, 나중에 넣으려면 호출부를 전부 다시 봐야 합니다.
 */
describe('assoc — 삽입 지점의 방향성', () => {
  /** 위치 3 에 "XY" 를 삽입 */
  const insert: ChangeSet = [{ from: 3, to: 3, insert: 'XY' }]

  it('삽입 지점 뒤의 위치는 방향과 무관하게 밀립니다', () => {
    expect(mapPos(5, insert, 1)).toBe(7)
    expect(mapPos(5, insert, -1)).toBe(7)
  })

  it('삽입 지점 앞의 위치는 방향과 무관하게 그대로입니다', () => {
    expect(mapPos(1, insert, 1)).toBe(1)
    expect(mapPos(1, insert, -1)).toBe(1)
  })

  /** 여기가 유일하게 갈리는 지점입니다 */
  it('삽입 지점에 정확히 걸치면 방향이 결정합니다', () => {
    // 커서: 내가 친 글자 뒤에 있어야 합니다
    expect(mapPos(3, insert, 1)).toBe(5)
    // 앞에 고정된 표식: 삽입된 글자 앞에 남아야 합니다
    expect(mapPos(3, insert, -1)).toBe(3)
  })

  /**
   * 지워진 구간 안을 가리키던 위치는 갈 곳이 없습니다. 경계로 접는 수밖에
   * 없고, **이때 정보가 사라집니다.** 협업에서 "상대가 내가 보던 자리를
   * 지웠을 때" 가 정확히 이 경우입니다.
   */
  describe('지워진 자리', () => {
    const replace: ChangeSet = [{ from: 2, to: 6, insert: 'Z' }]

    it('구간 안의 위치는 경계로 접힙니다', () => {
      expect(mapPos(4, replace, -1)).toBe(2)
      expect(mapPos(4, replace, 1)).toBe(3) // 2 + 삽입 길이 1
    })

    it('구간 안의 서로 다른 위치가 같은 곳으로 갑니다 — 되돌릴 수 없습니다', () => {
      expect(mapPos(3, replace, -1)).toBe(mapPos(5, replace, -1))
    })
  })

  describe('변경 여럿', () => {
    /** 정렬돼 있고 겹치지 않아야 합니다 */
    const changes: ChangeSet = [
      { from: 1, to: 1, insert: 'ab' }, // +2
      { from: 5, to: 8, insert: 'c' }, // -2
    ]

    it('앞의 변경만 누적됩니다', () => {
      expect(mapPos(0, changes)).toBe(0)
      expect(mapPos(3, changes)).toBe(5) // +2
      expect(mapPos(10, changes)).toBe(10) // +2 -2
    })
  })
})
