import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { mount, unmount } from 'svelte'
import { useEditorContext } from '../context/editor-context'

/**
 * Svelte 컴포넌트를 Preact 트리 안에 띄우는 **이주용 다리**입니다.
 *
 * ## 왜 필요한가
 *
 * 툴바 껍데기는 아직 Preact 입니다. 안쪽만 하나씩 Svelte 로 바꾸려면 둘을
 * 잇는 자리가 하나 있어야 합니다. 커스텀 엘리먼트 때 `sagak-editor-provider`
 * 가 하던 것과 같은 역할인데, Svelte 는 DOM 이벤트 프로토콜이 필요 없어
 * **props 로 직접 넘깁니다** — 그만큼 단순합니다.
 *
 * ## 이 다리는 마지막에 사라집니다
 *
 * 툴바까지 Svelte 가 되면 앱 진입점에서 한 번 `mount()` 하고 끝입니다.
 * 그때 이 파일과 Preact 의존이 함께 없어집니다.
 *
 * ## `useEffect` 가 여기서는 맞습니다
 *
 * 마운트/언마운트는 **이 컴포넌트의 생애 그 자체**입니다. 지금까지 걷어낸
 * 효과들(폰트 목록·선택 영역 구독)은 컴포넌트 밖의 사실이라 모듈로 올렸지만,
 * 이건 아닙니다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SvelteComponent = any

export interface SvelteHostProps {
  component: SvelteComponent
}

export function SvelteHost({ component }: SvelteHostProps): ComponentChildren {
  const ref = useRef<HTMLSpanElement>(null)
  const context = useEditorContext()

  useEffect(() => {
    if (!ref.current) return

    const instance = mount(component, {
      target: ref.current,
      props: { editor: context },
    })

    return () => {
      void unmount(instance)
    }
  }, [component, context])

  /*
   * `display: contents` 라 툴바의 줄바꿈 계산에 끼어들지 않습니다 —
   * 커스텀 엘리먼트 때와 같은 이유입니다.
   */
  return <span ref={ref} style={{ display: 'contents' }} />
}
