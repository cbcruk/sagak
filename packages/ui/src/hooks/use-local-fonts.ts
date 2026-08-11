import { signal } from '@preact/signals'
import { supportsKorean } from './use-local-fonts.utils'

/**
 * 이 기계에 설치된 **한글을 그릴 수 있는** 폰트를 읽어옵니다.
 *
 * ## 왜 필요한가
 *
 * 폰트 메뉴는 이름 6개가 하드코딩돼 있었습니다. 그 이름이 그 기계에 실제로
 * 있는지 아무도 안 봤을 뿐 아니라, **여섯 개 전부 한글을 못 그립니다**
 * (`Arial`·`Courier New`·`Georgia` 를 열어 보면 U+AC00 이 없습니다). 한국어로
 * 쓰는 에디터에서 고를 수 없는 것만 늘어놓고 있었던 셈입니다.
 *
 * `queryLocalFonts()` 로 실제 목록을 받고, 한글을 그릴 수 있는 것만 남깁니다.
 * 판별 방법과 왜 쉬운 길이 안 되는지는 [`use-local-fonts.utils`] 참고.
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
 * 넷째 줄 때문에 `denied` 라는 상태를 **두지 않습니다.** 거절과 "정말 폰트가
 * 없음" 은 여기서 구분되지 않고, 구분할 필요도 없습니다 — 둘 다 보여줄 것이
 * 없다는 뜻이고 화면에 나타나는 결과가 같습니다.
 *
 * 그리고 매다는 경우가 있으므로 `loading` 이 영원히 끝나지 않을 수 있습니다.
 * 부르는 쪽은 그동안에도 **기본 목록으로 계속 쓸 수 있어야** 합니다.
 *
 * ## 왜 컴포넌트 상태가 아닌가
 *
 * **설치된 폰트 목록은 그 기계의 사실이지 이 컴포넌트의 상태가 아닙니다.**
 *
 * `useState` + `useEffect` 로 쓰면 컴포넌트마다 자기 사본을 갖습니다. 재 봤더니
 * 같은 훅을 쓰는 컴포넌트 **3개를 띄우면 `queryLocalFonts()` 가 3번, 권한
 * 조회도 3번** 나갔습니다. 모듈 수준 시그널로 올리니 둘 다 1번입니다.
 *
 * | 없어진 것 | 왜 없어도 되는가 |
 * | --- | --- |
 * | 자동 로드 `useEffect` | 구독 대상이 컴포넌트 생애와 무관합니다 |
 * | 언마운트 가드 `useRef` | 늦게 온 응답이 **모듈**을 갱신하는 건 정상입니다 |
 * | `useCallback` | 모듈 함수라 처음부터 동일 참조입니다 |
 *
 * ## 권한이 바뀌면 따라갑니다
 *
 * `PermissionStatus` 의 `change` 가 실제로 오는 것을 확인했습니다. 허용으로
 * 바뀌면 바로 불러오고, 거절로 바뀌면 들고 있던 목록을 버립니다.
 */

export type LocalFontsStatus = 'unsupported' | 'idle' | 'loading' | 'ready'

export interface UseLocalFontsReturn {
  status: LocalFontsStatus
  /**
   * 한글을 그릴 수 있는 family 이름들 — 중복을 없애고 정렬했습니다.
   *
   * `status === 'ready'` 여도 **빌 수 있습니다** — 거절당했거나 한국어 폰트가
   * 하나도 없는 기계입니다.
   */
  families: string[]
  /**
   * 목록을 읽어옵니다.
   *
   * 아직 허용 전이라면 **사용자 제스처 안에서** 불러야 합니다 — 클릭 핸들러나
   * `<select>` 의 `change` 핸들러 안이면 됩니다 (둘 다 실측했습니다).
   *
   * 겹쳐 불러도 한 번만 나갑니다.
   */
  load: () => void
}

interface FontData {
  family: string
  blob: () => Promise<Blob>
}

type QueryLocalFonts = () => Promise<FontData[]>

function queryFn(): QueryLocalFonts | null {
  const fn = (window as unknown as { queryLocalFonts?: QueryLocalFonts })
    .queryLocalFonts
  return typeof fn === 'function' ? fn : null
}

const CACHE_KEY = 'sagak-editor-korean-fonts'

/**
 * 한 번에 여는 폰트 파일 수.
 *
 * 이 기계에서 family 256개를 8로 훑어 5.5초였습니다. 더 올려도 디스크가
 * 받쳐주지 않고, 낮추면 첫 방문이 길어집니다.
 */
