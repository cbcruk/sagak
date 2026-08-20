import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NodeSelection } from 'prosemirror-state'
import { columnResizingPluginKey } from 'prosemirror-tables'
import { createImageResizePlugin } from '@/features/image-resize'
import { mountPluginArea } from '../helpers/plugin-area'
import type { PluginArea } from '../helpers/plugin-area'

/**
 * 크기 조절이 **문서에 남는가.**
 *
 * 두 리사이즈는 `cell.style.width` 와 `img.style.width` 를 DOM 에 직접
 * 썼습니다. 문서 모델을 안 지나므로 저장물에 안 담겼습니다 — 재 보면
 * 이렇습니다:
 *
 * ```
 * img.style.width = '111px' 뒤
 *   DOM:            style="width: 111px;"
 *   getRawContent:  <p><img src="…" alt="a"></p>     ← 폭이 없습니다
 * ```
 *
 * 새로 고치면 사라지고 되돌리기도 안 됩니다. 그런데도 조절이 끝나면
 * `STYLE_CHANGED` 를 쏘아 자동 저장을 깨웠으니, **바뀐 것이 안 담긴 내용을
 * 저장하고 "Saved" 를 보여 줬습니다.**
 *
 * 아래는 그것이 이제 안 그렇다는 확인입니다.
 */
describe('크기 조절은 문서에 남습니다', () => {
  let ed: PluginArea

  afterEach(() => {
    ed.destroy()
  })

  describe('이미지', () => {
    beforeEach(async () => {
      ed = mountPluginArea('<p><img src="data:," alt="사진"></p>')
      await ed.pluginManager.register(createImageResizePlugin())
    })

    const img = (): HTMLImageElement =>
      ed.element.querySelector('img') as HTMLImageElement

    /** 이미지를 고릅니다 — PM 이 `NodeSelection` 을 만드는 그 상태입니다 */
    const selectImage = (): void => {
      const handle = ed.area.getStateHandle()
      const state = handle.getState()!
      const pos = state.doc.resolve(1).pos

      handle.dispatch(
        state.tr.setSelection(NodeSelection.create(state.doc, pos))
      )
    }

    const drag = (dx: number, dy: number): void => {
      const handle = document.querySelector(
        '.sagak-resize-handle-se'
      ) as HTMLElement

      expect(handle, '손잡이가 안 떴습니다').not.toBeNull()

      handle.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 })
      )
      document.dispatchEvent(
        new MouseEvent('mousemove', { bubbles: true, clientX: dx, clientY: dy })
      )
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    }

    it('고르면 손잡이가 뜨고 놓으면 사라져야 함', () => {
      expect(document.querySelector('.sagak-image-resize-overlay')).toBeNull()

      selectImage()
      expect(
        document.querySelector('.sagak-image-resize-overlay')
      ).not.toBeNull()

      ed.collapse(1)
      expect(document.querySelector('.sagak-image-resize-overlay')).toBeNull()
    })

    /**
     * 예전 판은 손잡이를 붙이려고 `<span>` 을 만들어 **이미지를 그 안으로
     * 옮겼습니다.** `prosemirror-view` 가 관리하는 DOM 인데요.
     */
    it('편집 영역의 DOM 을 안 건드려야 함', () => {
      const parent = img().parentElement

      selectImage()

      /*
       * 이미지가 있던 자리 그대로여야 합니다. PM 이 고른 노드에 제 클래스를
       * 붙이는 것은 PM 의 일이라 셈에 안 넣습니다.
       */
      expect(img().parentElement).toBe(parent)
      expect(parent!.tagName).toBe('P')
      expect(ed.element.querySelector('.sagak-image-resize-wrapper')).toBeNull()
      expect(
        document.querySelector('.sagak-image-resize-overlay')!.parentElement
      ).toBe(document.body)
    })

    it('끌어서 조절한 크기가 저장물에 남아야 함', () => {
      const start = img().offsetWidth

      selectImage()
      drag(40, 40)

      const saved = ed.area.getRawContent()

      expect(saved, '고치기 전에는 여기에 폭이 없었습니다').toContain('width:')
      expect(saved).toMatch(/width:\s*\d+px/)

      const width = Number(/width:\s*(\d+)px/.exec(saved)![1])
      expect(width).toBe(start + 40)
    })

    it('조절을 되돌릴 수 있어야 함', () => {
      selectImage()
      drag(40, 40)
      expect(ed.area.getRawContent()).toContain('width:')

      ed.registry.run('undo')

      expect(ed.area.getRawContent()).not.toContain('width:')
    })

    /** 끄는 동안 트랜잭션을 매번 던지면 되돌리기가 끈 횟수만큼 쌓입니다 */
    it('끄는 동안은 기록이 안 쌓여야 함', () => {
      selectImage()

      const handle = document.querySelector(
        '.sagak-resize-handle-se'
      ) as HTMLElement

      handle.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 })
      )

      for (const x of [10, 20, 30, 40]) {
        document.dispatchEvent(
          new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: x })
        )
      }

      /* 아직 손을 안 뗐으므로 문서는 그대로여야 합니다 */
      expect(ed.area.getRawContent()).not.toContain('width:')

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

      expect(ed.area.getRawContent()).toContain('width:')

      ed.registry.run('undo')
      expect(ed.area.getRawContent()).not.toContain('width:')
    })
  })

  describe('표', () => {
    beforeEach(() => {
      ed = mountPluginArea('<table><tr><td>a</td><td>b</td></tr></table>')
    })

    /**
     * 열 너비는 `prosemirror-tables` 의 `colwidth` 속성입니다 — 스키마에 원래
     * 있던 자리인데 손으로 짠 플러그인이 안 쓰고 있었습니다.
     */
    it('열 너비 조절 플러그인이 붙어 있어야 함', () => {
      const state = ed.area.getStateHandle().getState()!

      expect(columnResizingPluginKey.getState(state)).toBeDefined()
    })

    it('colwidth 가 저장물에 남아야 함', () => {
      const handle = ed.area.getStateHandle()
      const state = handle.getState()!

      let cellPos = -1
      state.doc.descendants((node, pos) => {
        if (cellPos < 0 && node.type.name === 'table_cell') cellPos = pos
      })
      expect(cellPos).toBeGreaterThan(-1)

      const cell = state.doc.nodeAt(cellPos)!

      handle.dispatch(
        state.tr.setNodeMarkup(cellPos, undefined, {
          ...cell.attrs,
          colwidth: [140],
        })
      )

      expect(ed.area.getRawContent()).toContain('data-colwidth="140"')
    })

    /** 문서에 있으므로 다시 읽어 들여도 살아 있어야 합니다 */
    it('다시 읽어도 남아야 함', () => {
      ed.area.setRawContent(
        '<table><tr><td data-colwidth="140"><p>a</p></td><td><p>b</p></td></tr></table>'
      )

      expect(ed.area.getRawContent()).toContain('data-colwidth="140"')
    })
  })
})
