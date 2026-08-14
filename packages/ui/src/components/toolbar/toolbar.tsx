import type { ComponentChildren } from 'preact'
import { useMemo } from 'preact/hooks'
import { SvelteHost } from '../../svelte/host'
import ToolbarSvelte from '../../svelte/Toolbar.svelte'

/**
 * 툴바 — **Svelte 판을 감싸는 껍데기**입니다.
 *
 * 안쪽은 `svelte/Toolbar.svelte` 입니다. 여기가 남아 있는 이유는 앱
 * 진입점(`apps/editor/src/app.tsx`)과 공개 API 가 아직 Preact 이기
 * 때문입니다 — 문서 줄과 같은 모양입니다.
 */

export interface ToolbarProps {
  /**
   * 자동 저장 표시를 툴바에 넣습니다. **기본값은 꺼짐입니다.**
   *
   * 이유는 `svelte/Toolbar.svelte` 의 같은 이름 prop 에 적어 뒀습니다.
   */
  showAutoSaveIndicator?: boolean
}

export function Toolbar({
  showAutoSaveIndicator = false,
}: ToolbarProps = {}): ComponentChildren {
  /* props 가 바뀌면 다시 마운트되므로 신원을 붙들어 둡니다 */
  const props = useMemo(
    () => ({ showAutoSaveIndicator }),
    [showAutoSaveIndicator]
  )

  return <SvelteHost component={ToolbarSvelte} props={props} />
}
