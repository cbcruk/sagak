import { define } from 'nanotags'
import { FontEvents } from 'sagak-core'
import { renderList } from 'nanotags/render'
import { editorContextKey } from './editor-context'
import {
  $families,
  $status,
  loadLocalFonts,
  watchLocalFontPermission,
} from '../hooks/use-local-fonts'
import { subscribeToSelection } from '../hooks/use-selection-derived'
import { sameFontFamily } from '../components/font-family-select/font-family-select.utils'
import {
  FALLBACK_FONTS,
  FIXED_WIDTH,
  LOAD_SYSTEM_FONTS_VALUE,
  SYSTEM_GROUP,
  FALLBACK_GROUP,
} from '../components/font-family-select/font-family-select.shared'

/**
 * 폰트 메뉴 — nanotags 로 옮긴 **첫 컴포넌트**입니다.
 *
 * 고른 이유는 어려워서입니다. 런타임에 길이가 변하는 목록, `<optgroup>`, 에디터
 * 컨텍스트, 선택 영역 구독을 전부 씁니다. 쉬운 것부터 옮기면 정작 막히는 자리를
 * 늦게 만납니다.
 *
 * ## 이주하면서 알게 된 규칙 셋 (문서에 없습니다)
 *
 * **① 엘리먼트가 자기 마크업을 직접 만들어야 합니다.**
 * nanotags 의 `withRefs` 는 `connectedCallback` 시점에 자식을 찾습니다. 그런데
 * Preact 는 엘리먼트를 붙인 **뒤에** 자식을 채웁니다. 그래서 바깥에서 마크업을
 * 넣어 주는 방식은 `Missing elements for refs` 로 죽습니다. 문서의 예제는 전부
 * 서버가 그려 둔 마크업을 전제하고, 나중에 refs 를 다시 푸는 방법은 **없습니다.**
 *
 * **② `<template>` 은 `renderList` 컨테이너 바깥에 둬야 합니다.**
 * "컨테이너의 자식 중 이번 사이클에 속하지 않은 것은 전부 지운다"가 규약이라,
 * 안에 두면 첫 렌더에서 템플릿이 사라집니다.
 *
 * **③ 묶음이 있는 `<select>` 에는 `renderList` 가 반쪽입니다.**
 * 컨테이너 하나를 통째로 소유하는 모델이라 `<optgroup>` 두 개는 컨테이너 두
 * 개가 됩니다. 게다가 이 메뉴는 시스템 폰트 유무에 따라 **묶음이 있는 꼴과
 * 없는 꼴을 오갑니다.** 그 전환은 결국 손으로 DOM 을 다시 세워야 합니다.
 * 즉 이 컴포넌트에서 nanotags 가 준 것은 렌더링이 아니라 **커스텀 엘리먼트
 * 껍데기와 nanostores 배선**입니다.
 *
 * ## 가드는 새로 만들지 않았습니다
 *
 * 선택 영역 구독은 `subscribeToSelection` 을 그대로 씁니다. IME 조합 중 무시,
 * 다음 프레임까지 지연, 에디터 밖이면 건너뜀 — 이 셋은 원래부터 Preact 를 안
 * 쓰고 있었습니다. 다시 구현했다면 그게 이주의 진짜 위험이었을 겁니다.
 */

export const FONT_FAMILY_SELECT_TAG = 'sagak-font-family-select'

interface Option {
  label: string
  value: string
  group?: string
}

