import { useEffect } from 'preact/hooks'

/**
 * 모달/다이얼로그가 열려 있을 때 body 스크롤을 방지하는 훅
 *
 * @param locked - 스크롤 잠금 여부
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 *
 * useLockBodyScroll(isOpen)
 * ```
 */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (locked) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [locked])
}
