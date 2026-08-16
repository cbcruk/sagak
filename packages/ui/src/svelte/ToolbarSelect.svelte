<script lang="ts">
  import type { EditorContext } from 'sagak-core'
  import { subscribeToSelection } from '../state/selection'
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
   * | 안 따라가는 것 | 줄 간격·자간·문단 | 처음 값만 두고 그대로 둡니다 |
   *
   * 따라가는 쪽만 `subscribeToSelection` 을 씁니다. IME 조합 중 무시 같은
   * 가드가 거기 들어 있고, 이 구독은 렌더러를 네 번 갈아타는 동안 한 번도
   * 안 바뀌었습니다.
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
    editor: EditorContext | null
    spec: ToolbarSelectSpec
  }

  const { editor, spec }: Props = $props()

  let value = $state(spec.defaultValue ?? spec.options[0].value)

  $effect(() => {
    if (!editor || !spec.query) return
    const sync = (): void => {
      const current = spec.query?.(editor)
      const known =
        current !== undefined &&
        spec.options.some((option) => option.value === current)
      value = known
        ? (current as string)
        : (spec.fallbackValue ?? spec.options[0].value)
    }
    sync()
    return subscribeToSelection(editor, sync)
  })

  const save = (): void => {
    editor?.selectionManager?.saveSelection()
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
    if (!editor) return
    editor.selectionManager?.restoreSelection()
    spec.apply(editor, value)
  }}
>
  {#each spec.options as option, index (index)}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>
