import type { CommandRegistry } from '../command-registry'
import { selectedBlocks } from './selection-blocks'

/**
 * 정렬 커맨드 → `text-align` 값 매핑
 */
const ALIGNMENT_VALUES: Record<string, string> = {
  justifyLeft: 'left',
  justifyCenter: 'center',
  justifyRight: 'right',
  justifyFull: 'justify',
}

/**
 * 자체 구현 커맨드의 precedence
 *
 * 레거시 `execCommand` 어댑터(-100)보다 높아 우선 실행되고,
 * 소비자가 더 높은 precedence로 오버라이드할 여지를 남깁니다.
 */
export const NATIVE_PRECEDENCE = 0

/**
 * 정렬 커맨드의 자체 구현을 등록합니다
 *
 * `execCommand('justify*')` 대신 선택 범위와 교차하는 최내곽 블록 요소들의
 * `text-align` 스타일을 직접 설정합니다. 브라우저별 마크업 편차 없이 항상
 * 인라인 스타일 하나로 표현됩니다.
 *
 * 선택 영역이 없거나 편집 호스트/블록을 찾지 못하는 경우에는 `undefined`를
 * 반환해 낮은 precedence의 레거시 어댑터로 위임합니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerNativeAlignment(registry: CommandRegistry): () => void {
  const unsubs: Array<() => void> = []

  for (const [command, value] of Object.entries(ALIGNMENT_VALUES)) {
    unsubs.push(
      registry.register(
        command,
        () => {
          const found = selectedBlocks()
          if (!found) {
            // 판단 불가 → 레거시 execCommand로 위임
            return undefined
          }

          for (const block of found.blocks) {
            block.style.textAlign = value
          }

          return true
        },
        NATIVE_PRECEDENCE
      )
    )
  }

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
