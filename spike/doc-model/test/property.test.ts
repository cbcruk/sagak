import { describe, it, expect } from 'vitest'
import { insertSize, type Change, type ChangeSet } from '../src/change'
import { mapPos } from '../src/map'

/**
 * 매핑을 **독립적인 오라클**로 검증합니다.
 *
 * ## 왜 예시 테스트로는 부족한가
 *
 * `mapPos` 는 자료구조 위의 산술입니다. 손으로 고른 예시 몇 개는 통과하는데
 * 특정 조합에서만 틀리는 종류의 버그가 나오고, 그건 눈으로 못 찾습니다.
 * sagak 의 브라우저 테스트 24,700줄은 이런 걸 잡지 못합니다.
 *
 * ## 오라클 — 글자마다 신분증을 붙입니다
 *
 * 문단 텍스트를 **문자 배열이 아니라 id 배열**로 두고 변경을 적용합니다.
 * 그러면 "원래 `t` 번째 글자가 지금 어디에 있는가" 를 `indexOf` 로 직접
 * 알 수 있습니다. `mapPos` 와 완전히 독립된 답이므로 서로 검산이 됩니다.
 *
 * (`fast-check` 를 쓰면 반례 축소까지 되지만, 의존성을 늘리지 않으려고
 * 씨앗 기반 생성기를 직접 썼습니다. 실패하면 씨앗이 출력되므로 재현됩니다.)
 */

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

/** 텍스트 오프셋 → 문서 위치 (문단 하나짜리 문서, 여는 토큰 1) */
const toDocPos = (textOffset: number): number => textOffset + 1
/** 문서 위치 → 텍스트 오프셋 */
const toTextOffset = (docPos: number): number => docPos - 1

interface Case {
  textLength: number
  changes: ChangeSet
  /** 추적할 원래 텍스트 오프셋 */
  tracked: number
}

/**
 * 정렬·비겹침 변경 목록을 만듭니다.
 *
 * `mapPos` 는 이 전제 위에 서 있으므로 생성기가 지켜야 합니다. 전제를 깨는
 * 입력으로 재면 구현이 아니라 전제를 재게 됩니다.
 */
function makeCase(random: () => number): Case {
  const textLength = 5 + Math.floor(random() * 20)
  const changes: Change[] = []

  let cursor = 0
  while (cursor < textLength) {
    const gap = Math.floor(random() * 4)
    const from = cursor + gap
    if (from >= textLength) break

    const deleteLen = Math.floor(random() * 4)
    const to = Math.min(from + deleteLen, textLength)
    const insertLen = Math.floor(random() * 4)

    changes.push({
      from: toDocPos(from),
      to: toDocPos(to),
      insert: 'x'.repeat(insertLen),
    })

    cursor = to + 1
  }

  // 지워지는 구간 **밖**의 오프셋만 추적합니다.
  // 구간 안은 정보가 사라지는 자리라 오라클이 성립하지 않습니다 (assoc.test 참고).
  const safe: number[] = []
  for (let t = 0; t <= textLength; t += 1) {
    const inside = changes.some((c) => {
      const cf = toTextOffset(c.from)
      const ct = toTextOffset(c.to)
      return t >= cf && t < ct
    })
    if (!inside) safe.push(t)
  }

  return {
    textLength,
    changes,
    tracked: safe[Math.floor(random() * safe.length)] ?? 0,
  }
}

/** 오라클 — id 배열에 변경을 적용하고 추적 대상이 어디로 갔는지 봅니다 */
function oracle(c: Case): number {
  const ids: number[] = Array.from({ length: c.textLength }, (_, i) => i)

  // 뒤에서부터 적용해야 앞쪽 좌표가 유효합니다
  for (let i = c.changes.length - 1; i >= 0; i -= 1) {
    const { from, to, insert } = c.changes[i]
    const cf = toTextOffset(from)
    const ct = toTextOffset(to)
    const inserted = Array.from({ length: insertSize(insert) }, () => -1)
    ids.splice(cf, ct - cf, ...inserted)
  }

  if (c.tracked === c.textLength) return toDocPos(ids.length)

  const index = ids.indexOf(c.tracked)
  return toDocPos(index)
}

describe('매핑 성질', () => {
  it('추적한 글자의 실제 위치와 mapPos 가 일치해야 함 (200회)', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const c = makeCase(rng(seed))
      const expected = oracle(c)
      const actual = mapPos(toDocPos(c.tracked), c.changes, 1)

      expect(
        actual,
        `seed=${seed} tracked=${c.tracked} changes=${JSON.stringify(c.changes)}`
      ).toBe(expected)
    }
  })

  /**
   * 순서가 뒤집히면 선택 영역이 뒤집힙니다 — `anchor > head` 같은 상태가
   * 생기고, 그 위에 올라탄 모든 것이 무너집니다.
   */
  it('순서를 보존해야 함 (200회)', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = rng(seed)
      const c = makeCase(random)

      let previous = -1
      for (let pos = 0; pos <= c.textLength + 1; pos += 1) {
        const mapped = mapPos(pos, c.changes, 1)
        expect(mapped, `seed=${seed} pos=${pos}`).toBeGreaterThanOrEqual(
          previous
        )
        previous = mapped
      }
    }
  })

  it('빈 변경 목록은 아무것도 바꾸지 않아야 함', () => {
    for (let pos = 0; pos <= 20; pos += 1) {
      expect(mapPos(pos, [])).toBe(pos)
    }
  })
})
