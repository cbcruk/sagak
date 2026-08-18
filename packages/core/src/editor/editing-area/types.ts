/**
 * 편집 영역 타입
 * 편집 영역 모듈의 타입 정의
 */

import type { Node } from 'prosemirror-model'
import type { SanitizeOption } from './sanitizer'

/**
 * 에디터가 지원하는 편집 모드
 */
export type EditingMode = 'wysiwyg' | 'html' | 'text'

/**
 * 모드 사이를 오가는 **공통 형식**입니다.
 *
 * 예전에는 HTML 문자열이었습니다. 그러면 모드를 바꿀 때마다 문자열을 다시
 * 파싱해야 하고, 무엇보다 **무엇이 진실인지가 모호해집니다** — WYSIWYG 의
 * `innerHTML` 과 소스 모드의 textarea 값이 각자 진실 행세를 합니다.
 *
 * 이제 진실은 **문서 모델 하나**이고 각 모드는 그것을 보여 주는 창입니다.
 * HTML 은 밖으로 나갈 때(내보내기·소스 보기·붙여넣기) 쓰는 형식이지 저장
 * 형식이 아닙니다 (`docs/prosemirror-migration.md` §8).
 */
export type IRContent = Node

/**
 * `EditingArea` 설정
 */
export interface EditingAreaConfig {
  /**
   * 편집 영역의 컨테이너 요소
   */
  container: HTMLElement

  /**
   * 최소 높이 (픽셀)
   */
  minHeight?: number

  /**
   * 자동 크기 조정 활성화
   */
  autoResize?: boolean

  /**
   * 편집 영역의 CSS 클래스 이름
   */
  className?: string

  /**
   * 맞춤법 검사 활성화 (기본값: true)
   */
  spellCheck?: boolean

  /**
   * 붙여넣기 및 `setContent` 시 HTML 정화 옵션
   *
   * - `true` 또는 미지정: 기본 정화기 사용 (권장)
   * - `false`: 정화 비활성화 (신뢰할 수 있는 콘텐츠 전용)
   * - `SanitizerOptions`: 사용자 정의 `DOMPurify` 설정
   */
  sanitize?: SanitizeOption
}

/**
 * 모든 편집 영역의 기본 인터페이스
 * 각 모드(WYSIWYG, HTML, Text)는 이 인터페이스를 구현해야 함
 */
export interface EditingArea {
  /**
   * 지금 이 모드가 보고 있는 문서를 **모델로** 돌려줍니다
   */
  getContent(): Promise<IRContent>

  /**
   * 모델을 이 모드가 보여 줄 꼴로 옮깁니다
   */
  setContent(content: IRContent): Promise<void>

  /**
   * 이 편집 영역을 표시합니다
   *
   * @returns 영역 표시 완료 시 resolve되는 `Promise`
   */
  show(): Promise<void>

  /**
   * 이 편집 영역을 숨깁니다
   *
   * @returns 영역 숨김 완료 시 resolve되는 `Promise`
   */
  hide(): Promise<void>

  /**
   * 편집 영역에 포커스를 설정합니다
   */
  focus(): void

  /**
   * 편집 가능 여부를 설정합니다
   *
   * @param enabled - 편집 활성화 여부
   */
  setEditable(enabled: boolean): void

  /**
   * 맞춤법 검사 활성화 여부를 설정합니다
   *
   * @param enabled - 맞춤법 검사 활성화 여부
   */
  setSpellCheck?(enabled: boolean): void

  /**
   * 변환 없이 원시 콘텐츠를 가져옵니다
   * 디버깅과 직접 접근에 사용됩니다
   */
  getRawContent(): string

  /**
   * 변환 없이 원시 콘텐츠를 설정합니다
   * 디버깅과 직접 접근에 사용됩니다
   *
   * @param content - 설정할 원시 콘텐츠
   */
  setRawContent(content: string): void

  /**
   * 이 편집 영역이 현재 표시되고 있는지 확인합니다
   */
  isVisible(): boolean

  /**
   * 이 편집 영역의 DOM 요소를 가져옵니다
   */
  getElement(): HTMLElement

  /**
   * 리소스와 이벤트 리스너를 정리합니다
   */
  destroy(): void
}

/**
 * HTML 콘텐츠 변환기
 * 다양한 형식 간 변환을 처리합니다
 */
export interface ContentConverter {
  /**
   * HTML을 순수 텍스트로 변환합니다
   *
   * @param html - HTML 콘텐츠
   * @returns 순수 텍스트 콘텐츠
   */
  htmlToText(html: string): string

  /**
   * 순수 텍스트를 HTML로 변환합니다
   *
   * @param text - 순수 텍스트 콘텐츠
   * @returns HTML 콘텐츠
   */
  textToHTML(text: string): string

  /**
   * HTML 특수 문자를 이스케이프합니다
   *
   * @param text - 이스케이프할 텍스트
   * @returns 이스케이프된 텍스트
   */
  escapeHTML(text: string): string

  /**
   * HTML 특수 문자를 언이스케이프합니다
   *
   * @param html - 언이스케이프할 HTML
   * @returns 언이스케이프된 텍스트
   */
  unescapeHTML(html: string): string

  /**
   * 표시를 위해 HTML을 포맷합니다 (프리티 프린트)
   *
   * @param html - 포맷할 HTML
   * @returns 포맷된 HTML
   */
  formatHTML(html: string): string
}

/**
 * `EditingAreaManager` 설정
 */
export interface EditingAreaManagerConfig {
  /**
   * 모든 편집 영역의 컨테이너 요소
   */
  container: HTMLElement

  /**
   * 기본 편집 모드
   */
  defaultMode?: EditingMode

  /**
   * 최소 높이 (픽셀)
   */
  minHeight?: number

  /**
   * 자동 크기 조정 활성화
   */
  autoResize?: boolean
}

/**
 * 모드 변경 이벤트 데이터
 */
export interface ModeChangeEvent {
  /**
   * 이전 모드
   */
  from: EditingMode

  /**
   * 새 모드
   */
  to: EditingMode

  /**
   * 전송되는 콘텐츠
   */
  content: IRContent
}

/**
 * 콘텐츠 변경 이벤트 데이터
 */
export interface ContentChangeEvent {
  /**
   * 현재 편집 모드
   */
  mode: EditingMode

  /**
   * 새 콘텐츠
   */
  content: IRContent
}

/**
 * 크기 조정 이벤트 데이터
 */
export interface ResizeEvent {
  /**
   * 새 높이 (픽셀)
   */
  height: number

  /**
   * 새 너비 (픽셀)
   */
  width: number
}
