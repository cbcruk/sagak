import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

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
 * 필요하고, 허용한 뒤로는 마운트할 때 조용히 불러올 수 있습니다.
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

export function useLocalFonts(): UseLocalFontsReturn {
  const [status, setStatus] = useState<LocalFontsStatus>(() =>
    queryFn() ? 'idle' : 'unsupported'
  )
  const [families, setFamilies] = useState<string[]>([])

  /** 언마운트 뒤에 늦게 돌아온 응답으로 상태를 건드리지 않습니다 */
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback((): void => {
    const query = queryFn()
    if (!query) return

    setStatus('loading')
    query()
      .then((fonts) => {
        if (!alive.current) return
        setFamilies(uniqueFamilies(fonts))
        setStatus('ready')
      })
      .catch((error: Error) => {
        if (!alive.current) return
        /*
         * `SecurityError` 는 제스처가 없었다는 뜻일 뿐이라 `idle` 로 되돌려
         * 다시 받을 수 있게 합니다 (실측한 유일한 예외입니다).
         *
         * 나머지는 한 번 해 봤다는 사실만 남깁니다 — 목록이 비어 있으므로
         * 보여줄 것이 없고, 다시 조르지도 않습니다.
         */
        setStatus(error.name === 'SecurityError' ? 'idle' : 'ready')
      })
  }, [])

  /**
   * 이미 허용돼 있으면 제스처 없이 바로 불러옵니다. 한 번 허용한 사용자가
   * 열 때마다 또 눌러야 하는 것은 이유가 없습니다.
   */
  useEffect(() => {
    if (!queryFn()) return

    let cancelled = false
    navigator.permissions
      ?.query({ name: 'local-fonts' as PermissionName })
      .then((permission) => {
        if (cancelled || permission.state !== 'granted') return
        run()
      })
      .catch(() => {
        // 이 이름을 모르는 브라우저 — 제스처를 받는 길만 남습니다
      })

    return () => {
      cancelled = true
    }
  }, [run])

  return { status, families, load: run }
}
