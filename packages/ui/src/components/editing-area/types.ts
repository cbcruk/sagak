import type { RefObject } from 'preact'

/** 에디터 모드 타입 */
export type EditorMode = 'wysiwyg' | 'html' | 'text'

/** 모드별 콘텐츠 상태 */
export interface ModeContent {
  wysiwyg: string
  html: string
  text: string
}

/** `useEditingAreaContent` 훅 옵션 */
export interface UseEditingAreaContentOptions {
  /** 현재 편집 모드 */
  mode: EditorMode
  /** 초기 콘텐츠 (HTML) */
  initialContent: string
  /** 콘텐츠 변경 시 호출될 콜백 */
  onChange?: (content: string) => void
  /** WYSIWYG 요소가 마운트될 때 호출될 콜백 */
  onWysiwygMount?: (element: HTMLElement) => void
  /** 각 모드별 요소 참조 */
  refs: {
    wysiwyg: RefObject<HTMLDivElement>
    html: RefObject<HTMLTextAreaElement>
    text: RefObject<HTMLTextAreaElement>
  }
}

/** `useEditingAreaContent` 훅 반환 타입 */
export interface UseEditingAreaContentReturn {
  /** 모드별 콘텐츠 */
  content: ModeContent
  /** WYSIWYG 입력 핸들러 */
  handleWysiwygInput: () => void
  /** HTML 입력 핸들러 */
  handleHtmlInput: (e: Event) => void
  /** Text 입력 핸들러 */
  handleTextInput: (e: Event) => void
}
