import type { CommandRegistry } from '../command-registry'
import { NATIVE_PRECEDENCE } from './native-alignment'
import {
  applyInlineStyle,
  applyLink,
  removeLink,
  type InlineStyleProp,
} from './inline-style'

/**
 * 스타일 커맨드 → CSS 속성 매핑
 *
 * `fontSize`는 제외합니다 — 레거시 1–7 스케일과 `queryCommandValue('fontSize')`
 * 왕복(UI 표시)에 의존하는 부분이 있어, 값 체계 전환과 함께 별도 단계에서
 * 다룹니다. 그때까지 레거시 어댑터가 처리합니다.
 */
const STYLE_COMMANDS: Record<string, InlineStyleProp> = {
  foreColor: 'color',
  backColor: 'backgroundColor',
  fontName: 'fontFamily',
}

/**
 * 인라인 스타일(색상/배경색/글꼴)과 링크 커맨드의 자체 구현을 등록합니다
 *
 * `execCommand` 대신 `<span style>`/`<a href>` 래핑으로 구현합니다.
 * collapsed 커서·선택 없음 등 판단 불가 시 레거시 어댑터에 위임합니다.
 *
 * @param registry 커맨드 레지스트리
 * @returns 모든 등록을 해제하는 함수
 */
export function registerNativeInlineStyles(
  registry: CommandRegistry
): () => void {
  const unsubs: Array<() => void> = []

  for (const [command, prop] of Object.entries(STYLE_COMMANDS)) {
    unsubs.push(
      registry.register(
        command,
        (_ctx, value) => {
          if (!value) return undefined
          return applyInlineStyle(prop, value)
        },
        NATIVE_PRECEDENCE
      )
    )
  }

  unsubs.push(
    registry.register(
      'createLink',
      (_ctx, value) => {
        if (!value) return undefined
        return applyLink(value)
      },
      NATIVE_PRECEDENCE
    )
  )

  unsubs.push(
    registry.register('unlink', () => removeLink(), NATIVE_PRECEDENCE)
  )

  return () => {
    for (const unsub of unsubs) unsub()
  }
}
