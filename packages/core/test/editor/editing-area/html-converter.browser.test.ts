import { describe, it, expect, beforeEach } from 'vitest'
import { HTMLConverter } from '@/editor/editing-area/converters/html-converter'

/**
 * HTMLConverter 테스트
 *
 * Why: HTML과 텍스트 간 변환, 이스케이프, 포맷팅 기능 검증
 * How: 각 변환 메서드별 입출력 테스트, 엣지 케이스 처리 확인
 */
describe('HTMLConverter', () => {
  let converter: HTMLConverter

  beforeEach(() => {
    converter = new HTMLConverter()
  })

  describe('htmlToText (HTML → 텍스트 변환)', () => {
    /**
     * Why: HTML 콘텐츠를 순수 텍스트로 추출해야 복사/붙여넣기, 검색 등에 활용 가능
     * How: `stripTags()`로 태그 제거 + `unescapeHTML()`로 엔티티 변환
     */

    it('간단한 HTML을 텍스트로 변환해야 함', () => {
      // Given: 단순 p 태그로 감싼 HTML
      const html = '<p>Hello World</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 태그가 제거된 순수 텍스트
      expect(text).toBe('Hello World')
    })

    it('HTML 태그를 제거해야 함', () => {
      // Given: 중첩된 서식 태그가 있는 HTML
      const html = '<p>Hello <strong>World</strong></p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 모든 태그가 제거됨
      expect(text).toBe('Hello World')
    })

    it('줄 바꿈을 변환해야 함', () => {
      // Given: 여러 p 태그로 구성된 HTML
      const html = '<p>Line 1</p><p>Line 2</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: p 태그가 줄 바꿈으로 변환됨
      expect(text).toBe('Line 1\nLine 2')
    })

    it('<br> 태그를 처리해야 함', () => {
      // Given: br 태그가 포함된 HTML
      const html = '<p>Line 1<br>Line 2</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: br 태그가 줄 바꿈으로 변환됨
      expect(text).toBe('Line 1\nLine 2')
    })

    it('빈 단락을 처리해야 함', () => {
      // Given: 빈 p 태그가 중간에 있는 HTML
      const html = '<p>Line 1</p><p><br></p><p>Line 2</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 빈 단락이 빈 줄로 변환됨
      expect(text).toBe('Line 1\n\nLine 2')
    })

    it('&nbsp;를 처리해야 함', () => {
      // Given: nbsp만 있는 p 태그
      const html = '<p>&nbsp;</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 빈 문자열로 변환됨
      expect(text).toBe('')
    })

    it('HTML 엔티티를 언이스케이프해야 함', () => {
      // Given: HTML 엔티티가 포함된 HTML
      const html = '<p>&lt;div&gt; &amp; &quot;test&quot;</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 엔티티가 원래 문자로 변환됨
      expect(text).toBe('<div> & "test"')
    })

    it('리스트 항목을 처리해야 함', () => {
      // Given: ul/li 리스트 HTML
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 각 항목이 줄 바꿈으로 구분됨
      expect(text).toBe('Item 1\nItem 2')
    })

    it('테이블 행을 처리해야 함', () => {
      // Given: 테이블 HTML
      const html =
        '<table><tr><td>Cell 1</td></tr><tr><td>Cell 2</td></tr></table>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 각 행이 줄 바꿈으로 구분됨
      expect(text).toBe('Cell 1\nCell 2')
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 모두 빈 문자열 반환
      expect(converter.htmlToText('')).toBe('')
      // @ts-expect-error - Testing null input handling
      expect(converter.htmlToText(null)).toBe('')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.htmlToText(undefined)).toBe('')
    })

    it('과도한 줄 바꿈을 정리해야 함', () => {
      // Given: 연속된 빈 p 태그가 있는 HTML
      const html = '<p>A</p><p><br></p><p><br></p><p><br></p><p>B</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 연속 줄 바꿈이 최대 2개로 정리됨
      expect(text).toBe('A\n\nB')
    })

    it('제목을 처리해야 함', () => {
      // Given: h1 제목과 p 본문이 있는 HTML
      const html = '<h1>Title</h1><p>Content</p>'

      // When: htmlToText 변환
      const text = converter.htmlToText(html)

      // Then: 제목과 본문이 줄 바꿈으로 구분됨
      expect(text).toBe('Title\nContent')
    })
  })

  describe('textToHTML (텍스트 → HTML 변환)', () => {
    /**
     * Why: 순수 텍스트를 HTML 구조로 변환해야 WYSIWYG 편집기에서 표시 가능
     * How: 줄 바꿈을 p 태그로 감싸고 특수문자를 이스케이프
     */

    it('순수 텍스트를 HTML로 변환해야 함', () => {
      // Given: 단순 텍스트
      const text = 'Hello World'

      // When: textToHTML 변환
      const html = converter.textToHTML(text)

      // Then: p 태그로 감싸짐
      expect(html).toBe('<p>Hello World</p>')
    })

    it('여러 줄을 처리해야 함', () => {
      // Given: 줄 바꿈이 있는 텍스트
      const text = 'Line 1\nLine 2'

      // When: textToHTML 변환
      const html = converter.textToHTML(text)

      // Then: 각 줄이 별도 p 태그로 변환됨
      expect(html).toBe('<p>Line 1</p><p>Line 2</p>')
    })

    it('빈 줄을 처리해야 함', () => {
      // Given: 빈 줄이 있는 텍스트
      const text = 'Line 1\n\nLine 2'

      // When: textToHTML 변환
      const html = converter.textToHTML(text)

      // Then: 빈 줄이 br 태그가 있는 p로 변환됨
      expect(html).toBe('<p>Line 1</p><p><br></p><p>Line 2</p>')
    })

    it('HTML 문자를 이스케이프해야 함', () => {
      // Given: HTML 특수문자가 포함된 텍스트
      const text = '<div>Test & "quotes"</div>'

      // When: textToHTML 변환
      const html = converter.textToHTML(text)

      // Then: 특수문자가 엔티티로 이스케이프됨
      expect(html).toContain('&lt;div&gt;')
      expect(html).toContain('&amp;')
      expect(html).toContain('&quot;')
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 빈 p 태그 반환
      expect(converter.textToHTML('')).toBe('<p><br></p>')
      // @ts-expect-error - Testing null input handling
      expect(converter.textToHTML(null)).toBe('<p><br></p>')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.textToHTML(undefined)).toBe('<p><br></p>')
    })

    it('줄 내 공백을 보존해야 함', () => {
      // Given: 앞뒤와 중간에 공백이 있는 텍스트
      const text = '  Hello  World  '

      // When: textToHTML 변환
      const html = converter.textToHTML(text)

      // Then: 공백이 그대로 보존됨
      expect(html).toBe('<p>  Hello  World  </p>')
    })
  })

  describe('escapeHTML (HTML 특수문자 이스케이프)', () => {
    /**
     * Why: HTML에서 특별한 의미를 가진 문자를 안전하게 표시해야 XSS 방지
     * How: &, <, >, ", ' 문자를 해당 HTML 엔티티로 변환
     */

    it('& 문자를 이스케이프해야 함', () => {
      // Given: & 문자가 포함된 텍스트

      // When: escapeHTML 변환
      // Then: &amp;로 이스케이프됨
      expect(converter.escapeHTML('A & B')).toBe('A &amp; B')
    })

    it('< 문자를 이스케이프해야 함', () => {
      // Given: < 문자가 포함된 텍스트

      // When: escapeHTML 변환
      // Then: &lt;로 이스케이프됨
      expect(converter.escapeHTML('<div>')).toBe('&lt;div&gt;')
    })

    it('> 문자를 이스케이프해야 함', () => {
      // Given: > 문자가 포함된 텍스트

      // When: escapeHTML 변환
      // Then: &gt;로 이스케이프됨
      expect(converter.escapeHTML('</div>')).toBe('&lt;/div&gt;')
    })

    it('" 문자를 이스케이프해야 함', () => {
      // Given: 큰따옴표가 포함된 텍스트

      // When: escapeHTML 변환
      // Then: &quot;로 이스케이프됨
      expect(converter.escapeHTML('"test"')).toBe('&quot;test&quot;')
    })

    it("' 문자를 이스케이프해야 함", () => {
      // Given: 작은따옴표가 포함된 텍스트

      // When: escapeHTML 변환
      // Then: &#039;로 이스케이프됨
      expect(converter.escapeHTML("'test'")).toBe('&#039;test&#039;')
    })

    it('여러 문자를 이스케이프해야 함', () => {
      // Given: 여러 특수문자가 포함된 텍스트
      const text = '<div class="test">A & B</div>'

      // When: escapeHTML 변환
      const escaped = converter.escapeHTML(text)

      // Then: 모든 특수문자가 이스케이프됨
      expect(escaped).toBe(
        '&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;'
      )
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 빈 문자열 반환
      expect(converter.escapeHTML('')).toBe('')
      // @ts-expect-error - Testing null input handling
      expect(converter.escapeHTML(null)).toBe('')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.escapeHTML(undefined)).toBe('')
    })
  })

  describe('unescapeHTML (HTML 엔티티 언이스케이프)', () => {
    /**
     * Why: HTML 엔티티를 원래 문자로 복원해야 텍스트 편집/표시에 사용 가능
     * How: HTML 엔티티를 해당 문자로 역변환, & 엔티티는 마지막에 처리
     */

    it('&amp;를 언이스케이프해야 함', () => {
      // Given: &amp; 엔티티가 포함된 문자열

      // When: unescapeHTML 변환
      // Then: & 문자로 복원됨
      expect(converter.unescapeHTML('A &amp; B')).toBe('A & B')
    })

    it('&lt;와 &gt;를 언이스케이프해야 함', () => {
      // Given: &lt;, &gt; 엔티티가 포함된 문자열

      // When: unescapeHTML 변환
      // Then: <, > 문자로 복원됨
      expect(converter.unescapeHTML('&lt;div&gt;')).toBe('<div>')
    })

    it('&quot;를 언이스케이프해야 함', () => {
      // Given: &quot; 엔티티가 포함된 문자열

      // When: unescapeHTML 변환
      // Then: " 문자로 복원됨
      expect(converter.unescapeHTML('&quot;test&quot;')).toBe('"test"')
    })

    it('&#039;를 언이스케이프해야 함', () => {
      // Given: &#039; 엔티티가 포함된 문자열

      // When: unescapeHTML 변환
      // Then: ' 문자로 복원됨
      expect(converter.unescapeHTML('&#039;test&#039;')).toBe("'test'")
    })

    it('&nbsp;를 언이스케이프해야 함', () => {
      // Given: &nbsp; 엔티티가 포함된 문자열

      // When: unescapeHTML 변환
      // Then: 공백 문자로 복원됨
      expect(converter.unescapeHTML('A&nbsp;B')).toBe('A B')
    })

    it('여러 엔티티를 언이스케이프해야 함', () => {
      // Given: 여러 HTML 엔티티가 포함된 문자열
      const html = '&lt;div class=&quot;test&quot;&gt;A &amp; B&lt;/div&gt;'

      // When: unescapeHTML 변환
      const unescaped = converter.unescapeHTML(html)

      // Then: 모든 엔티티가 원래 문자로 복원됨
      expect(unescaped).toBe('<div class="test">A & B</div>')
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 빈 문자열 반환
      expect(converter.unescapeHTML('')).toBe('')
      // @ts-expect-error - Testing null input handling
      expect(converter.unescapeHTML(null)).toBe('')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.unescapeHTML(undefined)).toBe('')
    })

    it('올바른 순서로 언이스케이프해야 함 (& 마지막)', () => {
      // Given: &amp;lt; (이중 이스케이프된 문자열)
      const html = '&amp;lt;'

      // When: unescapeHTML 변환
      const unescaped = converter.unescapeHTML(html)

      // Then: &lt;로 변환됨 (이중 변환 방지)
      expect(unescaped).toBe('&lt;')
    })
  })

  describe('stripTags (HTML 태그 제거)', () => {
    /**
     * Why: HTML 구조를 제거하고 순수 텍스트만 추출해야 하는 경우 필요
     * How: 정규식으로 모든 HTML 태그 패턴을 제거
     */

    it('HTML 태그를 제거해야 함', () => {
      // Given: 서식 태그가 포함된 HTML
      const html = '<p>Hello <strong>World</strong></p>'

      // When: stripTags 실행
      const text = converter.stripTags(html)

      // Then: 모든 태그가 제거됨
      expect(text).toBe('Hello World')
    })

    it('중첩된 태그를 처리해야 함', () => {
      // Given: 깊게 중첩된 HTML
      const html = '<div><p><span>Text</span></p></div>'

      // When: stripTags 실행
      const text = converter.stripTags(html)

      // Then: 모든 중첩 태그가 제거됨
      expect(text).toBe('Text')
    })

    it('자체 닫힘 태그를 처리해야 함', () => {
      // Given: 자체 닫힘 태그가 포함된 HTML
      const html = '<p>Text<br/>More</p>'

      // When: stripTags 실행
      const text = converter.stripTags(html)

      // Then: 자체 닫힘 태그도 제거됨
      expect(text).toBe('TextMore')
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 빈 문자열 반환
      expect(converter.stripTags('')).toBe('')
      // @ts-expect-error - Testing null input handling
      expect(converter.stripTags(null)).toBe('')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.stripTags(undefined)).toBe('')
    })

    it('텍스트 내용을 보존해야 함', () => {
      // Given: 태그 없는 순수 텍스트
      const html = 'Plain text without tags'

      // When: stripTags 실행
      const text = converter.stripTags(html)

      // Then: 텍스트가 그대로 보존됨
      expect(text).toBe('Plain text without tags')
    })
  })

  describe('formatHTML (HTML 포맷팅)', () => {
    /**
     * Why: HTML 소스를 가독성 있게 표시해야 개발자가 편집하기 쉬움
     * How: 블록 요소에 줄 바꿈과 들여쓰기를 추가
     */

    it('블록 요소에 줄 바꿈을 추가해야 함', () => {
      // Given: 한 줄로 된 HTML
      const html = '<div><p>Hello</p></div>'

      // When: formatHTML 실행
      const formatted = converter.formatHTML(html)

      // Then: 줄 바꿈이 추가됨
      expect(formatted).toContain('\n')
    })

    it('들여쓰기를 추가해야 함', () => {
      // Given: 중첩된 HTML
      const html = '<div><p>Hello</p></div>'

      // When: formatHTML 실행
      const formatted = converter.formatHTML(html)

      // Then: 들여쓰기가 적용됨
      expect(formatted).toMatch(/\s+<p>/)
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 빈 문자열 반환
      expect(converter.formatHTML('')).toBe('')
      // @ts-expect-error - Testing null input handling
      expect(converter.formatHTML(null)).toBe('')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.formatHTML(undefined)).toBe('')
    })

    it('과도한 줄 바꿈을 추가하지 않아야 함', () => {
      // Given: 중첩된 HTML
      const html = '<div><p>Hello</p></div>'

      // When: formatHTML 실행
      const formatted = converter.formatHTML(html)

      // Then: 연속 3개 이상의 줄 바꿈이 없음
      expect(formatted).not.toMatch(/\n{3,}/)
    })
  })

  describe('cleanHTML (HTML 정리)', () => {
    /**
     * Why: 외부에서 붙여넣은 HTML에서 위험하거나 불필요한 요소를 제거해야 함
     * How: script, style 태그와 주석 제거, 공백 정규화
     */

    it('주석을 제거해야 함', () => {
      // Given: HTML 주석이 포함된 문자열
      const html = '<p>Text<!-- comment --></p>'

      // When: cleanHTML 실행
      const cleaned = converter.cleanHTML(html)

      // Then: 주석이 제거되고 텍스트는 보존됨
      expect(cleaned).not.toContain('comment')
      expect(cleaned).toContain('Text')
    })

    it('script 태그를 제거해야 함', () => {
      // Given: script 태그가 포함된 HTML
      const html = '<p>Text</p><script>alert("xss")</script>'

      // When: cleanHTML 실행
      const cleaned = converter.cleanHTML(html)

      // Then: script 태그와 내용이 제거되고 텍스트는 보존됨
      expect(cleaned).not.toContain('script')
      expect(cleaned).not.toContain('alert')
      expect(cleaned).toContain('Text')
    })

    it('style 태그를 제거해야 함', () => {
      // Given: style 태그가 포함된 HTML
      const html = '<p>Text</p><style>body { color: red; }</style>'

      // When: cleanHTML 실행
      const cleaned = converter.cleanHTML(html)

      // Then: style 태그와 내용이 제거되고 텍스트는 보존됨
      expect(cleaned).not.toContain('style')
      expect(cleaned).not.toContain('color')
      expect(cleaned).toContain('Text')
    })

    it('공백을 정규화해야 함', () => {
      // Given: 연속 공백이 있는 HTML
      const html = '<p>Text   with    spaces</p>'

      // When: cleanHTML 실행
      const cleaned = converter.cleanHTML(html)

      // Then: 연속 공백이 단일 공백으로 정규화됨
      expect(cleaned).toBe('<p>Text with spaces</p>')
    })

    it('빈 입력을 처리해야 함', () => {
      // Given: 빈 문자열, null, undefined 입력

      // When & Then: 빈 문자열 반환
      expect(converter.cleanHTML('')).toBe('')
      // @ts-expect-error - Testing null input handling
      expect(converter.cleanHTML(null)).toBe('')
      // @ts-expect-error - Testing undefined input handling
      expect(converter.cleanHTML(undefined)).toBe('')
    })
  })

  describe('isEmpty (빈 HTML 확인)', () => {
    /**
     * Why: 에디터 콘텐츠가 실질적으로 비어있는지 확인해야 저장/제출 시 검증 가능
     * How: 태그, 공백, &nbsp; 등을 제거 후 텍스트 존재 여부 확인
     */

    it('빈 문자열에 대해 true를 반환해야 함', () => {
      // Given: 빈 문자열

      // When & Then: true 반환
      expect(converter.isEmpty('')).toBe(true)
    })

    it('null/undefined에 대해 true를 반환해야 함', () => {
      // Given: null, undefined 입력

      // When & Then: true 반환
      // @ts-expect-error - Testing null input handling
      expect(converter.isEmpty(null)).toBe(true)
      // @ts-expect-error - Testing undefined input handling
      expect(converter.isEmpty(undefined)).toBe(true)
    })

    it('공백만 있는 경우 true를 반환해야 함', () => {
      // Given: 공백, 탭, 줄바꿈만 있는 문자열

      // When & Then: true 반환
      expect(converter.isEmpty('   ')).toBe(true)
      expect(converter.isEmpty('\n\t  ')).toBe(true)
    })

    it('빈 태그에 대해 true를 반환해야 함', () => {
      // Given: 빈 HTML 태그

      // When & Then: true 반환
      expect(converter.isEmpty('<p></p>')).toBe(true)
      expect(converter.isEmpty('<div><span></span></div>')).toBe(true)
    })

    it('&nbsp;만 있는 경우 true를 반환해야 함', () => {
      // Given: &nbsp;만 포함된 HTML

      // When & Then: true 반환
      expect(converter.isEmpty('<p>&nbsp;</p>')).toBe(true)
      expect(converter.isEmpty('&nbsp;&nbsp;')).toBe(true)
    })

    it('콘텐츠가 있으면 false를 반환해야 함', () => {
      // Given: 실제 텍스트가 있는 입력

      // When & Then: false 반환
      expect(converter.isEmpty('Hello')).toBe(false)
      expect(converter.isEmpty('<p>Hello</p>')).toBe(false)
    })

    it('특수 문자가 있으면 false를 반환해야 함', () => {
      // Given: 특수 문자가 있는 입력

      // When & Then: false 반환
      expect(converter.isEmpty('!')).toBe(false)
      expect(converter.isEmpty('<p>.</p>')).toBe(false)
    })
  })

  describe('왕복 변환 (변환 보존 확인)', () => {
    /**
     * Why: HTML ↔ Text 변환 시 데이터 손실이 없어야 사용자 콘텐츠 보존
     * How: 변환 후 역변환하여 원본과 비교
     */

    it('HTML 변환을 통해 텍스트를 보존해야 함', () => {
      // Given: 여러 줄 HTML
      const originalHTML = '<p>Hello World</p><p>Line 2</p>'

      // When: HTML → Text → HTML → Text 왕복 변환
      const text = converter.htmlToText(originalHTML)
      const backToHTML = converter.textToHTML(text)
      const finalText = converter.htmlToText(backToHTML)
      const originalText = converter.htmlToText(originalHTML)

      // Then: 최종 텍스트가 원본 텍스트와 동일
      expect(finalText).toBe(originalText)
    })

    it('특수 문자를 보존해야 함', () => {
      // Given: 특수 문자가 포함된 텍스트
      const text = 'Test & <special> "characters"'

      // When: Text → HTML → Text 왕복 변환
      const html = converter.textToHTML(text)
      const backToText = converter.htmlToText(html)

      // Then: 특수 문자가 보존됨
      expect(backToText).toBe(text)
    })

    it('줄 바꿈을 보존해야 함', () => {
      // Given: 빈 줄을 포함한 여러 줄 텍스트
      const text = 'Line 1\nLine 2\n\nLine 3'

      // When: Text → HTML → Text 왕복 변환
      const html = converter.textToHTML(text)
      const backToText = converter.htmlToText(html)

      // Then: 줄 바꿈 구조가 보존됨
      expect(backToText).toBe(text)
    })
  })
})
