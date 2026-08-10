import { posOf, type Doc } from './doc'
import type { Change, ChangeSet, Slice } from './change'
import { paragraphText, paragraphs } from './view'

/**
 * "브라우저가 무엇을 했는가" 를 읽어 변경 목록으로 바꿉니다.
 *
 * 화살표를 뒤집는다는 건 결국 이 함수입니다. 입력을 가로채 모델만 고치는
 * 대신, **브라우저가 이미 저지른 일을 사후에 읽습니다.** ProseMirror 의
 * `readDOMChange` 가 하는 일의 뼈대만 남긴 것입니다.
 *
 * ## 두 겹으로 깎습니다
 *
 * 1. **문단 단위** — 앞뒤로 그대로인 문단들을 걷어냅니다
 * 2. **글자 단위** — 남은 구간의 머리와 꼬리에서 공통 글자를 더 깎습니다
 *
 * 2번이 없으면 문단이 하나라도 달라지는 순간 변경이 통째로 커집니다.
 * 텍스트는 그래도 맞지만 **커서 예측이 무너집니다** — `mapPos` 의 ③번
 * (지워진 구간 안은 경계로 접힘)에 걸리기 때문입니다.
 *
 * 예를 들어 두 문단을 Backspace 로 합칠 때 —
 *
 * ```
 * 깎기 전:  1..7 을 지우고 "abcd" 삽입   → 커서 예측 5, 실제 3   ✗
 * 깎은 뒤:  3..5 를 지우고 아무것도 안 넣음 → 커서 예측 3, 실제 3   ✓
 * ```
 *
 * 깎은 쪽은 **경계 토큰 두 개만 지웁니다.** 그게 "문단을 합친다" 의
 * 정확한 표현입니다.
 */

/**
 * `<p>` 가 아닌 자식이 생겼습니다.
 *
 * 브라우저가 우리가 모르는 구조를 만든 경우입니다. 그냥 무시하면 그 안의
 * 글자가 조용히 사라지므로 눈에 보이게 실패합니다.
 */
export class UnexpectedDom extends Error {
  constructor(readonly tag: string) {
    super(`<p> 가 아닌 자식이 있습니다: <${tag.toLowerCase()}>`)
    this.name = 'UnexpectedDom'
  }
}

/**
 * 문자열 둘의 차이를 변경 하나로 — 한 문단 안에서만.
 *
 * ## 문자열만으로는 애매합니다
 *
 * `"aaa"` → `"aaaa"` 에서 사람이 어디에 쳤는지는 **문자열만 봐서는 알 수
 * 없습니다.** 앞뒤 어디에 넣어도 결과가 같기 때문입니다. 앞뒤 공통 부분을
 * 깎는 방식은 뒤쪽으로 몰고, 그러면 텍스트는 맞는데 **커서 예측만 조용히
 * 틀립니다.**
 *
 * 2단계에서는 재 두기만 하고 넘어갔는데, 3단계의 무작위 편집 열이 이걸
 * 40번 안에 세 씨앗 중 둘에서 잡아냈습니다. 드문 일이 아니었습니다.
 *
 * ## 보정 — 브라우저에게 물어봅니다
 *
 * `caret` 은 **편집 직후 브라우저가 실제로 커서를 둔 자리**입니다. 문자열이
 * 말해 주지 않는 것을 브라우저는 알고 있습니다.
 *
 * 순수 삽입이라면 삽입이 끝나는 자리가 곧 커서여야 합니다. 안 맞으면 창을
 * 왼쪽으로 밀되, **밀어도 같은 결과가 되는 동안만** 밉니다. 순수 삭제는
 * 오른쪽으로 같은 논리입니다.
 *
 * ProseMirror 가 `readDOMChange` 에서 선택 위치를 진단에 섞는 것이 이것
 * 입니다.
 *
 * @param base 이 문단의 첫 글자가 놓인 **문서 위치**
 * @param caret 편집 직후의 문서 위치. 없으면 보정하지 않습니다
 */
export function diffText(
  before: string,
  after: string,
  base: number,
  caret?: number
): Change | null {
  let start = commonPrefix(before, after)

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

  // 커서가 이 문단 안에 있을 때만 근거로 씁니다
  if (caret !== undefined && caret >= base && caret <= base + after.length) {
    /*
     * **순수 삽입** — 넣은 글자의 끝이 곧 커서여야 합니다.
     *
     * 한 칸 미는 것이 결과를 바꾸지 않는 동안만 밉니다. 앞뒤 공통 부분을
     * 깎는 방식은 삽입을 오른쪽 끝까지 밀어 두므로 보통 왼쪽으로 옵니다.
     */
    while (beforeEnd === start && base + afterEnd !== caret) {
      if (
        base + afterEnd > caret &&
        start > 0 &&
        before[start - 1] === after[afterEnd - 1]
      ) {
        start -= 1
        beforeEnd -= 1
        afterEnd -= 1
      } else if (
        base + afterEnd < caret &&
        afterEnd < after.length &&
        after[start] === after[afterEnd]
      ) {
        start += 1
        beforeEnd += 1
        afterEnd += 1
      } else {
        break
      }
    }

    /*
     * **순수 삭제** — 지운 자리가 곧 커서입니다.
     *
     * Backspace 든 Delete 든 끝나고 나면 커서는 `from` 에 있습니다.
     * 방향을 하나만 다루면 절반을 놓칩니다 — 무작위 편집 열이 그걸
     * 씨앗 1 의 23번째 걸음에서 잡아냈습니다.
     */
    while (afterEnd === start && base + start !== caret) {
      if (
        base + start < caret &&
        beforeEnd < before.length &&
        before[start] === before[beforeEnd]
      ) {
        start += 1
        beforeEnd += 1
        afterEnd += 1
      } else if (
        base + start > caret &&
        start > 0 &&
        before[start - 1] === before[beforeEnd - 1]
      ) {
        start -= 1
        beforeEnd -= 1
        afterEnd -= 1
      } else {
        break
      }
    }
  }

  return {
    from: base + start,
    to: base + beforeEnd,
    insert: after.slice(start, afterEnd),
  }
}

