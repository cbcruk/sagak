import type { ComponentChildren } from 'preact'
import { useMemo } from 'preact/hooks'
import { SvelteHost } from '../../svelte/host'
import DocumentBarSvelte from '../../svelte/DocumentBar.svelte'

/**
 * 문서 줄 — **Svelte 판을 감싸는 껍데기**입니다.
 *
 * 제목·메뉴·문서 목록은 `svelte/DocumentBar.svelte` 로 옮겼습니다. 여기가
 * 남아 있는 이유는 앱 진입점(`apps/editor/src/app.tsx`)과 공개 API 가 아직
 * Preact 이기 때문입니다. 앱까지 Svelte 가 되면 이 파일과 `SvelteHost` 가
 * 함께 사라집니다.
 */

export interface DocumentBarProps {
  /**
   * 이름을 받아 옵니다 — 기본은 브라우저 프롬프트입니다.
   *
   * 프로퍼티로 뺀 이유는 둘입니다. 나중에 이 저장소의 다이얼로그로 바꾸기
   * 쉽고, 테스트가 사람 없이 이름을 넣을 수 있습니다.
   *
   * @returns 이름, 또는 취소했으면 `null`
   */
  requestName?: (current: string) => string | null
}

export function DocumentBar({
  requestName,
}: DocumentBarProps = {}): ComponentChildren {
  /*
   * `SvelteHost` 는 props 가 바뀌면 다시 마운트합니다. 매 렌더 새 객체를
   * 넘기면 문서 줄이 깜빡이므로 신원을 붙들어 둡니다.
   */
  const props = useMemo(
    () => (requestName ? { requestName } : undefined),
    [requestName]
  )

  return <SvelteHost component={DocumentBarSvelte} props={props} />
}
