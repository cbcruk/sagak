import { signal } from '@preact/signals'

/**
 * 시스템에 설치된 폰트를 읽어옵니다 — Local Font Access API.
 *
 * ## 왜 필요한가
 *
 * 폰트 메뉴는 이름 6개가 **하드코딩**돼 있습니다. 그 이름이 그 기계에 실제로
 * 있는지는 아무도 안 봅니다. 이 컨테이너에서 재 보면 6개 중 실제로 설치된 것은
 * **0개**입니다 — Arial·Times·Courier·Helvetica 는 fontconfig 가 Liberation 계열로
 * 바꿔치기한 것이고, Georgia·Verdana 는 아예 없어서 일반 글꼴로 떨어집니다.
 * 사용자는 이름을 골랐는데 다른 글꼴을 받고, 알려주는 것도 없습니다.
 *
 * `queryLocalFonts()` 는 그 기계에 **정말 있는** 목록을 돌려줍니다. 같은
 * 컨테이너에서 항목 48개 / family 22개가 나옵니다.
 *
 * ## 실측한 제약
 *
 * | 조건 | 결과 |
 * | --- | --- |
 * | 권한 `prompt` + 제스처 없음 | `SecurityError: User activation is required.` |
 * | 권한 `prompt` + 제스처 안 | 권한 대화상자를 기다리며 **무한정 매답니다** |
 * | 권한 `granted` | 제스처 **없이도** 됩니다 (클릭 6초 뒤에도 성공) |
 * | 권한 `denied` | **거절해도 예외가 아닙니다 — 빈 배열이 옵니다** |
 *
 * 셋째 줄이 이 훅의 모양을 정합니다 — **처음 한 번만** 사용자 제스처가
 * 필요하고, 허용한 뒤로는 물어보지 않고 불러올 수 있습니다.
 *
 * 넷째 줄 때문에 `denied` 라는 상태를 **두지 않습니다.** 처음엔 뒀다가
 * 지웠습니다 — 거절을 예외로 알아채는 코드를 썼는데 실측해 보니 그 길로는
 * 아무것도 오지 않았고, 그 분기는 죽은 코드였습니다. 대조군에서 그 분기를
 * 망가뜨려도 테스트가 하나도 안 깨져서 드러났습니다.
 *
 * 거절과 "정말 폰트가 없음" 은 **여기서 구분되지 않고, 구분할 필요도 없습니다.**
 * 둘 다 보여줄 것이 없다는 뜻이고 화면에 나타나는 결과가 같습니다.
 *
 * 그리고 매다는 경우가 있으므로 `loading` 이 영원히 끝나지 않을 수 있습니다.
 * 부르는 쪽은 그동안에도 **기본 목록으로 계속 쓸 수 있어야** 합니다.
 *
 * ## 왜 컴포넌트 상태가 아닌가
 *
 * **설치된 폰트 목록은 그 기계의 사실이지 이 컴포넌트의 상태가 아닙니다.**
 *
 * 처음엔 `useState` + `useEffect` 로 썼는데, 그러면 컴포넌트마다 자기 사본을
 * 갖습니다. 재 봤습니다 — 같은 훅을 쓰는 컴포넌트 **3개를 띄우면
 * `queryLocalFonts()` 가 3번, 권한 조회도 3번** 나갑니다. 떴다 사라지기를
 * 3번 반복해도 3번씩입니다. 지금은 폰트 메뉴가 하나뿐이라 눈에 안 보일 뿐,
 * 세는 자리가 틀려 있습니다.
 *
 * 그래서 상태를 **모듈 수준 시그널**로 올렸습니다. 그러면 —
 *
 * | 없어진 것 | 왜 없어도 되는가 |
 * | --- | --- |
 * | 자동 로드 `useEffect` | 구독 대상이 컴포넌트 생애와 무관합니다 |
 * | 언마운트 가드 `useRef` | 늦게 온 응답이 **모듈**을 갱신하는 건 정상입니다 |
 * | `useCallback` | 모듈 함수라 처음부터 동일 참조입니다 |
 *
 * 언마운트 가드가 사라진 것이 특히 중요합니다. 그건 원래 있던 문제를 가린 게
 * 아니라, **상태가 컴포넌트에 붙어 있었기 때문에만 생기던 문제**였습니다.
 *
 * ## 권한이 바뀌면 따라갑니다
 *
 * `PermissionStatus` 의 `change` 가 실제로 오는 것을 확인했습니다 (허용 → 거절
 * → 허용 을 CDP 로 오가며 세 번 다 받았습니다). 그래서 —
 *
 * - 허용으로 바뀌면 **바로 불러옵니다** (예전 판은 그 자리에서 다시 마운트되기
 *   전까지 몰랐습니다)
 * - 거절로 바뀌면 **들고 있던 목록을 버립니다** (예전 판은 이미 못 쓰게 된
 *   목록을 계속 보여줬습니다)
 *
 * 둘 다 예전 `useEffect` 판에는 없던 동작입니다. 효과를 없애면서 덤으로 얻은
 * 게 아니라, 구독을 제자리에 두니 자연스럽게 따라온 것입니다.
 */

