import { describe, it, expect } from 'vitest'
import { para, docSize, type Doc } from '../src/doc'
import {
  applyChanges,
  insertSize,
  type Change,
  type ChangeSet,
  type Slice,
} from '../src/change'
import { mapPos } from '../src/map'

/**
 * **3단계 주장의 성질 테스트입니다.**
 *
 * > 매핑은 구조 변경을 몰라도 된다.
 *
 * 이 주장은 원래 손으로 고른 예시 여덟 개에만 기대고 있었습니다.
 * 1단계의 씨앗 200개짜리 생성기는 `insert: 'x'.repeat(n)` 만 만들어서
 * **구조 변경을 한 번도 생성하지 않습니다.** 1단계 주장은 성질로 세우고
 * 3단계 주장은 예시로 세운 셈이라, 강도가 맞지 않았습니다.
 *
 * ## 오라클 — 토큰마다 신분증
 *
 * 1단계는 문단 하나의 텍스트를 id 배열로 뒀습니다. 여기서는 **문서 전체를
 * 토큰 열**로 둡니다. 문단의 여닫는 지점도 토큰 하나씩 먹으므로 —
 *
 * ```
 * [P("ab")]  →  [ <p>, a, b, </p> ]     길이 4 = docSize
 *
 * 위치 p 는 "p 번째 토큰 앞의 틈" 입니다.
 * ```
 *
 * ## 오라클이 순환하지 않게 하는 장치
 *
 * 처음 판은 오라클이 `insertSize` 를 불러 자리를 비웠습니다. 그러면
 * **`insertSize` 가 틀려도 오라클이 똑같이 틀려서 서로 맞아 떨어집니다.**
 * 경계 비용을 2 대신 1 로 고장 내 보니 이 테스트가 그대로 통과했습니다.
 *
 * 그래서 매 씨앗마다 **오라클의 결과 길이를 `docSize(applyChanges(...))`
 * 와 맞춰 봅니다.** 실제로 만들어진 문서가 정답지 노릇을 하므로,
 * `insertSize` 가 틀리면 오라클이 먼저 어긋납니다.
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

/** 조각 1~3 개. 조각이 둘 이상이면 경계를 만드는 변경입니다 */
function makeSlice(random: () => number): Slice {
  const count = 1 + Math.floor(random() * 3)
  const texts: string[] = []
  for (let i = 0; i < count; i += 1) {
    texts.push('xyz'.slice(0, Math.floor(random() * 4)))
  }
  return { texts }
}

/**
 * 글자를 넣을 수 있는 위치들 — 문단 사이의 틈은 빠집니다.
 *
 * `applyChanges` 가 문단 **안**의 위치만 받기 때문입니다. 매핑은 아무 위치나
 * 받지만, 여기서는 적용까지 같이 재려고 좁혔습니다.
 */
function textPositions(doc: Doc): number[] {
  const out: number[] = []
  let base = 0
  for (const p of doc) {
    for (let i = 0; i <= p.text.length; i += 1) out.push(base + 1 + i)
    base += p.text.length + 2
  }
  return out
}

interface Case {
  doc: Doc
  changes: ChangeSet
  /** 추적할 토큰의 원래 인덱스 (= 원래 위치) */
  tracked: number
}

/**
 * 정렬·비겹침 변경 목록. `mapPos` 는 이 전제 위에 서 있으므로 생성기가
 * 지켜야 합니다 — 전제를 깨는 입력으로 재면 구현이 아니라 전제를 잽니다.
 */
