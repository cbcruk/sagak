import { describe, it, expect } from 'vitest'
import { para, debugString, docSize, type Doc } from '../src/doc'
import { applyChanges, type ChangeSet } from '../src/change'
import { mapPos } from '../src/map'

/**
 * **이 스파이크의 성공 기준입니다.**
 *
 * 목표는 "에디터가 돌아감" 이 아니라 *이 실패를 겪는 것* 입니다 —
 * 불변 문서를 택하는 순간 위치 매핑이 선택이 아니라 의무가 된다는 것.
 *
 * `reference-codemirror-state.md` 가 문장으로 적어 둔
 * *"불변이라는 선택이 매핑·구조적 공유라는 다음 선택을 강제한다"* 를
 * 여기서 손으로 확인합니다.
 */
describe('왜 매핑이 필요한가', () => {
  /*
   * 0     1  2  3  4  5  6  7  8  9  10 11 12
   * <p>   h  e  l  l  o  ␣  w  o  r  l  d  </p>
   */
  const doc: Doc = [para('hello world')]

  /** "hello"(위치 1..6) 를 "hi" 로 바꿉니다 */
  const edit1: ChangeSet = [{ from: 1, to: 6, insert: 'hi' }]

  /**
   * 위치는 **글자가 아니라 글자 사이의 틈**입니다. 문단 하나짜리 문서에서
   * 문서 위치 `p` 는 텍스트 오프셋 `p - 1` 의 틈이므로 —
   */
  const charAfter = (d: Doc, pos: number): string | undefined =>
    d[0].text[pos - 1]
  const charBefore = (d: Doc, pos: number): string | undefined =>
    d[0].text[pos - 2]

  /** 원래 문서에서 `w` 바로 앞은 위치 7 입니다 */
  const beforeW = 7

  it('전제 확인 — 원래 문서에서 위치 7 은 w 앞입니다', () => {
    expect(docSize(doc)).toBe(13)
    expect(charAfter(doc, beforeW)).toBe('w')
    expect(charBefore(doc, beforeW)).toBe(' ')
  })

  it('매핑하지 않으면 엉뚱한 자리에 들어갑니다', () => {
    const after = applyChanges(doc, edit1)
    expect(debugString(after)).toBe('<p>hi world</p>')

    // 원래 좌표를 그대로 씁니다 — 흔히 저지르는 실수
    const wrong = applyChanges(after, [
      { from: beforeW, to: beforeW, insert: 'big ' },
    ])

    expect(debugString(wrong)).toBe('<p>hi worbig ld</p>')
    expect(debugString(wrong)).not.toContain('big world')
  })

  it('매핑하면 의도한 자리에 들어갑니다', () => {
    const after = applyChanges(doc, edit1)

    // 변경 전 좌표를 변경 후 좌표로 옮깁니다
    const mapped = mapPos(beforeW, edit1)
    expect(mapped).toBe(4)

    const right = applyChanges(after, [
      { from: mapped, to: mapped, insert: 'big ' },
    ])

    expect(debugString(right)).toBe('<p>hi big world</p>')
  })

  /**
   * 커서도 같은 문제를 겪습니다. 남이 내 앞을 고치면 내 커서는 움직여야
   * 하는데, 그 계산이 곧 `mapPos` 입니다.
   */
  it('커서도 같은 계산으로 따라갑니다', () => {
    const cursor = 12 // "world" 의 d 뒤 (문단 안의 끝)
    expect(charBefore(doc, cursor)).toBe('d')

    const after = applyChanges(doc, edit1)
    const moved = mapPos(cursor, edit1)

    expect(moved).toBe(9)
    expect(charBefore(after, moved)).toBe('d')
  })
})
