<script lang="ts">
  import type { EditorContext } from 'sagak-core'
  import { fromSelection } from '../state/from-selection'
  import { choiceStore } from '../state/toolbar-choice'
  import type { ToolbarSelectSpec } from './toolbar-select.specs'

  /**
   * 툴바 드롭다운 넷이 함께 쓰는 하나 — **팩토리가 컴포넌트가 됐습니다.**
   *
   * 커스텀 엘리먼트 시절에는 태그마다 클래스를 등록해야 해서
   * `defineToolbarSelect(태그, 명세)` 로 넷을 찍어 냈습니다. 여기서는 같은
   * 컴포넌트에 명세를 넘기면 됩니다.
   *
   * ## 두 갈래가 있습니다
   *
   * | | 예 | 값의 출처 |
   * | --- | --- | --- |
   * | 따라가는 것 | 글자 크기 | 선택 영역에서 매번 읽습니다 |
   * | 안 따라가는 것 | 줄 간격·자간·문단 | `spec.chosen` 저장소 |
   *
   * 따라가는 쪽만 선택 구독을 씁니다(`fromSelection`). IME 조합 중 무시 같은
   * 가드가 거기 들어 있고, 이 구독은 렌더러를 네 번 갈아타는 동안 한 번도
   * 안 바뀌었습니다.
   *
   * ## 안 따라가는 값은 이 컴포넌트 것이 아닙니다
   *
   * 예전에는 `defaultValue` 로 시작해 여기서만 들고 있었습니다. 더보기
   * 메뉴가 줄 간격·자간을 같은 목록으로 그리게 되면서 값을 든 자리가 둘이
   * 됐고, 그러면 메뉴에서 고른 것이 여기 안 비칩니다. `choiceStore` 를 같이
   * 보게 해서 **어긋날 수가 없게** 했습니다 — 칸은 에디터마다 따로입니다.
   *
   * ## 선택 영역 저장은 빼먹으면 안 됩니다
   *
   * 툴바를 누르면 포커스가 에디터를 떠나 선택이 풀립니다. `mousedown`·`focus`
   * 에서 저장하고 적용 직전에 되돌립니다. 이걸 빠뜨리면 "고르면 아무 데도 안
   * 먹는" 증상이 됩니다. 마우스와 키보드가 포커스를 옮기는 시점이 달라 둘 다
   * 답니다 — `saveSelection()` 은 범위가 에디터 밖이면 아무것도 안 하므로 두
   * 번 불러도 안전합니다.
   */

  interface Props {
    editor: EditorContext
    spec: ToolbarSelectSpec
  }

  const { editor, spec }: Props = $props()

  /** 안 따라가는 쪽만 칸을 갖습니다 — 따라가는 쪽 값의 출처는 문서입니다 */
  /*
   * 지금 값을 코어에 물어보는 구독입니다. `spec` 마다 묻는 것이 달라
   * 에디터 묶음(`editor-state.ts`)에 들어가지 않습니다 — 이 인스턴스가 곧
   * 그 spec 하나라 여기서 만드는 것이 맞습니다.
   */
  // svelte-ignore state_referenced_locally
  const queried = fromSelection(editor, () => spec.query?.(editor), undefined)

  const store = $derived(
    spec.initialValue === undefined
      ? null
      : choiceStore(editor, spec.title, spec.initialValue)
  )

  let value = $state(spec.initialValue ?? spec.options[0].value)

  /* 칸이 바뀌면 따라옵니다 — 더보기 메뉴가 같은 칸에 씁니다 */
  $effect(() => {
    if (!store) return
    return store.subscribe((next) => (value = next))
  })

  /** 목록에 없는 지금 값 — 있으면 맨 앞에 임시 항목으로 답니다 */
  let unlisted = $state<string | null>(null)

  $effect(() => {
    if (!spec.query) return
    const current = $queried

    if (current === undefined || current === '') {
      unlisted = null
      value = spec.fallbackValue ?? spec.options[0].value
      return
    }

    if (spec.options.some((option) => option.value === current)) {
      unlisted = null
      value = current
      return
    }

    /* 목록 밖 — 실제 값을 보여줄 수 있으면 그렇게 합니다 */
    if (spec.unlisted) {
      unlisted = current
      value = current
      return
    }

    unlisted = null
    value = spec.fallbackValue ?? spec.options[0].value
  })

  const save = (): void => {
    editor.selectionManager?.saveSelection()
  }
</script>

<select
  k="select"
  title={spec.title}
  aria-label={spec.title}
  bind:value
  onmousedown={save}
  onfocus={save}
  onchange={() => {
    store?.set(value)
    editor.selectionManager?.restoreSelection()
    spec.apply(editor, value)
  }}
>
  {#if unlisted !== null && spec.unlisted}
    <option value={unlisted}>{spec.unlisted(unlisted)}</option>
  {/if}
  {#each spec.options as option, index (index)}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>