function commonPrefix(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  return i
}

function commonSuffix(a: string, b: string): number {
  let i = 0
  while (
    i < a.length &&
    i < b.length &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) {
    i += 1
  }
  return i
}

/**
 * DOM 의 현재 모습과 모델을 비교해 변경 목록을 만듭니다.
 *
 * 좌표는 **변경 전** — 즉 모델 — 기준입니다. `mapPos` 와 `applyChanges` 가
 * 둘 다 그 전제 위에 서 있습니다.
 *
 * @param caret 편집 직후 브라우저가 커서를 둔 문서 위치 — 진단 보정에 씁니다
 * @throws {UnexpectedDom} `<p>` 가 아닌 자식이 있는 경우
 */
export function readChanges(
  root: HTMLElement,
  doc: Doc,
  caret?: number
): ChangeSet {
  const stray = Array.from(root.children).find((el) => el.tagName !== 'P')
  if (stray) throw new UnexpectedDom(stray.tagName)

  return diffParagraphs(doc, paragraphs(root).map(paragraphText), caret)
}

/**
 * 진단의 알맹이 — DOM 없이 문단 텍스트 배열만 봅니다.
 *
 * DOM 을 떼어 놓은 이유는 노드에서 잴 수 있게 하기 위해서입니다. 브라우저를
 * 띄우는 테스트는 느리고, 느린 테스트는 안 돌리게 됩니다.
 */
export function diffParagraphs(
  doc: Doc,
  dom: string[],
  caret?: number
): ChangeSet {
  const model = doc.map((p) => p.text)

  let a = 0
  while (a < model.length && a < dom.length && model[a] === dom[a]) a += 1

  let mEnd = model.length
  let dEnd = dom.length
  while (mEnd > a && dEnd > a && model[mEnd - 1] === dom[dEnd - 1]) {
    mEnd -= 1
    dEnd -= 1
  }

  if (a === mEnd && a === dEnd) return []

  /*
   * 어느 한쪽 구간이 비면 이웃 문단 하나를 끌어옵니다.
   *
   * 빈 구간은 좌표를 **문단 사이의 틈**에 놓게 되는데, 양끝이 열린
   * 조각열로는 그 자리를 표현할 수 없습니다 (녹아들 문단이 없습니다).
   * 끌어오는 문단은 양쪽이 똑같으므로 결과는 달라지지 않습니다.
   */
  if (a === mEnd || a === dEnd) {
    if (a > 0) {
      a -= 1
    } else {
      mEnd += 1
      dEnd += 1
    }
  }

  const before = model.slice(a, mEnd)
  const after = dom.slice(a, dEnd)

  // 문단 하나 안의 글자 변화 — 2단계와 같은 길
  if (before.length === 1 && after.length === 1) {
    const change = diffText(before[0], after[0], posOf(doc, a, 0), caret)
    return change ? [change] : []
  }

  return [structuralChange(doc, a, mEnd, before, after)]
}

/**
 * 구조가 달라진 구간을 변경 하나로. 머리와 꼬리에서 공통 글자를 깎습니다.
 *
 * 깎기는 **겹치면 안 됩니다.** 머리와 꼬리가 같은 문자열을 가리키는 경우가
 * 있어서 (`before` 나 `after` 가 한 조각뿐일 때) 남은 길이만큼만 깎습니다.
 */
function structuralChange(
  doc: Doc,
  a: number,
  mEnd: number,
  before: string[],
  after: string[]
): Change {
  const firstBefore = before[0]
  const lastBefore = before[before.length - 1]
  const firstAfter = after[0]
  const lastAfter = after[after.length - 1]

  const head = Math.min(
    commonPrefix(firstBefore, firstAfter),
    firstBefore.length,
    firstAfter.length
  )

  const beforeLeft = lastBefore.length - (before.length === 1 ? head : 0)
  const afterLeft = lastAfter.length - (after.length === 1 ? head : 0)
  const tail = Math.min(
    commonSuffix(lastBefore, lastAfter),
    beforeLeft,
    afterLeft
  )

  const texts = [...after]
  if (texts.length === 1) {
    texts[0] = texts[0].slice(head, texts[0].length - tail)
  } else {
    texts[0] = texts[0].slice(head)
    texts[texts.length - 1] = texts[texts.length - 1].slice(
      0,
      texts[texts.length - 1].length - tail
    )
  }

  const insert: Slice = { texts }

  return {
    from: posOf(doc, a, head),
    to: posOf(doc, mEnd - 1, lastBefore.length - tail),
    insert,
  }
}
