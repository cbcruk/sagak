import { useRef, useState } from 'preact/hooks'
import type { RefObject } from 'preact'
import { useClickOutside } from './use-click-outside'
import { useEscapeKey } from './use-escape-key'

/**
 * `useDisclosure` 훅 반환 타입
 */
export interface UseDisclosureReturn<T extends HTMLElement> {
  /** 열림 상태 */
  isOpen: boolean
  /** 열기 함수 */
  open: () => void
  /** 닫기 함수 */
  close: () => void
  /** 토글 함수 */
  toggle: () => void
  /** 요소 참조 (외부 클릭 감지용) */
  ref: RefObject<T>
}

/**
 * 팝오버/드롭다운 열림 상태를 관리하는 훅
 *
 * 외부 클릭과 ESC 키로 자동으로 닫힘
 *
 * @returns 열림 상태와 제어 함수들
 *
 * @example
 * ```tsx
 * const { isOpen, toggle, ref } = useDisclosure<HTMLDivElement>()
 *
 * return (
 *   <div ref={ref}>
 *     <button onClick={toggle}>Toggle</button>
 *     {isOpen && <div>Content</div>}
 *   </div>
 * )
 * ```
 */
export function useDisclosure<
  T extends HTMLElement = HTMLDivElement,
>(): UseDisclosureReturn<T> {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<T>(null)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  useClickOutside(ref, close, isOpen)
  useEscapeKey(close, isOpen)

  return {
    isOpen,
    open,
    close,
    toggle,
    ref,
  }
}
