import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { exporter } from '@/features/export'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 내보내기 — **무엇을 읽는가.**
 *
 * 예전에는 `element.innerHTML` 을 읽었습니다. 그것은 `prosemirror-view` 가
 * 그린 DOM 이지 문서가 아닙니다. 그래서 편집기 속살이 파일로 나갔습니다:
 * 찾기 강조(데코레이션), 표를 감싼 `.tableWrapper` 와 `<colgroup>`.
 *
 * 자동 저장이 §11-6 에서 겪은 것과 같은 실수입니다 — **문서를 읽는 자리는
 * 모델입니다.**
 */
describe('내보내기', () => {
  let ed: PluginArea

  afterEach(() => {
    ed.destroy()
  })

  describe('형식', () => {
    beforeEach(() => {
      ed = mountPluginArea('<h1>제목</h1><p>본문 <strong>굵게</strong></p>')
    })

    it('HTML 은 문서를 그대로', () => {
      expect(exporter(ed.context).toText('html')).toBe(
        '<h1>제목</h1><p>본문 <strong>굵게</strong></p>'
      )
    })

    it('마크다운', () => {
      expect(exporter(ed.context).toText('markdown')).toContain('# 제목')
      expect(exporter(ed.context).toText('markdown')).toContain('**굵게**')
    })

    it('맨 글', () => {
      const text = exporter(ed.context).toText('text')

      expect(text).toContain('제목')
      expect(text).toContain('본문 굵게')
      expect(text).not.toContain('<')
    })
  })

  describe('편집기 속살이 안 나가야 함', () => {
    /**
     * 찾기 강조는 **데코레이션**이라 문서에 없습니다. 그런데 화면의 DOM 에는
     * 있으므로, `innerHTML` 을 읽으면 파일로 따라 나갔습니다.
     */
    it('찾기 강조가 켜져 있어도 안 나가야 함', () => {
      ed = mountPluginArea('<p>Hello world</p>')
      ed.area.getHighlighter().set([
        {
          from: 1,
          to: 6,
          className: 'find-highlight',
          style: 'background-color: #ff0',
        },
      ])

      expect(ed.element.innerHTML).toContain('find-highlight')
      expect(exporter(ed.context).toText('html')).toBe('<p>Hello world</p>')
    })

    /**
     * 표는 열 너비를 그리려고 `.tableWrapper` 로 감싸이고 `<colgroup>` 이
     * 붙습니다 (`columnResizing` 의 뷰). 그것도 문서에 없는 것입니다.
     */
    it('표를 감싼 뷰의 것이 안 나가야 함', () => {
      ed = mountPluginArea('<table><tr><td>a</td><td>b</td></tr></table>')

      expect(ed.element.innerHTML).toContain('tableWrapper')

      const html = exporter(ed.context).toText('html')

      expect(html).not.toContain('tableWrapper')
      expect(html).not.toContain('colgroup')
      expect(html).toContain('<table>')
    })
  })

  describe('내려받기', () => {
    beforeEach(() => {
      ed = mountPluginArea('<p>내려받을 글</p>')
    })

    it('형식에 맞는 이름과 형식으로 만들어야 함', async () => {
      const realCreate = URL.createObjectURL
      const realClick = HTMLAnchorElement.prototype.click
      const files: { name: string; blob: Blob }[] = []
      let pending: Blob | null = null

      URL.createObjectURL = (blob: Blob) => {
        pending = blob

        return 'blob:test'
      }
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
        if (pending) files.push({ name: this.download, blob: pending })
      }

      try {
        exporter(ed.context).download('markdown')
        exporter(ed.context).download('text', '내 문서')
      } finally {
        URL.createObjectURL = realCreate
        HTMLAnchorElement.prototype.click = realClick
      }

      expect(files.map((f) => [f.name, f.blob.type])).toEqual([
        ['document.md', 'text/markdown'],
        ['내 문서.txt', 'text/plain'],
      ])
      expect(await files[0].blob.text()).toContain('내려받을 글')
    })
  })

  it('같은 에디터에서는 같은 객체여야 함', () => {
    ed = mountPluginArea('<p>글</p>')

    expect(exporter(ed.context)).toBe(exporter(ed.context))
  })
})
