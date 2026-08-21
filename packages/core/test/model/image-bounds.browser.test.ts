import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  insertImage,
  updateImage,
  MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT,
} from '@/model/commands'
import { runModelCommand } from '@/model/bridge'
import { NodeSelection } from 'prosemirror-state'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 이미지 크기 상한 — **어디가 막고 어디가 안 막는가.**
 *
 * §11-2 에서 이미지 플러그인과 함께 없어졌던 것입니다. 그때 "보안이 아니라 UX
 * 가드" 라고 적고 비워 뒀는데, 다시 보니 **가드가 있던 자리가 틀렸습니다** —
 * 선언된 크기만 봤으므로 붙여넣기·끌어다 놓기로 들어오는 사진(폭이 안 적혀
 * 있습니다)은 그냥 통과했습니다. 재 봤습니다:
 *
 * ```
 * 600px 영역에 2000px 사진 (폭 선언 없음)
 *   이미지 폭        2000
 *   영역 scrollWidth 2010   ← 가로 스크롤
 * ```
 *
 * 그래서 둘로 나눴습니다 (§10 의 규칙) — 화면은 스타일시트(`max-width: 100%`)가
 * 지키고, 여기가 막는 것은 **문서에 말이 안 되는 값이 들어가는 것**입니다.
 */
describe('이미지 크기 상한', () => {
  let ed: PluginArea

  beforeEach(() => {
    ed = mountPluginArea('<p>글</p>')
  })

  afterEach(() => {
    ed.destroy()
  })

  const insert = (attrs: Record<string, string>): boolean =>
    runModelCommand(ed.context, insertImage({ src: 'https://example.com/a.png', ...attrs }))

  const html = (): string => ed.area.getRawContent()

  describe('넣기', () => {
    it('상한 안이면 들어가야 함', () => {
      expect(insert({ width: '800px', height: '600px' })).toBe(true)
      expect(html()).toContain('width: 800px')
    })

    it('상한 그 자체는 들어가야 함', () => {
      expect(
        insert({
          width: `${MAX_IMAGE_WIDTH}px`,
          height: `${MAX_IMAGE_HEIGHT}px`,
        })
      ).toBe(true)
    })

    it('폭이 넘으면 안 들어가야 함', () => {
      expect(insert({ width: '5000px' })).toBe(false)
      expect(ed.element.querySelector('img')).toBeNull()
    })

    it('높이가 넘으면 안 들어가야 함', () => {
      expect(insert({ height: '2000px' })).toBe(false)
    })

    /** `'200'` 은 픽셀입니다 — HTML 속성이 그 뜻입니다 */
    it('단위가 없어도 픽셀로 봐야 함', () => {
      expect(insert({ width: '5000' })).toBe(false)
      expect(insert({ width: '800' })).toBe(true)
    })

    it('0 이나 음수는 안 들어가야 함', () => {
      expect(insert({ width: '0' })).toBe(false)
      expect(insert({ width: '0px' })).toBe(false)
    })

    /**
     * 퍼센트는 부모에 대한 비율이라 **절대 크기가 아닙니다.** 상한과 무관합니다.
     */
    it('퍼센트는 상한과 무관해야 함', () => {
      expect(insert({ width: '100%' })).toBe(true)
      expect(html()).toContain('width: 100%')
    })

    it('크기를 안 주면 그대로 들어가야 함', () => {
      expect(insert({})).toBe(true)
    })
  })

  describe('고치기', () => {
    const selectImage = (): void => {
      const handle = ed.area.getStateHandle()
      const state = handle.getState()!
      let at = -1

      state.doc.descendants((node, pos) => {
        if (at < 0 && node.type.name === 'image') at = pos
      })

      handle.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, at)))
    }

    beforeEach(() => {
      insert({ width: '800px' })
      selectImage()
    })

    /**
     * 넣을 때만 막던 것이 예전 판입니다 — 넣고 나서 고치면 그만이었습니다.
     * 상한은 **문서가 지키는 성질**이므로 고치는 길도 지나야 합니다.
     */
    it('고칠 때도 막아야 함', () => {
      expect(runModelCommand(ed.context, updateImage({ width: '5000px' }))).toBe(
        false
      )
      expect(html()).toContain('width: 800px')
    })

    it('상한 안으로 고치는 것은 돼야 함', () => {
      expect(runModelCommand(ed.context, updateImage({ width: '400px' }))).toBe(
        true
      )
      expect(html()).toContain('width: 400px')
    })
  })
})
