/**
 * 문서 모델 — 문단 배열, 그리고 **문서 전체를 훑는 정수 위치**.
 *
 * ## 좌표계
 *
 * ProseMirror 와 같은 방식입니다. 위치는 문자 사이의 틈을 가리키고,
 * **문단의 여닫는 지점도 위치를 하나씩 먹습니다.**
 *
 * ```
 * doc = [P("ab"), P("cd")]
 *
 * 0     1  2  3     4     5  6  7     8
 * <p>   a  b  </p>  <p>   c  d  </p>
 * ```
 *
 * - `0` 문서 시작 (첫 문단 **밖**)
 * - `1` 첫 문단 **안**, `a` 앞
 * - `3` `b` 뒤, 첫 문단 안의 끝
 * - `4` 문단 사이 (양쪽 다 밖)
 * - `8` 문서 끝
 *
 * 그래서 문단 하나의 크기는 `텍스트 길이 + 2` 입니다.
 *
 * **왜 경계가 위치를 먹는가.** 처음엔 낭비처럼 보이지만, 이게 없으면
 * "문단 사이" 를 가리킬 방법이 사라집니다. 문단을 새로 넣거나 두 문단을
 * 합치는 편집은 전부 그 자리를 지목해야 합니다.
 */

/** 인라인 표시 — 텍스트 안의 구간에 걸립니다 */
export interface Mark {
  type: 'bold' | 'italic'
  /** 문단 안에서의 텍스트 오프셋 (문서 위치가 아닙니다) */
  from: number
  to: number
}

export interface Paragraph {
  text: string
  marks: Mark[]
}

export type Doc = Paragraph[]

export function para(text: string, marks: Mark[] = []): Paragraph {
  return { text, marks }
}

/** 문단 하나가 차지하는 위치 수 — 여는 토큰 + 텍스트 + 닫는 토큰 */
export function paraSize(p: Paragraph): number {
  return p.text.length + 2
}

/** 문서 전체 위치 수. 유효한 위치는 `0 … docSize(doc)` 입니다 */
export function docSize(doc: Doc): number {
  return doc.reduce((sum, p) => sum + paraSize(p), 0)
}

export interface Resolved {
  /** 몇 번째 문단인가 */
  index: number
  /** 그 문단 텍스트 안의 오프셋 */
  offset: number
}

/**
 * 문서 위치를 문단/오프셋으로 풉니다.
 *
 * 문단 **경계**(여닫는 토큰 자리)는 텍스트 안이 아니므로 `null` 입니다.
 * 이 구분이 중요합니다 — 글자를 넣을 수 있는 자리와 문단을 넣을 수 있는
 * 자리가 다릅니다.
 */
export function resolvePos(doc: Doc, pos: number): Resolved | null {
  if (pos < 0 || pos > docSize(doc)) return null

  let base = 0

  for (let index = 0; index < doc.length; index += 1) {
    const size = paraSize(doc[index])
    const inner = pos - base - 1 // 여는 토큰 하나를 지납니다

    if (inner >= 0 && inner <= doc[index].text.length) {
      return { index, offset: inner }
    }

    base += size
  }

  return null
}

/** 문단/오프셋을 문서 위치로 되돌립니다 */
export function posOf(doc: Doc, index: number, offset: number): number {
  let base = 0
  for (let i = 0; i < index; i += 1) base += paraSize(doc[i])
  return base + 1 + offset
}

/** 문서를 사람이 읽는 문자열로 — 테스트 실패를 알아볼 수 있게 */
export function debugString(doc: Doc): string {
  return doc.map((p) => `<p>${p.text}</p>`).join('')
}