function makeCase(random: () => number): Case {
  const doc: Doc = Array.from({ length: 1 + Math.floor(random() * 3) }, () =>
    para('abcdef'.slice(0, Math.floor(random() * 7)))
  )

  const positions = textPositions(doc)
  const changes: Change[] = []

  let i = 0
  while (i < positions.length) {
    i += Math.floor(random() * 3)
    if (i >= positions.length) break

    const from = positions[i]
    const j = Math.min(i + Math.floor(random() * 4), positions.length - 1)
    const to = positions[j]

    changes.push({ from, to, insert: makeSlice(random) })
    i = j + 1
  }

  // 지워지는 구간 **밖**만 추적합니다 — 안은 정보가 사라지는 자리입니다
  const safe: number[] = []
  for (let t = 0; t <= docSize(doc); t += 1) {
    if (!changes.some((c) => t >= c.from && t < c.to)) safe.push(t)
  }

  return {
    doc,
    changes,
    tracked: safe[Math.floor(random() * safe.length)] ?? 0,
  }
}

/** 토큰 id 배열에 변경을 적용합니다. 반환은 새 배열 */
function oracleTokens(c: Case): number[] {
  const ids: number[] = Array.from({ length: docSize(c.doc) }, (_, i) => i)

  // 뒤에서부터 적용해야 앞쪽 좌표가 유효합니다
  for (let i = c.changes.length - 1; i >= 0; i -= 1) {
    const { from, to, insert } = c.changes[i]
    const made = Array.from({ length: insertSize(insert) }, () => -1)
    ids.splice(from, to - from, ...made)
  }

  return ids
}

const SEEDS = 300

describe('매핑 성질 — 구조 변경까지', () => {
  it(`추적한 토큰의 실제 위치와 mapPos 가 일치해야 함 (${SEEDS}회)`, () => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const c = makeCase(rng(seed))
      const label = `seed=${seed} tracked=${c.tracked} doc=${JSON.stringify(
        c.doc.map((p) => p.text)
      )} changes=${JSON.stringify(c.changes)}`

      const ids = oracleTokens(c)

      /*
       * **순환 방지.** 오라클도 `insertSize` 를 쓰므로, 실제로 만들어진
       * 문서와 길이를 맞춰 봐야 둘이 함께 틀리는 것을 잡습니다.
       */
      expect(ids.length, `${label} — 오라클이 실제 문서와 다릅니다`).toBe(
        docSize(applyChanges(c.doc, c.changes))
      )

      const expected =
        c.tracked === docSize(c.doc) ? ids.length : ids.indexOf(c.tracked)

      expect(mapPos(c.tracked, c.changes, 1), label).toBe(expected)
    }
  })

  /** 생성기가 실제로 경계를 만드는 변경을 내고 있는지 — 계기 점검 */
  it('생성한 변경의 상당수가 구조 변경이어야 함', () => {
    let structural = 0
    let total = 0

    for (let seed = 1; seed <= SEEDS; seed += 1) {
      for (const change of makeCase(rng(seed)).changes) {
        total += 1
        if (
          typeof change.insert !== 'string' &&
          change.insert.texts.length > 1
        ) {
          structural += 1
        }
      }
    }

    expect(total).toBeGreaterThan(300)
    expect(structural / total).toBeGreaterThan(0.5)
  })

  it('순서를 보존해야 함', () => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const c = makeCase(rng(seed))

      let previous = -1
      for (let pos = 0; pos <= docSize(c.doc); pos += 1) {
        const mapped = mapPos(pos, c.changes, 1)
        expect(mapped, `seed=${seed} pos=${pos}`).toBeGreaterThanOrEqual(
          previous
        )
        previous = mapped
      }
    }
  })

  /**
   * 매핑이 옳아도 **적용이 다른 좌표계를 쓰면** 아무 소용이 없습니다.
   * 문서 끝은 언제나 새 문서 끝으로 가야 합니다.
   */
  it(`문서 끝이 언제나 새 문서 끝으로 가야 함 (${SEEDS}회)`, () => {
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const c = makeCase(rng(seed))
      const after = applyChanges(c.doc, c.changes)

      expect(
        mapPos(docSize(c.doc), c.changes),
        `seed=${seed} changes=${JSON.stringify(c.changes)}`
      ).toBe(docSize(after))
    }
  })
})
