import { define } from 'nanotags'
import { Minus } from 'lucide'
import { ContentEvents } from 'sagak-core'
import { editorContextKey } from './editor-context'
import { icon, toolbarButton } from './icon'

/**
 * 이벤트 하나만 쏘는 툴바 버튼 — 1단계에서 가장 단순한 갈래입니다.
 *
 * 폰트 메뉴(1번)가 어려운 쪽 끝을 재 봤다면, 여기는 **쉬운 쪽 끝**입니다.
 * 둘 사이에 나머지가 들어갑니다.
 *
 * ## 여기서 나온 것 — 아이콘
 *
 * 계획에서는 아이콘을 4단계(Preact 걷어내기)로 미뤄 뒀는데, **1단계 첫
 * 컴포넌트에서 바로 걸렸습니다.** `lucide-preact` 는 Preact 컴포넌트라 커스텀
 * 엘리먼트 안에서 못 씁니다. 형제 패키지 `lucide`(데이터만)를 들여 `icon()`
 * 으로 SVG 를 만듭니다.
 *
 * 즉 **아이콘을 쓰는 컴포넌트 15개는 전부 이 관문을 먼저 지납니다.** 계획의
 * 단계 나눔이 여기서 한 번 틀렸습니다.
 *
 * ## 상태 구독이 없습니다
 *
 * 이 버튼들은 누르면 이벤트를 쏠 뿐, 선택 영역에 따라 켜지고 꺼지지 않습니다.
 * 그래서 `subscribeToSelection` 이 필요 없고, 에디터 컨텍스트도 **쏠 때만**
 * 있으면 됩니다.
 */

const ICON_SIZE_RULE = 16

export const HORIZONTAL_RULE_BUTTON_TAG = 'sagak-horizontal-rule-button'

define(HORIZONTAL_RULE_BUTTON_TAG, (ctx) => {
  ctx.host.style.display = 'contents'

  const button = toolbarButton(
    { title: 'Insert Horizontal Rule' },
    icon(Minus, ICON_SIZE_RULE)
  )
  ctx.host.append(button)

  editorContextKey.consume(ctx, ($editor) => {
    ctx.on(button, 'click', () => {
      $editor.get()?.eventBus.emit(ContentEvents.HORIZONTAL_RULE_INSERT)
    })
  })
})