const CONCURRENCY = 8

/*
 * 기계 하나에 목록도 하나입니다. 컴포넌트가 몇 개든 여기를 같이 봅니다.
 */
const statusSignal = signal<LocalFontsStatus>(
  queryFn() ? 'idle' : 'unsupported'
)
const familiesSignal = signal<string[]>([])

/** 진행 중인 호출 — 같은 요청이 겹쳐 나가지 않게 합니다 */
let inFlight: Promise<void> | null = null

/**
 * 진행 중일 때 또 요청이 오면 **끝나고 한 번 더** 돌립니다.
 *
 * 그냥 무시하면 안 됩니다. 스캔은 이 기계에서 5.5초가 걸리는데, 그 사이에
 * 사용자가 권한을 허용하면 지금 도는 것은 **허용 전의 답**을 들고 끝납니다.
 * 그 뒤로 아무것도 다시 돌지 않아 목록이 영영 비어 있게 됩니다.
 *
 * 테스트가 이걸 잡았습니다 — 거절 상태의 스캔이 아직 도는 동안 허용으로
 * 바꾸면 30초를 기다려도 목록이 안 들어왔습니다.
 */
let rerun = false

/**
 * 설치된 폰트 집합을 요약합니다.
 *
 * 캐시가 아직 유효한지 보는 데만 씁니다. 폰트를 하나 깔거나 지우면 값이
 * 달라져 다시 훑습니다.
 *
 * 구분자는 **눈에 보이는 문자**여야 합니다 — 폰트 이름에 안 들어가면서
 * 저장된 값을 사람이 읽을 수 있는 것으로 `\n` 을 씁니다.
 */
function signatureOf(families: string[]): string {
  return `${families.length}:${families.join('\n')}`
}

function readCache(signature: string): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as { signature?: string; families?: string[] }
    if (cached.signature !== signature || !Array.isArray(cached.families)) {
      return null
    }
    return cached.families
  } catch {
    return null
  }
}

function writeCache(signature: string, families: string[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ signature, families }))
  } catch {
    // 저장 공간이 없거나 막혀 있으면 다음에 다시 훑습니다
  }
}

/** family 마다 대표 하나만 열어 한글 여부를 봅니다 */
async function filterKorean(fonts: FontData[]): Promise<string[]> {
  const representative = new Map<string, FontData>()
  for (const font of fonts) {
    if (!representative.has(font.family)) representative.set(font.family, font)
  }

  const queue = [...representative.values()]
  const korean: string[] = []

  const worker = async (): Promise<void> => {
    for (;;) {
      const font = queue.shift()
      if (!font) return
      try {
        if (await supportsKorean(await font.blob())) korean.push(font.family)
      } catch {
        /*
         * 폰트 하나를 못 열었다고 스캔 전체를 버리면 안 됩니다.
         *
         * 실제로 그랬습니다 — 스캔 도중에 권한이 취소되면 `blob()` 이 거부하고,
         * `Promise.all` 이 통째로 실패해 **빈 목록인 채 `ready` 로** 끝났습니다.
         * 로그에 "스캔 끝" 이 안 찍히는 것으로 드러났습니다.
         */
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  return korean.sort((a, b) => a.localeCompare(b))
}

function load(): void {
  const query = queryFn()
  /*
   * 겹친 호출만 막습니다. `ready` 라고 해서 건너뛰면 안 됩니다 — 빈 손으로
   * 끝난 뒤에 사용자가 권한을 허용한 경우가 정확히 그 상황이고, 그때는 답이
   * 달라졌으므로 다시 물어야 합니다.
   */
  if (!query) return
  if (inFlight) {
    rerun = true
    return
  }

  statusSignal.value = 'loading'
  inFlight = query()
    .then(async (fonts) => {
      const all = [...new Set(fonts.map((font) => font.family))].sort()
      const signature = signatureOf(all)

      /*
       * 폰트 파일을 다 여는 데 이 기계에서 5.5초입니다. 설치된 폰트가 그대로면
       * 그 답도 그대로이므로 두 번째 방문부터는 건너뜁니다.
       */
      const cached = readCache(signature)
      if (cached) {
        familiesSignal.value = cached
        statusSignal.value = 'ready'
        return
      }

      const korean = await filterKorean(fonts)
      writeCache(signature, korean)
      familiesSignal.value = korean
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
      if (rerun) {
        rerun = false
        load()
      }
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
