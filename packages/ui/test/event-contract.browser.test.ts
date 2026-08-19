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
 * 등록되지 않는데, `AutoSaveIndicator` 는 앱과 harness 양쪽에 마운트돼 있고
 * `useAutoSave` 가 이 두 이벤트를 발행하고 있었습니다. 켜 준 적이 없으니
 * 아무 데도 닿지 않았습니다.
 *
 * **앱은 이제 켰습니다** (`apps/editor/src/app.tsx`, `restoreOnInit: true`).
 * harness 는 여전히 끕니다 — 테스트마다 localStorage 를 건드리면 서로
 * 간섭하므로 필요한 테스트만 켜고 `storageKey` 를 따로 줍니다
 * (`auto-save.browser.test.tsx` 참고). 그래서 여기서도 명시적으로 켭니다.
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

  it('분류가 68종 전부를 덮어야 함', async () => {
    // `EVENT_KIND` 는 `Record<KnownEventName, …>` 라 컴파일러가 이미 막지만,
    // 실제로 몇 종인지 눈에 보이게 남겨 둡니다
    const total = Object.keys(EVENT_KIND).length
    expect(total).toBe(68)
    expect(byKind('request').length + byKind('notify').length).toBe(total)
  })

  /**
   * Why: 아무도 안 듣는 알림은 **없어야 합니다** — 있으면 죽은 코드거나
   *      아직 못 이은 자리입니다. 5단계에서 여섯을 지우고 남은 것들이
   *      정말 들리는지 여기서 못 박습니다.
   * How: 앱을 통째로 띄우고 `notify` 전부의 처리자를 셉니다.
   *
   * 다만 **처리자가 없어도 되는 알림**이 있습니다 — 모델이나 DOM 에서 얻을 수
   * 없는 것을 실어 나르는 확장점입니다. 붙여넣기 가로채기, 이미지 업로드
   * 진행이 그렇습니다. 그것들은 여기 예외로 적어 둡니다.
   */
  it('아무도 안 듣는 알림은 확장점뿐이어야 함', async () => {
    ed = await mountEditor(undefined, {
      autoSave: true,
      showAutoSaveIndicator: true,
    })
    await settle(6)

    /* 임베더가 붙을 자리 — 문서에도 DOM 에도 없는 것을 실어 나릅니다 */
    const EXTENSION_POINTS = [
      'APP_READY',
      'EDITOR_ERROR',
      'IMAGE_RESIZE_START',
      'IMAGE_RESIZE_END',
      'IMAGE_UPLOAD_START',
      'IMAGE_UPLOAD_COMPLETE',
      'IMAGE_UPLOAD_ERROR',
      'WYSIWYG_AREA_HIDDEN',
      'WYSIWYG_FOCUSED',
      'WYSIWYG_PASTE',
    ]

    const { eventBus } = ed.context
    const unheard = byKind('notify').filter(
      (name) =>
        !eventBus.hasHandlers(name, 'before') &&
        !eventBus.hasHandlers(name, 'on') &&
        !eventBus.hasHandlers(name, 'after')
    )

    const surprises = unheard.filter((n) => !EXTENSION_POINTS.includes(n))

    expect(surprises, `아무도 안 듣는 알림: ${surprises.join(', ')}`).toEqual([])
  })
})
