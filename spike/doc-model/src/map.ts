import { insertSize, type ChangeSet } from './change'

/**
 * 위치가 삽입 지점에 **정확히 걸쳤을 때** 어느 쪽에 붙을지.
 *
 * - `1`  삽입된 글자 **뒤** — 타이핑하는 커서가 원하는 것
 * - `-1` 삽입된 글자 **앞** — 앞에 고정된 표식이 원하는 것
 *
 * 이 인자를 빼면 매핑이 "돌아가는데" 틀린 교훈을 줍니다. 커서는 대체로
 * 뒤에 붙어야 하고, 마크의 시작 경계는 앞에 붙어야 합니다. 둘을 같은 값으로
 * 두면 협업이나 IME 에서 커서가 튀는 이유를 영영 모르게 됩니다.
 *
 * `reference-codemirror-state.md` §5 가 `assoc` 을 "매핑 API 설계 시 필수
 * 파라미터" 라고 적어 둔 것이 이것입니다.
 */
export type Assoc = 1 | -1

/**
 * 변경 전 위치를 변경 후 위치로 옮깁니다.
 *
 * ## 세 가지 경우
 *
 * ```
 * 변경:  from ───── to  →  insert
 *
 * ① pos 가 to 보다 뒤        전체가 diff 만큼 밀립니다
 * ② pos 가 from === to 위     순수 삽입 지점 — assoc 이 결정합니다
 * ③ pos 가 from..to 사이      지워진 자리 — 경계로 접습니다
 * ```
 *
 * ③ 이 정보를 잃는 유일한 곳입니다. 지워진 글자를 가리키던 위치는 갈 곳이
 * 없으므로 경계로 보냅니다. 협업 편집에서 "상대가 내가 보던 자리를 지웠을 때"
 * 가 정확히 이 경우입니다.
 *
 * ## 3단계를 지나고도 이 함수는 그대로입니다
 *
 * 구조 변경(문단 나누기·합치기)을 넣으면서 `applyChanges` 와 읽기 단계는
 * 다시 썼는데, 여기는 `insert.length` 를 `insertSize(insert)` 로 바꾼 것이
 * 전부입니다. **길이 산술이라 무엇이 들어가는지는 알 필요가 없습니다.**
 *
 * 좌표계가 처음부터 문단 경계를 위치로 세고 있었기 때문입니다
 * (`paraSize = 텍스트 길이 + 2`). 경계를 만드는 편집은 그 좌표계 안에서
 * 그냥 "2 만큼 늘어나는 변경" 입니다.
 *
 * @param changes **변경 전 좌표** 기준, 정렬·비겹침
 */
export function mapPos(
  pos: number,
  changes: ChangeSet,
  assoc: Assoc = 1
): number {
  let shift = 0

  for (const { from, to, insert } of changes) {
    // 정렬돼 있으므로 이 뒤의 변경은 pos 에 영향을 주지 않습니다
    if (from > pos) break

    const inserted = insertSize(insert)
    const deleted = to - from

    // ① 변경이 통째로 앞에 있음
    if (to < pos) {
      shift += inserted - deleted
      continue
    }

    // ② 순수 삽입 지점에 정확히 걸침
    if (from === to) {
      if (assoc > 0) shift += inserted
      continue
    }

    // ③ 지워지는 구간과 겹침 — 경계로 접습니다
    return assoc < 0 ? from + shift : from + shift + inserted
  }

  return pos + shift
}

/**
 * 선택 영역도 위치 둘일 뿐입니다.
 *
 * **매핑이 하나 있으면 그 위에 얹히는 것은 전부 따라옵니다** — 커서, 선택
 * 영역, 마크 구간, 협업 커서, 주석 앵커. 반대로 매핑이 없으면 그 전부를
 * 각자 고쳐야 하고, 그게 지금 sagak 이 `selectionManager.saveSelection()` /
 * `restoreSelection()` 으로 하고 있는 일입니다.
 */
export interface Selection {
  anchor: number
  head: number
}

export function mapSelection(
  selection: Selection,
  changes: ChangeSet
): Selection {
  return {
    anchor: mapPos(selection.anchor, changes, 1),
    head: mapPos(selection.head, changes, 1),
  }
}
