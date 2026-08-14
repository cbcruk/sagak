<script lang="ts">
  import { FontEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { subscribeToSelection } from '../hooks/use-selection-derived'
  import {
    $families as familiesStore,
    $status as statusStore,
    loadLocalFonts,
    watchLocalFontPermission,
  } from '../hooks/use-local-fonts'
  import { sameFontFamily } from '../components/font-family-select/font-family-select.utils'
  import {
    FALLBACK_FONTS,
    FALLBACK_GROUP,
    FIXED_WIDTH,
    LOAD_SYSTEM_FONTS_VALUE,
    SYSTEM_GROUP,
  } from '../components/font-family-select/font-family-select.shared'

  /**
   * 폰트 메뉴 — 이 저장소에서 **가장 까다로웠던 컨트롤**입니다.
   *
   * 목록이 실행 중에 바뀌고(시스템 폰트를 나중에 받아 옵니다), 그에 따라
   * **묶음이 있는 꼴과 없는 꼴을 오갑니다.** nanotags 판에서는 그 전환 때문에
   * `renderList` 가 반쪽이었고, 컨테이너(`<select>`/`<optgroup>`)를 손으로
   * 다시 세우는 코드가 붙어 있었습니다 (`containersFor`).
   *
   * `{#if}` 와 `{#each}` 로 옮기니 그 코드가 통째로 없어집니다. 꼴이 바뀌면
   * 마크업이 알아서 다시 그려지고, "지금 묶음 꼴인가" 를 따로 들고 있을
   * 이유도 없습니다. 이미지 다이얼로그에 이어 **방향 전환의 값이 눈에 보이는
   * 두 번째 자리**입니다.
   *
   * ## 폭을 고정합니다
   *
   * 목록이 실행 중에 늘어나므로, 안 고정하면 시스템 폰트가 들어오는 순간
   * 가장 긴 이름이 폭을 정하며 툴바가 밀립니다. 넘치는 이름은 말줄임으로
   * 자릅니다.
   *
   * ## 불러오기는 제스처 안에서
   *
   * 시스템 폰트 권한은 **사용자 제스처 안**이라야 물어볼 수 있습니다. 그래서
   * 목록의 마지막 항목을 고르는 것이 곧 요청입니다 — 고른 순간이 제스처입니다.
   *
   * ## 가드는 새로 만들지 않았습니다
   *
   * 선택 영역 구독은 `subscribeToSelection` 그대로입니다. IME 조합 중 무시,
   * 다음 프레임까지 지연, 에디터 밖이면 건너뜀 — 렌더러를 네 번 갈아타는
   * 동안 한 번도 안 바뀌었습니다.
   */

  interface Props {
    editor: EditorContext | null
  }

  const { editor }: Props = $props()

  interface Option {
    label: string
    value: string
  }

  let families = $state<readonly string[]>(familiesStore.get())
  let status = $state(statusStore.get())
  let value = $state(FALLBACK_FONTS[0].value)

  $effect(() => {
    const offFamilies = familiesStore.subscribe((next) => (families = next))
    const offStatus = statusStore.subscribe((next) => (status = next))
    /*
     * 권한 구독을 시작합니다 — 안 하면 이미 허용해 둔 사람에게도 목록이
     * 영영 안 옵니다.
     */
    watchLocalFontPermission()
    return () => {
      offFamilies()
      offStatus()
    }
  })

  const system: Option[] = $derived(
    families.map((family) => ({ label: family, value: family }))
  )

  /** 목록이 두 무리로 갈리는가 — 시스템 폰트가 하나라도 있으면 그렇습니다 */
  const grouped = $derived(system.length > 0)

  /** 아직 안 받아 왔으면 받아오는 항목을 마지막에 답니다 */
  const loader: Option[] = $derived(
    status === 'idle' || status === 'loading'
      ? [
          {
            label: status === 'loading' ? 'Loading fonts…' : 'System fonts…',
            value: LOAD_SYSTEM_FONTS_VALUE,
          },
        ]
      : []
  )

  /** 지금 값을 맞출 때 훑는 전체 목록 */
  const all: Option[] = $derived([...FALLBACK_FONTS, ...system, ...loader])

  function sync(): void {
    if (!editor) return
    const current =
      editor.commandRegistry?.queryValue('fontName') ??
      document.queryCommandValue('fontName')
    const matched = all.find((option) => sameFontFamily(option.value, current))
    value = matched ? matched.value : FALLBACK_FONTS[0].value
  }

  $effect(() => {
    if (!editor) return
    /* 목록이 바뀌면 고른 값도 다시 맞춥니다 */
    void all
    sync()
    return subscribeToSelection(editor, sync)
  })

  const save = (): void => {
    editor?.selectionManager?.saveSelection()
  }
</script>

<select
  k="select"
  title="Font Family"
  aria-label="Font Family"
  style="width: {FIXED_WIDTH}px; text-overflow: ellipsis"
  bind:value
  onmousedown={save}
  onfocus={save}
  onchange={() => {
    if (!editor) return
    if (value === LOAD_SYSTEM_FONTS_VALUE) {
      /* 사용자 제스처 안이라야 권한 요청이 통합니다 */
      loadLocalFonts()
      return
    }
    editor.selectionManager?.restoreSelection()
    editor.eventBus.emit(FontEvents.FONT_FAMILY_CHANGED, { fontFamily: value })
  }}
>
  {#if grouped}
    <optgroup label={FALLBACK_GROUP}>
      {#each FALLBACK_FONTS as option (option.value)}
        <option value={option.value} style="font-family: {option.value}"
          >{option.label}</option
        >
      {/each}
    </optgroup>
    <optgroup label={SYSTEM_GROUP}>
      {#each system as option (option.value)}
        <option value={option.value} style="font-family: {option.value}"
          >{option.label}</option
        >
      {/each}
      {#each loader as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </optgroup>
  {:else}
    {#each FALLBACK_FONTS as option (option.value)}
      <option value={option.value} style="font-family: {option.value}"
        >{option.label}</option
      >
    {/each}
    {#each loader as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  {/if}
</select>
