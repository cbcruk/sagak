import { describe, it, expect } from 'vitest'
import {
  createSanitizer,
  identitySanitizer,
  resolveSanitizer,
} from '@/editor/editing-area/sanitizer'

/**
 * Sanitizer 테스트
 *
 * Why: 붙여넣기/`setContent`로 유입되는 신뢰할 수 없는 HTML의 XSS 벡터 차단 검증
 * How: 위험한 마크업이 제거되고 서식 태그는 유지되는지 확인
 */
describe('Sanitizer', () => {
  describe('createSanitizer (위험한 마크업 제거)', () => {
    it('<script> 태그를 제거해야 함', () => {
      const sanitize = createSanitizer()
      const result = sanitize('<p>안녕</p><script>alert(1)</script>')

      expect(result).toContain('안녕')
      expect(result).not.toContain('<script')
    })

    it('인라인 이벤트 핸들러를 제거해야 함', () => {
      const sanitize = createSanitizer()
      const result = sanitize('<img src="x" onerror="alert(1)">')

      expect(result).not.toContain('onerror')
    })

    it('javascript: URI를 제거해야 함', () => {
      const sanitize = createSanitizer()
      const result = sanitize('<a href="javascript:alert(1)">링크</a>')

      expect(result).not.toContain('javascript:')
    })

    it('서식 태그는 유지해야 함', () => {
      const sanitize = createSanitizer()
      const result = sanitize(
        '<p><strong>굵게</strong> <em>기울임</em></p>'
      )

      expect(result).toContain('<strong>')
      expect(result).toContain('<em>')
    })

    it('표/링크/이미지 태그와 안전한 속성은 유지해야 함', () => {
      const sanitize = createSanitizer()
      const result = sanitize(
        '<table><tr><td>셀</td></tr></table>' +
          '<a href="https://example.com">링크</a>' +
          '<img src="https://example.com/a.png">'
      )

      expect(result).toContain('<table>')
      expect(result).toContain('href="https://example.com"')
      expect(result).toContain('src="https://example.com/a.png"')
    })

    it('사용자 정의 config로 태그를 제한할 수 있어야 함', () => {
      const sanitize = createSanitizer({
        config: { ALLOWED_TAGS: ['b'] },
      })
      const result = sanitize('<b>굵게</b><i>기울임</i>')

      expect(result).toContain('<b>')
      expect(result).not.toContain('<i>')
    })
  })

  describe('identitySanitizer (정화 비활성화)', () => {
    it('입력을 그대로 반환해야 함', () => {
      const dirty = '<script>alert(1)</script>'
      expect(identitySanitizer(dirty)).toBe(dirty)
    })
  })

  describe('resolveSanitizer (옵션 해석)', () => {
    it('false는 identity 정화기를 반환해야 함', () => {
      const sanitize = resolveSanitizer(false)
      const dirty = '<script>alert(1)</script>'

      expect(sanitize(dirty)).toBe(dirty)
    })

    it('true는 기본 정화기를 반환해야 함', () => {
      const sanitize = resolveSanitizer(true)

      expect(sanitize('<script>alert(1)</script>')).not.toContain('<script')
    })

    it('미지정은 기본 정화기를 반환해야 함', () => {
      const sanitize = resolveSanitizer()

      expect(sanitize('<script>alert(1)</script>')).not.toContain('<script')
    })

    it('옵션 객체는 사용자 정의 정화기를 반환해야 함', () => {
      const sanitize = resolveSanitizer({ config: { ALLOWED_TAGS: ['b'] } })

      expect(sanitize('<b>x</b><i>y</i>')).not.toContain('<i>')
    })
  })
})
