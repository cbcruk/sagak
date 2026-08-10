import { docSize, posOf, resolvePos, type Doc, type Mark } from './doc'

/**
 * ## 3단계에서 바꾼 것 — 그리고 왜 그것만 바꾸면 되는가
 *
 * 1단계 좌표계는 처음부터 **문단 경계도 위치를 먹는다**고 말했습니다
 * (`paraSize = 텍스트 길이 + 2`). 그런데 변경의 표현은 `insert: string`,
 * 즉 **글자만** 넣을 수 있었습니다.
 *
 * 그 어긋남이 구조 변경을 막고 있던 전부입니다. 좌표계는 문단 경계를
 * 가리킬 수 있는데 변경은 그걸 만들 수도 지울 수도 없었습니다.
 *
 * 그래서 `insert` 를 **경계를 품을 수 있는 조각열**로 바꿉니다.
 * `applyChanges` 와 읽기 단계는 다시 써야 했지만 **`mapPos` 는 한 줄도
 * 바뀌지 않았습니다** — 길이 산술이라 조각열의 크기만 알면 되기 때문입니다.
 * 씨앗 200개짜리 성질 테스트가 그대로 통과하는 것이 그 증거입니다.
 */

/**
 * 삽입할 내용 — 문단 경계로 나뉜 조각들.
 *
 * ```
 * texts: ['abc']        →  글자만. 1·2단계의 insert 와 같습니다
 * texts: ['a', 'b']     →  a 뒤에서 문단이 갈립니다 (Enter)
 * texts: ['']           →  아무것도 안 넣음. 범위만 지웁니다
 * ```
 *
 * ## 양끝은 열려 있습니다
 *
 * 첫 조각은 왼쪽 문단의 남은 부분에 **이어 붙고**, 마지막 조각은 오른쪽
 * 문단의 남은 부분에 이어 붙습니다. 가운데 조각들만 온전한 문단이 됩니다.
 *
 * ProseMirror 의 `Slice` 가 `openStart`/`openEnd` 깊이를 들고 다니는 이유가
 * 이것입니다 — "문단 안으로 녹아드는 내용" 과 "문단째로 들어가는 내용" 은
 * 다릅니다. 여기서는 항상 양끝이 열린 경우만 다룹니다. 편집으로 생기는
 * 변경은 대부분 그쪽이고, 붙여넣기까지 가면 깊이가 필요해집니다.
 */
export interface Slice {
  texts: string[]
}

/** 글자만 넣을 때는 문자열을 그대로 써도 됩니다 */
export type Insert = string | Slice

export function sliceOf(insert: Insert): Slice {
  return typeof insert === 'string' ? { texts: [insert] } : insert
}

/**
 * 삽입될 내용이 차지하는 **위치 수**.
 *
 * 경계 하나는 닫는 토큰 + 여는 토큰 = 2 를 먹습니다. 조각이 n 개면
 * 경계는 n-1 개입니다.
 */
export function insertSize(insert: Insert): number {
  const { texts } = sliceOf(insert)
  let size = 2 * (texts.length - 1)
  for (const text of texts) size += text.length
  return size
}

/** 문단을 가르는 변경의 내용 — 앞뒤로 아무것도 안 넣고 경계만 하나 */
export const SPLIT: Slice = { texts: ['', ''] }

/**
 * 변경 하나 — `from`~`to` 를 지우고 그 자리에 `insert` 를 넣습니다.
 *
 * 좌표는 **변경 전 문서**의 위치입니다. 이게 매핑이 필요한 이유의 전부
 * 입니다 — 변경을 적용하고 나면 이 좌표들이 더는 안 맞습니다.
 */
export interface Change {
  from: number
  to: number
  insert: Insert
}

/**
 * 변경 목록. **정렬돼 있고 서로 겹치지 않아야 합니다.**
 *
 * 이 전제를 깨면 `mapPos` 가 조용히 틀립니다. 스파이크에서는 생성기가
 * 지키도록 하고, 실제 구현이라면 생성 시점에 강제해야 합니다.
 */
export type ChangeSet = Change[]

/**
 * 변경을 적용해 **새 문서**를 만듭니다.
 *
 * 문단을 가로지르는 범위도 처리합니다. 범위가 문단 `i` 의 `offA` 에서
 * 문단 `j` 의 `offB` 까지라면 —
 *
 * ```
 * [ …앞 문단들 ]  P(pre + texts[0])  P(texts[1]) … P(texts[n-2])  P(texts[n-1] + post)  [ 뒤 문단들 ]
 *                  ↑ 왼쪽에 녹아듦                                  ↑ 오른쪽에 녹아듦
 * ```
 *
 * `pre` 는 문단 `i` 의 `offA` 앞, `post` 는 문단 `j` 의 `offB` 뒤입니다.
 * 조각이 하나뿐이면 두 문단이 하나로 합쳐집니다 — 그게 Backspace 병합입니다.
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
    if (start.index > end.index) {
      throw new Error(`뒤집힌 범위입니다: ${from}..${to}`)
    }

    const { texts } = sliceOf(insert)
    const head = next[start.index]
    const tail = next[end.index]

    // 한 문단 안에서 글자만 바뀌는 경우 — 1·2단계와 같은 길
    if (start.index === end.index && texts.length === 1) {
      head.text =
        head.text.slice(0, start.offset) +
        texts[0] +
        head.text.slice(end.offset)
      head.marks = mapMarks(
        head.marks,
        start.offset,
        end.offset,
        texts[0].length
      )
      continue
    }

    const pre = head.text.slice(0, start.offset)
    const post = tail.text.slice(end.offset)

    /*
     * 마크는 **지워지는 범위 밖만** 살립니다.
     *
     * 구조 변경은 마크 구간을 문단째로 찢을 수 있어서, 정확히 옮기려면
     * 마크도 조각열로 들고 다녀야 합니다 (ProseMirror 의 Slice 가 실제로
     * 그렇습니다). 이 스파이크가 배우려는 것은 위치 쪽이라 잘랐습니다.
     */
    const headMarks = head.marks
      .filter((m) => m.to <= start.offset)
      .map((m) => ({ ...m }))
    const tailMarks = tail.marks
      .filter((m) => m.from >= end.offset)
      .map((m) => ({
        ...m,
        from: m.from - end.offset + texts[texts.length - 1].length,
        to: m.to - end.offset + texts[texts.length - 1].length,
      }))

    const made =
      texts.length === 1
        ? [{ text: pre + texts[0] + post, marks: [...headMarks, ...tailMarks] }]
        : [
            { text: pre + texts[0], marks: headMarks },
            ...texts
              .slice(1, -1)
              .map((text) => ({ text, marks: [] as Mark[] })),
            { text: texts[texts.length - 1] + post, marks: tailMarks },
          ]

    // 마지막 조각의 마크는 pre 가 아니라 조각 시작 기준이라 그대로입니다
    next.splice(start.index, end.index - start.index + 1, ...made)
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
