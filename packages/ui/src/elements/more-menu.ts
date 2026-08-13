import { define } from 'nanotags'
import {
  Ellipsis,
  Link,
  Image,
  Table,
  Minus,
  Type,
  Search,
  Subscript,
  Superscript,
  ALargeSmall,
  CaseSensitive,
} from 'lucide'
import type { IconNode } from 'lucide'
import { ContentEvents, TextStyleEvents } from 'sagak-core'
import type { EditorContext } from 'sagak-core'
import { editorContextKey } from './editor-context'
import { icon } from './icon'

/**
 * 좁은 화면에서 감춰진 기능들로 가는 메뉴 — 1단계의 **마지막** 컴포넌트입니다.
 *
 * ## 열 개 중 일곱이 아무것도 안 합니다
 *
 * 옮기면서 읽다가 나왔습니다. 링크·이미지·표·특수문자·찾기·줄 간격·자간은
 * **빈 함수**입니다 (`// Link dialog will be triggered separately`). 좁은
 * 화면에서는 이 메뉴가 그 기능들에 닿는 유일한 길인데(툴바에서
 * `mobile-hidden`) 눌러도 아무 일이 없습니다.
 *
 * **여기서 고치지 않았습니다.** 이주는 동작을 같게 두는 것이 먼저입니다.
 * 살리려면 다이얼로그들을 열 수단이 필요한데, 그 다이얼로그들이 전부 kinu
 * `Dialog` 라 **2단계 관문 뒤의 일**입니다. 그때 같이 봐야 합니다.
 *
 * 지금은 죽은 것을 **죽은 채로, 눈에 보이게** 남깁니다 — 아래 `TODO_ITEM` 이
 * 그 표시입니다.
 */

export const MORE_MENU_TAG = 'sagak-more-menu'

const ICON_SIZE = 16

/** 아직 안 이어진 항목 — 누르면 메뉴만 닫힙니다 */
const TODO_ITEM = undefined

/**
 * 쏘는 이벤트를 **실제로 있는 셋으로 좁혀** 둡니다.
 *
 * `string` 으로 두면 오타가 통과하고, 발행할 때 `as never` 같은 캐스팅이
 * 필요해집니다 — 이벤트 맵의 타입 검사를 스스로 꺼 버리는 셈입니다.
 */
type MenuEvent =
  | typeof ContentEvents.HORIZONTAL_RULE_INSERT
  | typeof TextStyleEvents.TOGGLE_SUBSCRIPT
  | typeof TextStyleEvents.TOGGLE_SUPERSCRIPT

interface Item {
  node: IconNode
  label: string
  emit?: MenuEvent
}

interface Section {
  title: string
  items: Item[]
}

const SECTIONS: Section[] = [
  {
    title: 'Insert',
    items: [
      { node: Link, label: 'Link', emit: TODO_ITEM },
      { node: Image, label: 'Image', emit: TODO_ITEM },
      { node: Table, label: 'Table', emit: TODO_ITEM },
      {
        node: Minus,
        label: 'Horizontal Rule',
        emit: ContentEvents.HORIZONTAL_RULE_INSERT,
      },
      { node: Type, label: 'Special Character', emit: TODO_ITEM },
    ],
  },
  {
    title: 'Text Style',
    items: [
      {
        node: Subscript,
        label: 'Subscript',
        emit: TextStyleEvents.TOGGLE_SUBSCRIPT,
      },
      {
        node: Superscript,
        label: 'Superscript',
        emit: TextStyleEvents.TOGGLE_SUPERSCRIPT,
      },
    ],
  },
  {
    title: 'Format',
    items: [
      { node: ALargeSmall, label: 'Line Height', emit: TODO_ITEM },
      { node: CaseSensitive, label: 'Letter Spacing', emit: TODO_ITEM },
    ],
  },
  {
    title: 'Tools',
    items: [{ node: Search, label: 'Find & Replace', emit: TODO_ITEM }],
  },
]

define(MORE_MENU_TAG, (ctx) => {
  const container = document.createElement('div')
  container.style.position = 'relative'
  ctx.host.append(container)

  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.dataset.scope = 'more-menu'
  trigger.dataset.part = 'trigger'
  trigger.title = 'More options'
  trigger.append(icon(Ellipsis, ICON_SIZE))
  container.append(trigger)

  const menu = document.createElement('div')
  menu.dataset.scope = 'more-menu'
  menu.dataset.part = 'menu'

  let open = false

  function close(): void {
    open = false
    menu.remove()
  }

  /** 메뉴 안쪽은 한 번만 만들면 됩니다 — 항목이 바뀌지 않습니다 */
  function build(run: (item: Item) => void): void {
    for (const section of SECTIONS) {
      const group = document.createElement('div')
      group.dataset.scope = 'more-menu'
      group.dataset.part = 'section'

      const title = document.createElement('div')
      title.dataset.scope = 'more-menu'
      title.dataset.part = 'section-title'
      title.textContent = section.title
      group.append(title)

      for (const item of section.items) {
        const button = document.createElement('button')
        button.type = 'button'
        button.dataset.scope = 'more-menu'
        button.dataset.part = 'item'

        const label = document.createElement('span')
        label.textContent = item.label
        button.append(icon(item.node, ICON_SIZE), label)
        button.addEventListener('click', () => run(item))
        group.append(button)
      }

      menu.append(group)
    }
  }

  editorContextKey.consume(ctx, ($editor) => {
    ctx.effect($editor, (editor: EditorContext | null) => {
      if (!editor) return
      if (menu.childElementCount === 0) {
        build((item) => {
          /*
           * 안 이어진 항목도 **메뉴는 닫습니다.** Preact 판이 그랬습니다 —
           * 빈 함수를 부르고 곧바로 닫습니다. 여기서 안 닫으면 옮기면서
           * 동작이 달라집니다.
           */
          if (item.emit) editor.eventBus.emit(item.emit)
          close()
        })
      }

      ctx.on(trigger, 'click', () => {
        if (open) {
          close()
          return
        }
        container.append(menu)
        open = true
      })

      ctx.on(document, 'mousedown', (domEvent) => {
        if (!open) return
        if (container.contains(domEvent.target as Node)) return
        close()
      })
    })
  })
})
