import { docSize, posOf, resolvePos, type Doc, type Mark } from './doc'

/**
 * 변경 하나 — `from`~`to` 를 지우고 그 자리에 `insert` 를 넣습니다.
 *
 * 좌표는 **변경 전 문서**의 위치입니다. 이게 매핑이 필요한 이유의 전부
 * 입니다 — 변경을 적용하고 나면 이 좌표들이 더는 안 맞습니다.
 */
export interface Change {
  from: number
  to: number
  insert: string
}

/**
 * 변경 목록. **정렬돼 있고 서로 겹치지 않아야 합니다.**
 *
 * 이 전제를 깨면 `mapPos` 가 조용히 틀립니다. 스파이크에서는 생성기가
 * 지키도록 하고, 실제 구현이라면 생성 시점에 강제해야 합니다.
 */
export type ChangeSet = Change[]

/**
 * ## 이 스파이크가 하지 않는 것
 *
 * 변경은 **한 문단 안에서만** 일어난다고 봅니다. 문단을 가로지르는 삭제는
 * 두 문단을 합치는 구조 변경이고, 그건 다음 단계의 주제입니다. 여기서
 * 배우려는 것은 위치 매핑 하나이므로 범위를 잘랐습니다.
 */
export function applyChanges(doc: Doc, changes: ChangeSet): Doc {
  const next: Doc = doc.map((p) => ({ text: p.text, marks: [...p.marks] }))

  // 뒤에서부터 적용해야 앞쪽 좌표가 그대로 유효합니다
  for (let i = changes.length - 1; i >= 0; i -= 1) {
    const { from, to, insert } = changes[i]
    const start = resolvePos(doc, from)
    const end = resolvePos(doc, to)

    if (!start || !end) {
      throw new Error(`문단 밖 위치입니다: ${from}..${to}`)
    }
    if (start.index !== end.index) {
      throw new Error('문단을 가로지르는 변경은 이 스파이크의 범위 밖입니다')
    }

    const p = next[start.index]
    p.text = p.text.slice(0, start.offset) + insert + p.text.slice(end.offset)
    p.marks = mapMarks(p.marks, start.offset, end.offset, insert.length)
  }

  return next
}

/**
 * 마크 구간도 같은 방식으로 따라갑니다.
 *
 * **선택 영역과 마크가 같은 연산 위에 올라탄다** 는 것이 요점입니다.
 * 매핑이 하나 있으면 그 위에 얹히는 것은 전부 공짜로 따라옵니다.
 */
function mapMarks(
  marks: Mark[],
  from: number,
  to: number,
  inserted: number
): Mark[] {
  const diff = inserted - (to - from)

  return marks
    .map((m) => ({
      ...m,
      from: shiftOffset(m.from, from, to, inserted, diff),
      to: shiftOffset(m.to, from, to, inserted, diff),
    }))
    .filter((m) => m.to > m.from)
}

function shiftOffset(
  offset: number,
  from: number,
  to: number,
  inserted: number,
  diff: number
): number {
  if (offset <= from) return offset
  if (offset >= to) return offset + diff
  // 지워진 구간 안이면 시작으로 접습니다
  return from + Math.min(offset - from, inserted)
}

/** 문서 크기를 넘지 않는지 확인합니다 — 생성기 검증용 */
export function isWithinDoc(doc: Doc, change: Change): boolean {
  return (
    change.from >= 0 && change.to <= docSize(doc) && change.from <= change.to
  )
}

export { posOf }