export type LocalFontsStatus = 'unsupported' | 'idle' | 'loading' | 'ready'

export interface UseLocalFontsReturn {
  status: LocalFontsStatus
  /**
   * 중복을 없애고 정렬한 family 이름들.
   *
   * `status === 'ready'` 여도 **빌 수 있습니다** — 거절당했거나 읽을 폰트가
   * 없는 경우입니다.
   */
  families: string[]
  /**
   * 목록을 읽어옵니다.
   *
   * 아직 허용 전이라면 **사용자 제스처 안에서** 불러야 합니다 — 클릭 핸들러나
   * `<select>` 의 `change` 핸들러 안이면 됩니다 (둘 다 실측했습니다).
   *
   * 겹쳐 불러도 **한 번만 나갑니다.**
   */
  load: () => void
}

interface FontData {
  family: string
}

type QueryLocalFonts = () => Promise<FontData[]>

function queryFn(): QueryLocalFonts | null {
  const fn = (window as unknown as { queryLocalFonts?: QueryLocalFonts })
    .queryLocalFonts
  return typeof fn === 'function' ? fn : null
}

function uniqueFamilies(fonts: FontData[]): string[] {
  return [...new Set(fonts.map((font) => font.family))].sort((a, b) =>
    a.localeCompare(b)
  )
}

/*
 * 기계 하나에 목록도 하나입니다. 컴포넌트가 몇 개든 여기를 같이 봅니다.
 */
const statusSignal = signal<LocalFontsStatus>(
  queryFn() ? 'idle' : 'unsupported'
)
const familiesSignal = signal<string[]>([])

/** 진행 중인 호출 — 같은 요청이 겹쳐 나가지 않게 합니다 */
let inFlight: Promise<void> | null = null

function load(): void {
  const query = queryFn()
  /*
   * 겹친 호출만 막습니다. `ready` 라고 해서 건너뛰면 안 됩니다 — 빈 손으로
   * 끝난 뒤에 사용자가 권한을 허용한 경우가 정확히 그 상황이고, 그때는 답이
   * 달라졌으므로 다시 물어야 합니다.
   *
   * 처음엔 `ready` 도 건너뛰게 뒀다가 "한 번 허용했으면 다음부터는 누르지
   * 않아도 들어옵니다" 테스트가 잡았습니다.
   */
  if (!query || inFlight) return

  statusSignal.value = 'loading'
  inFlight = query()
    .then((fonts) => {
      familiesSignal.value = uniqueFamilies(fonts)
      statusSignal.value = 'ready'
    })
    .catch((error: Error) => {
      /*
       * `SecurityError` 는 제스처가 없었다는 뜻일 뿐이라 `idle` 로 되돌려
       * 다시 받을 수 있게 합니다 (실측한 유일한 예외입니다).
       *
       * 나머지는 한 번 해 봤다는 사실만 남깁니다 — 목록이 비어 있으므로
       * 보여줄 것이 없고, 다시 조르지도 않습니다.
       */
      statusSignal.value = error.name === 'SecurityError' ? 'idle' : 'ready'
    })
    .finally(() => {
      inFlight = null
    })
}

/** 권한이 사라졌으면 들고 있던 목록도 버립니다 */
function forget(): void {
  familiesSignal.value = []
  statusSignal.value = 'idle'
}

let watching = false

/**
 * 권한을 한 번만 구독합니다.
 *
 * 훅이 처음 불릴 때 시작합니다 — 모듈을 읽는 것만으로 `navigator` 를 건드리지
 * 않도록, 그리고 폰트 메뉴가 화면에 없으면 아무것도 안 하도록.
 */
function watchPermission(): void {
  if (watching || !queryFn()) return
  watching = true

  navigator.permissions
    ?.query({ name: 'local-fonts' as PermissionName })
    .then((permission) => {
      permission.addEventListener('change', () => {
        if (permission.state === 'granted') load()
        else forget()
      })

      // 이미 허용돼 있으면 지금 불러옵니다
      if (permission.state === 'granted') load()
    })
    .catch(() => {
      // 이 이름을 모르는 브라우저 — 제스처를 받는 길만 남습니다
    })
}

export function useLocalFonts(): UseLocalFontsReturn {
  watchPermission()

  /*
   * `.value` 를 읽는 것만으로 이 컴포넌트가 구독됩니다. 훅은 모듈 상태를
   * 비추기만 하고 자기 상태를 갖지 않습니다.
   */
  return {
    status: statusSignal.value,
    families: familiesSignal.value,
    load,
  }
}
