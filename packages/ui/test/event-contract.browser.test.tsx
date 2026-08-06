import { describe, it, expect, afterEach } from 'vitest'
import { EVENT_KIND, type EventKind } from 'sagak-core'
import { mountEditor, settle, type MountedEditor } from './harness'

/**
 * 이벤트 계약 — 요청에는 처리자가 있어야 합니다.
 *
 * 버스 하나가 요청(`request`)과 통지(`notify`) 를 겸하는데 이름으로는 구분되지
 * 않습니다. `_CHANGED` 16종 중 7종이 화면→코어 요청이고 9종만 코어→화면
 * 통지입니다. 그 구분을 `EVENT_KIND` 에 적어 뒀고, 여기서 **반증 가능하게**
 * 만듭니다.
 *
 * `request` 는 처리자가 없으면 아무 일도 일어나지 않습니다 — 눌러도 반응 없는
 * 버튼이 그것입니다. 앱을 통째로 띄운 상태에서 전부 확인합니다.
 *
 * 이 테스트는 **분류가 맞는지도 함께 검사합니다.** 어떤 이벤트를 `request` 로
 * 적었는데 아무도 안 듣는다면, 죽은 요청이거나 분류가 틀린 것입니다. 둘 다
 * 알아야 할 일입니다.
 *
 * ## 처음 돌렸을 때 잡힌 것
 *
 * `AUTO_SAVE_RESTORE` 와 `AUTO_SAVE_CLEAR` 에 처리자가 없었습니다.
 *
 * `createEditor` 의 `autoSave` 기본값이 `false` 라 자동 저장 플러그인이 아예
 * 등록되지 않는데, `AutoSaveIndicator` 는 앱(`apps/editor/src/app.tsx`)과
 * harness 양쪽에 마운트돼 있고 `useAutoSave` 가 이 두 이벤트를 발행합니다.
 * **켜 준 적이 없으니 아무 데도 닿지 않습니다.**
 *
 * 여기서는 플러그인을 켜고 계약만 검사합니다 — 앱이 자동 저장을 켤지는
 * 제품 결정이고, 켜면 localStorage 에 사용자 글이 쌓이므로 이 리팩토링이
 * 대신 정할 일이 아닙니다.
 */
describe('이벤트 계약', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  const byKind = (kind: EventKind): string[] =>
    Object.entries(EVENT_KIND)
      .filter(([, k]) => k === kind)
      .map(([name]) => name)
      .sort()

  it('요청 이벤트는 앱이 떠 있는 동안 전부 처리자를 가져야 함', async () => {
    // 자동 저장은 켜 줘야 플러그인이 붙습니다 (위 "처음 돌렸을 때 잡힌 것")
    ed = await mountEditor(undefined, { autoSave: true })
    await settle(6)

    const { eventBus } = ed.context
    const requests = byKind('request')

    // 어느 단계에 붙었든 처리자면 됩니다
    const unhandled = requests.filter(
      (name) =>
        !eventBus.hasHandlers(name, 'before') &&
        !eventBus.hasHandlers(name, 'on') &&
        !eventBus.hasHandlers(name, 'after')
    )

    expect(unhandled, `처리자 없는 요청: ${unhandled.join(', ')}`).toEqual([])
  })

  it('분류가 76종 전부를 덮어야 함', async () => {
    // `EVENT_KIND` 는 `Record<KnownEventName, …>` 라 컴파일러가 이미 막지만,
    // 실제로 몇 종인지 눈에 보이게 남겨 둡니다
    const total = Object.keys(EVENT_KIND).length
    expect(total).toBe(76)
    expect(byKind('request').length + byKind('notify').length).toBe(total)
  })
})
