import { useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'
import type { EditorMode } from './types'

interface UseWysiwygMountOptions {
  /** 현재 편집 모드 */
  mode: EditorMode
  /** WYSIWYG 요소 참조 */
  wysiwygRef: RefObject<HTMLDivElement>
  /** WYSIWYG 요소가 마운트될 때 호출될 콜백 */
  onWysiwygMount?: (element: HTMLElement) => void
}

/**
 * WYSIWYG 요소 마운트 시 부모에게 알리는 훅
 *
 * @param options - 훅 옵션
 */
export function useWysiwygMount({
  mode,
  wysiwygRef,
  onWysiwygMount,
}: UseWysiwygMountOptions): void {
  useEffect(() => {
    if (mode === 'wysiwyg' && wysiwygRef.current && onWysiwygMount) {
      onWysiwygMount(wysiwygRef.current)
    }
  }, [mode, onWysiwygMount, wysiwygRef])
}
