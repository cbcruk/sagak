import { describe, it, expect } from 'vitest'
import { diffText } from '../src/read-dom'

/**
 * "브라우저가 무엇을 했는가" 를 문자열 둘의 차이로 되짚습니다.
 *
 * DOM 이 필요 없는 부분이라 노드에서 돕니다 — 브라우저를 띄우는 테스트는
 * 느리고, 느린 테스트는 안 돌리게 됩니다.
 */
describe('진단 — 무엇이 바뀌었는가', () => {
  /** 문단 하나짜리 문서에서 첫 글자의 문서 위치 */
  const base = 1

  it('삽입', () => {
    expect(diffText('ab', 'aXb', base)).toEqual({
      from: 2,
      to: 2,
      insert: 'X',
    })
  })

  it('삭제', () => {
    expect(diffText('abcd', 'ad', base)).toEqual({
      from: 2,
      to: 4,
      insert: '',
    })
  })

  it('치환', () => {
    expect(diffText('hello', 'hi', base)).toEqual({
      from: 2,
      to: 6,
      insert: 'i',
    })
  })

  it('변화가 없으면 null', () => {
    expect(diffText('abc', 'abc', base)).toBeNull()
  })

  it('앞뒤 공통 부분은 깎아냅니다', () => {
    // "가나다라" → "가라": 가운데 "나다" 만 사라졌습니다
    expect(diffText('가나다라', '가라', base)).toEqual({
      from: 2,
      to: 4,
      insert: '',
    })
  })

  it('문단이 뒤에 있으면 base 만큼 밀립니다', () => {
    // 앞 문단이 "ab" 라면 두 번째 문단의 첫 글자는 위치 5
    expect(diffText('xy', 'xZy', 5)).toEqual({ from: 6, to: 6, insert: 'Z' })
  })

  /**
   * ## 이 진단이 못 하는 것
   *
   * 같은 글자가 이어지면 **어디에 쳤는지 문자열만 봐서는 알 수 없습니다.**
   * `"aaa"` 의 어느 자리에 `a` 를 넣어도 결과가 `"aaaa"` 로 같기 때문입니다.
   *
   * 텍스트는 어느 쪽으로 진단해도 맞습니다. 틀리는 것은 **커서 예측**뿐
   * 입니다 — 그래서 조용합니다. ProseMirror 는 이때 브라우저가 보고한
   * 선택 위치로 진단을 보정합니다.
   *
   * `reconcile.browser.test.ts` 에서 실제로 어긋나는 것을 잽니다.
   */
  it('같은 글자가 이어지면 어디에 쳤는지 알 수 없습니다', () => {
    const change = diffText('aaa', 'aaaa', base)

    // 뒤쪽으로 진단합니다. 앞에 쳤더라도 이렇게 나옵니다.
    expect(change).toEqual({ from: 4, to: 4, insert: 'a' })
  })
})
