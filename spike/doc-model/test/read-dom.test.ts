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

  /**
   * ## 보정 — 브라우저에게 물어봅니다
   *
   * 문자열이 말해 주지 않는 것을 브라우저는 압니다. 편집 직후 커서가 어디
   * 있는지가 곧 "어디에 쳤는가" 의 답입니다.
   *
   * 밀 때는 **밀어도 같은 결과가 되는 동안만** 밉니다. 그래서 보정은
   * 텍스트를 바꾸지 않습니다 — 커서만 맞춥니다.
   *
   * 3단계의 무작위 편집 열이 이 보정을 요구했습니다. 씨앗 셋 중 둘이
   * 40번 안에 어긋났으니 드문 일이 아니었습니다.
   */
  describe('커서로 진단을 보정합니다', () => {
    describe('삽입', () => {
      it('맨 앞에 쳤다면 커서가 2 에 있습니다', () => {
        expect(diffText('aaa', 'aaaa', base, 2)).toEqual({
          from: 1,
          to: 1,
          insert: 'a',
        })
      })

      it('가운데에 쳤다면 3 에', () => {
        expect(diffText('aaa', 'aaaa', base, 3)).toEqual({
          from: 2,
          to: 2,
          insert: 'a',
        })
      })

      it('맨 뒤에 쳤다면 5 에 — 보정 없이도 같은 답', () => {
        expect(diffText('aaa', 'aaaa', base, 5)).toEqual({
          from: 4,
          to: 4,
          insert: 'a',
        })
      })
    })

    /**
     * Backspace 든 Delete 든 끝나고 나면 커서는 `from` 에 있습니다.
     * 방향을 하나만 다루면 절반을 놓칩니다.
     */
    describe('삭제', () => {
      it('앞쪽을 지웠다면 커서가 1 에', () => {
        expect(diffText('aaa', 'aa', base, 1)).toEqual({
          from: 1,
          to: 2,
          insert: '',
        })
      })

      it('뒤쪽을 지웠다면 3 에', () => {
        expect(diffText('aaa', 'aa', base, 3)).toEqual({
          from: 3,
          to: 4,
          insert: '',
        })
      })
    })

    it('보정해도 결과 텍스트는 바뀌지 않습니다', () => {
      for (const caret of [1, 2, 3, 4, 5]) {
        const change = diffText('aaa', 'aaaa', base, caret)
        if (!change) throw new Error('변경이 있어야 합니다')

        const at = change.from - base
        const to = change.to - base
        expect('aaa'.slice(0, at) + change.insert + 'aaa'.slice(to)).toBe(
          'aaaa'
        )
      }
    })

    it('커서가 이 문단 밖이면 보정하지 않습니다', () => {
      // 아주 먼 위치 — 다른 문단의 커서입니다
      expect(diffText('aaa', 'aaaa', base, 99)).toEqual({
        from: 4,
        to: 4,
        insert: 'a',
      })
    })
  })
})
