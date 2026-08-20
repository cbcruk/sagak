import { describe, it, expect, afterEach } from 'vitest'
import { EVENT_KIND, type EventKind } from 'sagak-core'
import { mountEditor, settle, type MountedEditor } from './harness'

/**
 * 이벤트 계약 — 요청에는 처리자가 있어야 합니다.
 *
 * ## 76 → 25 종
 *
 * 서식 32종이 통째로 없어졌습니다. 굵게·글꼴·정렬·목록·표·이미지·링크가 전부
 * 커맨드가 됐고, 툴바는 커맨드 레지스트리를 직접 부릅니다. 이름이 문자열이던
 * 것이 타입이 되면서 **오타를 컴파일러가 잡습니다** — 이 검사가 있던 이유의
 * 절반이 그렇게 없어졌습니다.
 *
 * 남은 것은 커맨드가 아닌 일들입니다 — 되돌리기·찾기·자동 저장·자동 완성,
 * 그리고 밖에서 붙을 확장점.
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
 * ## 처음 돌렸을 때 잡힌 것 (지금은 이벤트가 아닙니다)
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
        !eventBus.hasHandlers(name) &&
        !eventBus.hasHandlers(name) &&
        !eventBus.hasHandlers(name)
    )

    expect(unhandled, `처리자 없는 요청: ${unhandled.join(', ')}`).toEqual([])
  })

  it('분류가 3종 전부를 덮어야 함', async () => {
    // `EVENT_KIND` 는 `Record<KnownEventName, …>` 라 컴파일러가 이미 막지만,
    // 실제로 몇 종인지 눈에 보이게 남겨 둡니다.
    //
    // 25 → 19: 찾기/바꾸기 여섯이 `findReplace(editor)` 의 메서드가 됐습니다.
    // 19 → 15: 자동 완성 넷이 `autocomplete(editor)` 가 됐습니다.
    // 15 → 11: 이미지 업로드 넷 — 알림 셋은 같은 것을 알리는 콜백이 이미
    //          있었고, 요청 하나는 아무도 안 불렀습니다 (`imageUpload`).
    // 11 → 8:  자동 저장 셋 (`autoSave`). 상태 알림은 `subscribe`·`report`,
    //          지우기는 메서드, 복원은 아무도 안 부르던 요청이었습니다.
    // 8 → 6:   이미지 조절 둘. 아무도 안 들었고 짝이 되는 콜백조차 없었습니다
    //          — 조절이 남기는 것은 이제 문서의 width·height 입니다.
    // 6 → 4:   APP_READY(아무도 안 들음)·FOCUS_REQUESTED(아무도 안 발행).
    //          둘 다 제품 코드에서 한쪽 끝이 비어 있었습니다.
    // 4 → 3:   내보내기 (`exporter`). 죽은 배선은 아니었고, 메뉴 하나가
    //          플러그인 하나에게 말을 거는 일이었습니다.
    // 이 숫자는 **줄어들 예정**입니다 — 남은 것들도 대부분 에디터 바깥 UI 와의
    // 대화라, 차례로 모듈 API 로 옮깁니다.
    const total = Object.keys(EVENT_KIND).length
    expect(total).toBe(3)
    expect(byKind('request').length + byKind('notify').length).toBe(total)
  })

  /**
   * Why: 아무도 안 듣는 알림은 **없어야 합니다** — 있으면 죽은 코드거나
   *      아직 못 이은 자리입니다. 5단계에서 여섯을 지우고 남은 것들이
   *      정말 들리는지 여기서 못 박습니다.
   * How: 앱을 통째로 띄우고 `notify` 전부의 처리자를 셉니다.
   *
   * 다만 **처리자가 없어도 되는 알림**이 있습니다 — 모델이나 DOM 에서 얻을 수
   * 없는 것을 실어 나르는 확장점입니다. 그것들은 여기 예외로 적어 둡니다.
   *
   * 이미지 업로드 셋이 여기 있었는데, 세어 보니 **같은 것을 알리는 콜백이
   * 옵션에 이미 있었습니다.** 확장점이 두 벌이면 한 벌은 안 쓰입니다 —
   * 이벤트 쪽이 그랬습니다. 콜백만 남겼습니다.
   */
  it('아무도 안 듣는 알림은 확장점뿐이어야 함', async () => {
    ed = await mountEditor(undefined, {
      autoSave: true,
      showAutoSaveIndicator: true,
    })
    await settle(6)

    /* 임베더가 붙을 자리 — 문서에도 DOM 에도 없는 것을 실어 나릅니다 */
    const EXTENSION_POINTS = [
      'EDITOR_ERROR',
      /*
       * **여기 방금 들어왔습니다.**
       *
       * 마지막 청취자는 자동 저장이었습니다 — 두 리사이즈가 DOM 에만 써서
       * 트랜잭션이 안 났고, 그래서 저장을 따로 깨워야 했기 때문입니다. 둘을
       * 모델로 옮기니 그 이유가 없어졌습니다.
       *
       * "어떤 커맨드가 돌았는가" 는 모델에도 DOM 에도 없는 값이라 규칙상으로는
       * 확장점이 맞습니다. 다만 지금 쓰는 곳이 하나도 없으므로 **남길지는
       * 따로 판단합니다** (`docs/prosemirror-migration.md` §12-5).
       */
      'STYLE_CHANGED',
    ]

    const { eventBus } = ed.context
    const unheard = byKind('notify').filter(
      (name) =>
        !eventBus.hasHandlers(name) &&
        !eventBus.hasHandlers(name) &&
        !eventBus.hasHandlers(name)
    )

    const surprises = unheard.filter((n) => !EXTENSION_POINTS.includes(n))

    expect(surprises, `아무도 안 듣는 알림: ${surprises.join(', ')}`).toEqual([])
  })
})
