<script lang="ts">
  import { createEditor } from 'sagak-core'
  import type {
    CreateEditorOptions,
    Editor,
    EditorContext,
  } from 'sagak-core'
  import type { Snippet } from 'svelte'

  /**
   * 에디터 하나를 세우고 그 컨텍스트를 자식에게 넘깁니다 — **`useEditor` 와
   * `EditorProvider` 를 대신하는 자리**입니다.
   *
   * ## 컨텍스트를 내려 주는 방법이 셋이었습니다
   *
   * | 렌더러 | 방법 |
   * | --- | --- |
   * | Preact | `createContext` + `useContext` |
   * | 커스텀 엘리먼트 | DOM 이벤트 (W3C 컨텍스트 프로토콜) |
   * | Svelte | **스니펫 인자** |
   *
   * 앞의 둘은 "어딘가 위에 provider 가 있다" 는 약속이라, 없으면 실행 중에야
   * 터집니다(`useEditorContext` 가 던지던 그 오류입니다). 스니펫 인자는
   * 넘기는 자리와 받는 자리가 마크업에 나란히 보이고 타입도 그대로 흐릅니다.
   *
   * 커스텀 엘리먼트 쪽은 아직 DOM 이벤트가 필요해서 `Toolbar.svelte` 안의
   * `sagak-editor-provider` 가 그 몫을 계속합니다.
   *
   * ## 편집 영역은 늘 그립니다
   *
   * `createEditor` 가 붙을 대상이라 준비되기 전에도 있어야 합니다. 툴바 쪽만
   * 준비된 뒤에 나옵니다 — Preact 판과 같은 순서입니다.
   *
   * 그 문(`{#if context}`)이 여기 하나뿐이라, 아래 컴포넌트들의 `editor` prop
   * 은 `EditorContext` 입니다 — `| null` 이 아닙니다. provider 시절에는 아직
   * 없는 에디터를 각자 막느라 전부 `| null` 이었고 `if (!editor) return` 이
   * 스무 곳쯤 흩어져 있었습니다.
   */

  interface Props {
    initialContent?: string
    autoSave?: CreateEditorOptions['autoSave']
    /** 준비된 뒤에만 그립니다. 에디터 컨텍스트를 인자로 받습니다 */
    children?: Snippet<[EditorContext]>
    onready?: (editor: Editor) => void
    onfail?: (error: Error) => void
  }

  const { initialContent, autoSave, children, onready, onfail }: Props =
    $props()

  let container: HTMLDivElement
  /**
   * **`$state.raw` 여야 합니다 — 프록시로 감싸면 안 됩니다.**
   *
   * `$state` 는 객체를 깊은 프록시로 감쌉니다. 그러면 아래로 내려가는
   * `editor` 는 코어가 만든 객체와 **다른 신원**이 되고, 컨텍스트를 열쇠로
   * 쓰는 모듈(`findReplace`·`autocomplete` 의 `WeakMap`)이 코어가 넣어 둔
   * 자리를 못 찾습니다. 자동 완성이 실제로 그렇게 갈렸습니다 — 입력을 보는
   * 쪽과 그리는 쪽이 서로 다른 상태를 들고 조용히 아무것도 안 했습니다.
   *
   * 컨텍스트는 한 번 정해지고 끝나는 **신원**이지 세밀하게 반응할 데이터가
   * 아닙니다. 갈아 끼울 때만 다시 그리면 됩니다.
   */
  let context = $state.raw<EditorContext | null>(null)

  $effect(() => {
    const instance = createEditor({
      container,
      ...(initialContent === undefined ? {} : { initialContent }),
      ...(autoSave === undefined ? {} : { autoSave }),
    })

    let alive = true
    instance
      .run()
      .then(() => {
        if (!alive) return
        context = instance.context
        onready?.(instance)
      })
      .catch((error: Error) => onfail?.(error))

    return () => {
      alive = false
      instance.destroy()
      context = null
    }
  })
</script>

<div data-scope="editor-container" data-part="root">
  {#if context}
    {@render children?.(context)}
  {/if}
  <div bind:this={container} data-scope="editing-area" data-part="wysiwyg"></div>
</div>
