import type { Doc } from './doc'
import type { Change, ChangeSet } from './change'
import { paragraphText, paragraphs } from './view'

/**
 * "브라우저가 무엇을 했는가" 를 읽어 변경 목록으로 바꿉니다.
 *
 * 화살표를 뒤집는다는 건 결국 이 함수입니다. 입력을 가로채 모델만 고치는
 * 대신, **브라우저가 이미 저지른 일을 사후에 읽습니다.** ProseMirror 의
 * `readDOMChange` 가 하는 일의 뼈대만 남긴 것입니다.
 */

/**
 * 문단 수가 달라진 편집 — Enter, 문단을 가로지르는 삭제, 붙여넣기.
 *
 * 1단계가 "하지 않는 것" 으로 미뤄 둔 구조 변경이 여기서 실제로 부딪힙니다.
 * `applyChanges` 는 문단 안의 편집만 표현할 수 있으므로 읽기 단계에서
 * 거부하는 편이 낫습니다 — 아니면 모델과 DOM 이 조용히 갈라집니다.
 */
export class StructuralChange extends Error {
  constructor(
    readonly before: number,
    readonly after: number
  ) {
    super(`문단 수가 ${before} → ${after} 로 바뀌었습니다`)
    this.name = 'StructuralChange'
  }
}

/**
 * 문자열 둘의 차이를 변경 하나로.
 *
 * 앞뒤 공통 부분을 깎아내고 남는 가운데를 바꿉니다.
 *
 * ## 이 진단은 애매할 수 있습니다
 *
 * `"aaa"` → `"aaaa"` 에서 사람이 어디에 쳤는지는 **문자열만 봐서는 알 수
 * 없습니다.** 앞뒤 어디에 넣어도 결과가 같기 때문입니다. 여기서는 뒤쪽으로
 * 몰리고, 그래서 커서 예측이 실제와 어긋날 수 있습니다.
 *
 * ProseMirror 는 이때 **브라우저가 보고한 선택 위치로 진단을 보정**합니다.
 * 그 보정이 왜 필요한지가 `test/read-dom.test.ts` 에 있습니다.
 *
 * @param base 이 문단의 첫 글자가 놓인 **문서 위치**
 */
export function diffText(
  before: string,
  after: string,
  base: number
): Change | null {
  let start = 0
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  ) {
    start += 1
  }

  let beforeEnd = before.length
  let afterEnd = after.length
  while (
    beforeEnd > start &&
    afterEnd > start &&
    before[beforeEnd - 1] === after[afterEnd - 1]
  ) {
    beforeEnd -= 1
    afterEnd -= 1
  }

  if (start === beforeEnd && start === afterEnd) return null

  return {
    from: base + start,
    to: base + beforeEnd,
    insert: after.slice(start, afterEnd),
  }
}

/**
 * DOM 의 현재 모습과 모델을 비교해 변경 목록을 만듭니다.
 *
 * 좌표는 **변경 전** — 즉 모델 — 기준입니다. `mapPos` 와 `applyChanges` 가
 * 둘 다 그 전제 위에 서 있습니다.
 *
 * @throws {StructuralChange} 문단 수가 달라진 경우
 */
export function readChanges(root: HTMLElement, doc: Doc): ChangeSet {
  const paras = paragraphs(root)

  if (paras.length !== doc.length) {
    throw new StructuralChange(doc.length, paras.length)
  }

  const changes: ChangeSet = []
  let base = 0

  for (let i = 0; i < doc.length; i += 1) {
    const change = diffText(doc[i].text, paragraphText(paras[i]), base + 1)
    if (change) changes.push(change)
    base += doc[i].text.length + 2
  }

  return changes
}
