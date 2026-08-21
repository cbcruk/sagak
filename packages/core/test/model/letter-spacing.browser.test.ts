import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fromJSON, toHtml } from '@/model/storage'
import { sagakSchema } from '@/model/schema'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 자간은 **문단 속성**입니다.
 *
 * 예전에는 인라인 마크였습니다. 툴바에서 줄 간격 바로 옆에 있는데 동작이
 * 갈렸습니다 — 캐럿만 두고 고르면 줄 간격은 문단에 먹고, 자간은 **아무 일도
 * 안 일어났습니다**. 다음에 치는 글자부터 적용되는 stored mark 였기 때문입니다.
 * 셀렉트는 멀쩡히 값을 보여 주는데 골라도 화면이 안 바뀌는 조합이었습니다.
 *
 * 잃는 것을 적어 둡니다 — **문단 일부만 다른 자간**은 이제 못 줍니다. 줄
 * 간격과 같은 자리로 옮긴 대가입니다.
 */
describe('자간', () => {
  let ed: PluginArea

  afterEach(() => {
    ed.destroy()
  })

  describe('먹이기', () => {
    beforeEach(() => {
      ed = mountPluginArea('<p>안녕하세요 반갑습니다</p>')
    })

    /** 예전에는 여기서 아무 일도 안 일어났습니다 */
    it('캐럿만 두고 골라도 문단에 먹어야 함', () => {
      ed.collapse(4)

      expect(ed.registry.run('letterSpacing', '0.2em')).toBe(true)
      expect(ed.area.getRawContent()).toBe(
        '<p style="letter-spacing: 0.2em;">안녕하세요 반갑습니다</p>'
      )
    })

    it('글자를 골라도 문단 전체에 먹어야 함', () => {
      ed.select(1, 4)

      ed.registry.run('letterSpacing', '0.2em')

      const html = ed.area.getRawContent()
      expect(html).toContain('letter-spacing: 0.2em')
      expect(html, '이제 span 을 안 만듭니다').not.toContain('<span')
    })

    it('여러 문단에 걸치면 문단마다 먹어야 함', () => {
      ed = mountPluginArea('<p>첫째</p><p>둘째</p>')
      ed.selectAll()

      ed.registry.run('letterSpacing', '0.3em')

      expect(ed.area.getRawContent()).toBe(
        '<p style="letter-spacing: 0.3em;">첫째</p>' +
          '<p style="letter-spacing: 0.3em;">둘째</p>'
      )
    })

    /** 줄 간격과 같은 자리이므로 나란히 붙습니다 */
    it('줄 간격과 함께 붙어야 함', () => {
      ed.selectAll()

      ed.registry.run('lineHeight', '2')
      ed.registry.run('letterSpacing', '0.2em')

      expect(ed.area.getRawContent()).toContain('line-height: 2')
      expect(ed.area.getRawContent()).toContain('letter-spacing: 0.2em')
    })

    it('툴바가 지금 값을 읽을 수 있어야 함', () => {
      ed.collapse(4)
      ed.registry.run('letterSpacing', '0.2em')

      expect(ed.registry.queryValue('letterSpacing')).toBe('0.2em')
    })
  })

  /**
   * 마크가 스키마에서 없어지면 그 마크가 든 저장물은 `Node.fromJSON` 이
   * 던집니다. **깨진 저장물이 아니라 우리가 깨뜨린 것**이므로 읽어 줘야 합니다.
   */
  describe('예전 저장물 읽기', () => {
    beforeEach(() => {
      ed = mountPluginArea('<p>글</p>')
    })

    const legacy = (
      texts: Array<{ text: string; spacing?: string }>
    ): Record<string, unknown> => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { align: null, lineHeight: null, indent: null },
          content: texts.map(({ text, spacing }) => ({
            type: 'text',
            ...(spacing
              ? { marks: [{ type: 'letterSpacing', attrs: { value: spacing } }] }
              : {}),
            text,
          })),
        },
      ],
    })

    it('문단 전체가 같은 자간이면 문단 속성으로 올려야 함', () => {
      const doc = fromJSON(
        legacy([{ text: '안녕하세요', spacing: '0.2em' }]) as never,
        sagakSchema
      )

      expect(toHtml(doc, sagakSchema, document)).toBe(
        '<p style="letter-spacing: 0.2em;">안녕하세요</p>'
      )
    })

    /**
     * 문단 일부만 다른 자간은 새 모델에 담을 자리가 없습니다. 던지는 것보다
     * 자간을 잃는 쪽이 낫습니다 — 글은 남습니다.
     */
    it('일부만 붙어 있으면 자간은 잃되 글은 남아야 함', () => {
      const doc = fromJSON(
        legacy([
          { text: '안녕', spacing: '0.2em' },
          { text: ' 반가워' },
        ]) as never,
        sagakSchema
      )

      const html = toHtml(doc, sagakSchema, document)

      expect(html).toBe('<p>안녕 반가워</p>')
      expect(html).not.toContain('letter-spacing')
    })

    it('자간이 없던 저장물은 그대로여야 함', () => {
      const doc = fromJSON(legacy([{ text: '안녕' }]) as never, sagakSchema)

      expect(toHtml(doc, sagakSchema, document)).toBe('<p>안녕</p>')
    })
  })
})
