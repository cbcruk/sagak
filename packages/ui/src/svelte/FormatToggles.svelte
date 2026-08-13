<script lang="ts">
  import { Bold, Italic, Underline, Strikethrough } from 'lucide'
  import type { IconNode } from 'lucide'
  import { CoreEvents, TextStyleEvents } from 'sagak-core'
  import type { EditorContext, FormattingState } from 'sagak-core'
  import { icon } from '../elements/icon'

  /**
   * 서식 토글 넷 — **신호(`@preact/signals`)를 걷어내는 자리**입니다.
   *
   * ## 왜 신호가 있었나
   *
   * `isBold` 하나가 뒤집힐 때 훅으로 들고 있으면 `Toolbar` 안에서는 컴포넌트
   * 195개, 잎으로 내려도 14개가 다시 그려졌습니다. 신호는 **읽은 곳만** 다시
   * 그리므로 4개로 줄었습니다 (`docs/selection-state.md` §8~§10).
   *
   * 그 규율이 까다로웠습니다 — `.value` 를 부모에서 읽으면 도로 훅과 같아지는데
   * 경고해 주는 것이 없어서, 잎 컴포넌트 `FormatToggle` 을 따로 두고 거기서만
   * 읽는 것으로 지켰습니다.
   *
   * ## Svelte 에서는 그 규율이 필요 없습니다
   *
   * `$state` 는 **읽은 DOM 조각**만 갱신합니다. 잎 컴포넌트를 나눌 이유가
   * 없어져서 넷을 한 파일에 두었습니다. 신호를 쓰려고 만든 층이 사라진 것이지
   * 성질이 달라진 것이 아닙니다.
   *
   * 그래서 검사도 바꿔야 합니다. 렌더 범위를 Preact 의 `options.__r` 로 세던
   * 것은 이 컴포넌트에 더 이상 안 걸립니다 — `test/render.browser.test.tsx`
   * 에서 **DOM 이 얼마나 바뀌는지**로 옮겼습니다.
   *
   * ## 굵게 아이콘만 획이 두껍습니다
   *
   * Preact 판이 `strokeWidth={2.5}` 를 줬습니다. `icon()` 은 lucide 기본값
   * 2 로 고정이라 만든 뒤에 덮어씁니다 — 안 그러면 굵게 버튼만 가늘어집니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  let isBold = $state(false)
  let isItalic = $state(false)
  let isUnderline = $state(false)
  let isStrikeThrough = $state(false)

  $effect(() => {
    if (!editor) return
    return editor.eventBus.on(
      CoreEvents.FORMATTING_STATE_CHANGED,
      'on',
      (data?: unknown) => {
        if (!data || typeof data !== 'object') return
        const state = data as Partial<FormattingState>
        if (typeof state.isBold === 'boolean') isBold = state.isBold
        if (typeof state.isItalic === 'boolean') isItalic = state.isItalic
        if (typeof state.isUnderline === 'boolean') {
          isUnderline = state.isUnderline
        }
        if (typeof state.isStrikeThrough === 'boolean') {
          isStrikeThrough = state.isStrikeThrough
        }
      }
    )
  })

  const BUTTON_STYLE =
    'display: flex; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0'

  function glyph(node: IconNode, strokeWidth?: string): string {
    const el = icon(node, 16)
    if (strokeWidth) el.setAttribute('stroke-width', strokeWidth)
    return el.outerHTML
  }

  const emit = (name: string) => () => editor?.eventBus.emit(name as never)
</script>

<div k="toggle-group" role="group" aria-label="Text style">
  <button
    type="button"
    k="toggle"
    aria-pressed={isBold}
    style={BUTTON_STYLE}
    title="Bold (⌘B)"
    aria-label="Bold"
    onclick={emit(TextStyleEvents.BOLD_CLICKED)}
  >
    {@html glyph(Bold, '2.5')}
  </button>
  <button
    type="button"
    k="toggle"
    aria-pressed={isItalic}
    style={BUTTON_STYLE}
    title="Italic (⌘I)"
    aria-label="Italic"
    onclick={emit(TextStyleEvents.ITALIC_CLICKED)}
  >
    {@html glyph(Italic)}
  </button>
  <button
    type="button"
    k="toggle"
    aria-pressed={isUnderline}
    style={BUTTON_STYLE}
    title="Underline (⌘U)"
    aria-label="Underline"
    onclick={emit(TextStyleEvents.UNDERLINE_CLICKED)}
  >
    {@html glyph(Underline)}
  </button>
  <button
    type="button"
    k="toggle"
    aria-pressed={isStrikeThrough}
    style={BUTTON_STYLE}
    title="Strikethrough"
    aria-label="Strikethrough"
    onclick={emit(TextStyleEvents.STRIKE_CLICKED)}
  >
    {@html glyph(Strikethrough)}
  </button>
</div>