define(FONT_FAMILY_SELECT_TAG, (ctx) => {
  ctx.host.style.display = 'contents'

  /* ① 자기 마크업을 자기가 만듭니다 */
  ctx.host.innerHTML = `<select></select><template><option></option></template>`

  const select = ctx.getElement<HTMLSelectElement>(ctx.host, 'select')
  /* ② 템플릿은 컨테이너(select/optgroup) 바깥 — host 직속입니다 */
  const template = ctx.getElement<HTMLTemplateElement>(ctx.host, 'template')

  select.setAttribute('k', 'select')
  select.title = 'Font Family'
  select.setAttribute('aria-label', 'Font Family')
  select.style.width = `${FIXED_WIDTH}px`
  select.style.textOverflow = 'ellipsis'

  let options: Option[] = []
  /** 지금 DOM 이 묶음 꼴인지 — 꼴이 바뀔 때만 다시 세웁니다 */
  let grouped: boolean | null = null

  function currentOptions(): Option[] {
    const families = $families.get()
    const status = $status.get()
    const system: Option[] = families.map((family) => ({
      label: family,
      value: family,
      group: SYSTEM_GROUP,
    }))

    const next: Option[] =
      system.length > 0
        ? [
            ...FALLBACK_FONTS.map((f) => ({ ...f, group: FALLBACK_GROUP })),
            ...system,
          ]
        : [...FALLBACK_FONTS]

    if (status === 'idle' || status === 'loading') {
      next.push({
        label: status === 'loading' ? 'Loading fonts…' : 'System fonts…',
        value: LOAD_SYSTEM_FONTS_VALUE,
        group: system.length > 0 ? SYSTEM_GROUP : undefined,
      })
    }

    return next
  }

  /** ③ 묶음 꼴이 바뀌면 컨테이너부터 다시 세웁니다 */
  function containersFor(next: Option[]): Map<string | undefined, Element> {
    const wantsGroups = next.some((o) => o.group !== undefined)

    if (grouped !== wantsGroups) {
      grouped = wantsGroups
      select.replaceChildren()
      if (wantsGroups) {
        for (const label of [FALLBACK_GROUP, SYSTEM_GROUP]) {
          const group = document.createElement('optgroup')
          group.label = label
          select.append(group)
        }
      }
    }

    const map = new Map<string | undefined, Element>()
    if (!wantsGroups) {
      map.set(undefined, select)
    } else {
      for (const group of select.querySelectorAll('optgroup')) {
        map.set(group.label, group)
      }
    }
    return map
  }

  function paint(): void {
    options = currentOptions()
    const containers = containersFor(options)

    for (const [key, container] of containers) {
      renderList(container, template, {
        data: options.filter((o) => o.group === key),
        key: (option) => option.value,
        update: (el, option) => {
          const el2 = el as HTMLOptionElement
          el2.value = option.value
          el2.textContent = option.label
          /* 각 항목을 자기 폰트로 그려 미리보기가 되게 합니다 */
          el2.style.fontFamily =
            option.value === LOAD_SYSTEM_FONTS_VALUE ? '' : option.value
        },
      })
    }
  }

  ctx.effect($status, paint)
  ctx.effect($families, paint)

  editorContextKey.consume(ctx, ($editor) => {
    ctx.effect($editor, (editor) => {
      if (!editor) return

      const sync = (): void => {
        const current =
          editor.commandRegistry?.queryValue('fontName') ??
          document.queryCommandValue('fontName')
        const matched = options.find((option) =>
          sameFontFamily(option.value, current)
        )
        select.value = matched ? matched.value : FALLBACK_FONTS[0].value
      }

      /* 툴바를 누르면 포커스가 에디터를 떠나므로 그 전에 선택을 저장합니다 */
      const save = (): void => {
        editor.selectionManager?.saveSelection()
      }
      ctx.on(select, 'mousedown', save)
      ctx.on(select, 'focus', save)

      ctx.on(select, 'change', () => {
        const value = select.value
        if (value === LOAD_SYSTEM_FONTS_VALUE) {
          /* 사용자 제스처 안이라야 권한 요청이 통합니다 */
          loadLocalFonts()
          return
        }
        editor.selectionManager?.restoreSelection()
        editor.eventBus.emit(FontEvents.FONT_FAMILY_CHANGED, {
          fontFamily: value,
        })
      })

      sync()
      ctx.onCleanup(subscribeToSelection(editor, sync))
      /* 목록이 바뀌면 고른 값도 다시 맞춥니다 */
      ctx.effect($families, sync)
    })
  })

  /*
   * 권한 구독을 시작합니다. 예전에는 Preact 훅이 이걸 했는데, 그 훅이 더는
   * 안 그려지므로 여기서 시작해야 합니다 — 안 하면 목록이 영영 안 옵니다.
   */
  watchLocalFontPermission()

  paint()
})
