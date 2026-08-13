import { define } from 'nanotags'
import type { EditorContext } from 'sagak-core'
import { editorContextKey } from './editor-context'
import { subscribeToSelection } from '../hooks/use-selection-derived'

/**
 * 툴바 드롭다운 공용 껍데기 — 커스텀 엘리먼트판.
 *
 * ## 왜 팩토리인가
 *
 * 툴바의 드롭다운 넷(글자 크기·줄 간격·자간·문단 스타일)은 **거의 같은
 * 컴포넌트**입니다. 다른 것은 항목 목록과 고른 뒤에 무엇을 쏘느냐뿐입니다.
 * Preact 쪽에서 `ToolbarSelect` 하나를 넷이 공유하던 것과 같은 구조를
 * 유지합니다 — 안 그러면 옮기면서 중복이 넷으로 늘어납니다.
 *
 * ## 두 갈래가 있습니다
 *
 * | | 예 | 값의 출처 |
 * | --- | --- | --- |
 * | 따라가는 것 | 글자 크기 | 선택 영역에서 매번 읽습니다 |
 * | 안 따라가는 것 | 줄 간격·자간·문단 | 처음 값만 두고 그대로 둡니다 |
 *
 * 따라가는 쪽만 `subscribeToSelection` 을 씁니다. 그 구독에는 IME 조합 중 무시
 * 같은 가드가 들어 있는데, 원래부터 Preact 를 안 쓰고 있어서 그대로 재사용
 * 합니다.
 *
 * ## 선택 영역 저장은 빼먹으면 안 됩니다
 *
 * 툴바를 누르면 포커스가 에디터를 떠나 선택이 풀립니다. `mousedown`·`focus`
 * 에서 저장하고 적용 직전에 되돌립니다. 이걸 빠뜨리면 "고르면 아무 데도 안
 * 먹는" 증상이 됩니다.
 */

export interface ToolbarSelectOption {
  label: string
  value: string
}

export interface ToolbarSelectSpec {
  title: string
  options: ToolbarSelectOption[]
  /** 안 따라가는 드롭다운의 처음 값 */
  defaultValue?: string
  /**
   * 따라가는 드롭다운이 현재 값을 읽는 방법.
   *
   * 목록에 없는 값이 나오면 `fallbackValue` 로 떨어집니다.
   */
  query?: (editor: EditorContext) => string | undefined
  /** 읽은 값이 목록에 없을 때 가리킬 항목 */
  fallbackValue?: string
  apply: (editor: EditorContext, value: string) => void
}

export function defineToolbarSelect(tag: string, spec: ToolbarSelectSpec): void {
  define(tag, (ctx) => {
    ctx.host.style.display = 'contents'

    const select = document.createElement('select')
    /*
     * kinu 의 스타일을 그대로 받습니다.
     *
     * `[k=select]` 이 패딩(.75rem/2rem)·높이·화살표를 정합니다. 이걸 안 달면
     * 옮긴 드롭다운만 **24px 씩 좁아지고**, 툴바가 `flex-wrap` 이라 줄바꿈
     * 위치까지 달라집니다. 실제로 폭 검사와 자동 저장 레이아웃 검사가 같이
     * 깨져서 드러났습니다.
     *
     * 이주 중 다리입니다 — kinu 를 걷어낼 때 이 스타일을 우리 쪽으로 옮겨야
     * 합니다. 그때까지는 옮긴 것과 안 옮긴 것이 같아 보이는 게 우선입니다.
     */
    select.setAttribute('k', 'select')
    select.title = spec.title
    select.setAttribute('aria-label', spec.title)

    for (const option of spec.options) {
      const el = document.createElement('option')
      el.value = option.value
      el.textContent = option.label
      select.append(el)
    }

    if (spec.defaultValue !== undefined) select.value = spec.defaultValue
    ctx.host.append(select)

    editorContextKey.consume(ctx, ($editor) => {
      ctx.effect($editor, (editor) => {
        if (!editor) return

        const save = (): void => {
          editor.selectionManager?.saveSelection()
        }
        ctx.on(select, 'mousedown', save)
        ctx.on(select, 'focus', save)

        ctx.on(select, 'change', () => {
          editor.selectionManager?.restoreSelection()
          spec.apply(editor, select.value)
        })

        if (!spec.query) return

        const sync = (): void => {
          const current = spec.query?.(editor)
          const known =
            current !== undefined &&
            spec.options.some((option) => option.value === current)
          select.value = known
            ? (current as string)
            : (spec.fallbackValue ?? spec.options[0].value)
        }

        sync()
        ctx.onCleanup(subscribeToSelection(editor, sync))
      })
    })
  })
}
