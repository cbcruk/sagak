import { useRef, useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'
import type { EditorMode, ModeContent } from './types'

interface UseModeSwitchingOptions {
  /** 현재 편집 모드 */
  mode: EditorMode
  /** 콘텐츠 변경 시 호출될 콜백 */
  onChange?: (content: string) => void
  /** 각 모드별 요소 참조 */
  refs: {
    wysiwyg: RefObject<HTMLDivElement>
    html: RefObject<HTMLTextAreaElement>
    text: RefObject<HTMLTextAreaElement>
  }
  /** 콘텐츠 상태 설정 함수 */
  setContent: (content: ModeContent | ((prev: ModeContent) => ModeContent)) => void
}

/**
 * 모드 전환 시 콘텐츠를 동기화하는 훅
 *
 * 콘텐츠는 이미 입력 핸들러에서 상태로 관리되므로,
 * 모드 전환 시 별도의 동기화가 필요하지 않습니다.
 *
 * @param options - 훅 옵션
 */
export function useModeSwitching({
  mode,
  onChange,
}: UseModeSwitchingOptions): void {
  const prevModeRef = useRef<EditorMode>(mode)

  useEffect(() => {
    const prevMode = prevModeRef.current

    if (prevMode !== mode) {
      prevModeRef.current = mode
    }
  }, [mode, onChange])
}
