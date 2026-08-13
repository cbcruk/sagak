import { atom, type ReadableAtom } from 'nanostores'
import { define } from 'nanotags'
import { createContext } from 'nanotags/context'
import type { EditorContext } from 'sagak-core'

/**
 * 커스텀 엘리먼트가 에디터에 닿는 통로입니다 — nanotags 이주의 첫 조각.
 *
 * ## 왜 이게 먼저인가
 *
 * Preact 컴포넌트는 `useEditorContext()` 로 에디터를 받습니다. 커스텀
 * 엘리먼트는 Preact 컨텍스트를 못 봅니다. 그래서 **에디터를 어떻게 넘길지**가
 * 정해지기 전에는 어떤 컴포넌트도 옮길 수 없습니다.
 *
 * nanotags 의 `createContext` 는 W3C 컨텍스트 프로토콜(`context-request` /
 * `context-provider` DOM 이벤트)이라 **DOM 트리를 타고 내려갑니다.** 위쪽을
 * Preact 가 그리고 있어도 상관없습니다 — 실측으로 확인했습니다.
 *
 * ## 값이 아니라 스토어를 넘깁니다
 *
 * 에디터는 비동기로 준비되므로, 엘리먼트가 붙는 시점에 아직 없을 수 있습니다.
 * 값을 넘기면 그 순간의 `null` 이 박힙니다. **아톰을 넘기면** 늦게 도착해도
 * 구독한 쪽이 따라옵니다.
 *
 * ## 이주 중에는 Preact 가 채웁니다
 *
 * 속성으로는 객체를 못 넘기므로 `ref` 로 잡아 `setEditor()` 를 부릅니다.
 * 툴바가 전부 넘어가면 이 provider 는 앱 진입점으로 올라가고, 그때부터
 * Preact 없이도 성립합니다.
 */

export const editorContextKey =
  createContext<ReadableAtom<EditorContext | null>>('sagak-editor')

export interface EditorProviderElement extends HTMLElement {
  setEditor(context: EditorContext | null): void
}

export const EDITOR_PROVIDER_TAG = 'sagak-editor-provider'

define(EDITOR_PROVIDER_TAG, (ctx) => {
  const $editor = atom<EditorContext | null>(null)

  editorContextKey.provide(ctx, $editor)

  /*
   * 이 엘리먼트는 자리만 잡습니다. 레이아웃에 끼어들면 툴바의 줄바꿈 계산이
   * 달라지므로 `display: contents` 로 아예 상자를 만들지 않습니다.
   */
  ctx.host.style.display = 'contents'

  return {
    setEditor: (context: EditorContext | null) => {
      $editor.set(context)
    },
  }
})

/**
 * 이주 중에는 Preact 가 커스텀 엘리먼트를 그리므로 JSX 가 태그를 알아야 합니다.
 *
 * 별도 `.d.ts` 로 뒀다가 앱 typecheck 에서 터졌습니다 — 아무도 import 하지
 * 않는 선언 파일은 앱의 프로그램에 안 들어옵니다. 실제로 import 되는 이
 * 모듈 안에 두면 어디서 컴파일하든 따라옵니다.
 *
 * 툴바가 전부 넘어가면 이 선언은 없어집니다 — 그때는 JSX 를 안 거칩니다.
 */
declare module 'preact' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'sagak-editor-provider': JSX.HTMLAttributes<EditorProviderElement>
      'sagak-font-family-select': JSX.HTMLAttributes<HTMLElement>
    }
  }
}
