<script lang="ts">
  import { FontEvents } from 'sagak-core'
  import type { EditorContext } from 'sagak-core'
  import { editorState } from '../state/editor-state'
  import {
    familiesStore,
    statusStore,
    loadLocalFonts,
    watchLocalFontPermission,
  } from '../state/local-fonts'
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
   * ## 소스가 둘입니다
   *
   * 지금 값은 **선택**(캐럿이 놓인 자리의 글꼴)과 **목록**(시스템 폰트가 들어오면
   * 늘어납니다) 양쪽에 딸려 있습니다. 그래서 짝짓기가 여기 남습니다 — 둘 다
   * 보는 자리가 여기뿐입니다. 각각의 구독은 `state/font-family.ts` 와
   * `state/local-fonts.ts` 가 갖습니다.
   *
   * 가드는 이제 없습니다. 바닥이 `subscribeToModel` 이라 문서 상태가 바뀔
   * 때만 흐르고, 그 상태는 애초에 이 에디터의 것입니다 — 예전에 필요했던
   * 셋(IME 조합 중 무시·다음 프레임까지 지연·에디터 밖이면 건너뜀)이 전부
   * "DOM 이 지금 믿을 만한가" 를 묻는 것이었습니다.
   */

  interface Props {
    editor: EditorContext
  }

  const { editor }: Props = $props()

  interface Option {
    label: string
    value: string
  }

  let value = $state(FALLBACK_FONTS[0].value)

  /* 캐럿이 놓인 자리의 글꼴 — 구독은 `state/font-family.ts` 가 갖습니다 */
  // svelte-ignore state_referenced_locally
  const { fontFamily } = editorState(editor)

  /*
   * 권한 구독을 시작합니다 — 안 하면 이미 허용해 둔 사람에게도 목록이
   * 영영 안 옵니다.
   */
  $effect(() => {
    watchLocalFontPermission()
  })

  const system: Option[] = $derived(
    $familiesStore.map((family) => ({ label: family, value: family }))
  )

  /** 목록이 두 무리로 갈리는가 — 시스템 폰트가 하나라도 있으면 그렇습니다 */
  const grouped = $derived(system.length > 0)

  /** 아직 안 받아 왔으면 받아오는 항목을 마지막에 답니다 */
  const loader: Option[] = $derived(
    $statusStore === 'idle' || $statusStore === 'loading'
      ? [
          {
            label: $statusStore === 'loading' ? 'Loading fonts…' : 'System fonts…',
            value: LOAD_SYSTEM_FONTS_VALUE,
          },
        ]
      : []
  )

  /** 지금 값을 맞출 때 훑는 전체 목록 */
  const all: Option[] = $derived([...FALLBACK_FONTS, ...system, ...loader])

  /* 선택이 움직여도, 목록이 늘어나도 고른 값을 다시 맞춥니다 */
  $effect(() => {
    const matched = all.find((option) =>
      sameFontFamily(option.value, $fontFamily)
    )
    value = matched ? matched.value : FALLBACK_FONTS[0].value
  })

  /*
   * **선택을 저장할 필요가 없어졌습니다.**
   *
   * 툴바를 누르면 포커스가 에디터를 떠나 브라우저 선택이 풀립니다. 그래서
   * `mousedown`·`focus` 에서 DOM 범위를 저장해 두고 적용 직전에 되돌렸습니다.
   *
   * 이제 선택은 문서 상태의 일부라 포커스와 무관하게 그대로 있습니다. 커맨드는
   * `state.selection` 위에서 돌고, 성공하면 `runCommand` 가 포커스를
   * 되돌려 줍니다 (`FOCUS_REQUESTED`).
   */
</script>

<select
  k="select"
  title="Font Family"
  aria-label="Font Family"
  style="width: {FIXED_WIDTH}px; text-overflow: ellipsis"
  bind:value
  onchange={() => {
    if (value === LOAD_SYSTEM_FONTS_VALUE) {
      /* 사용자 제스처 안이라야 권한 요청이 통합니다 */
      loadLocalFonts()
      return
    }
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
