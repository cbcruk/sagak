/**
 * 로그 레벨
 *
 * 낮은 레벨일수록 더 적게 출력합니다:
 * `silent` < `error` < `warn` < `info` < `debug`
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

/**
 * 현재 로그 레벨 (기본값: `warn` — 경고와 오류만 출력)
 */
let currentLevel: LogLevel = 'warn'

/**
 * 전역 로그 레벨을 설정합니다
 *
 * 프로덕션에서 로그를 억제하려면 `'silent'`을, 디버깅 시 상세 로그가 필요하면
 * `'debug'`를 사용하세요.
 *
 * @param level - 설정할 로그 레벨
 *
 * @example
 * ```typescript
 * import { setLogLevel } from 'sagak-core'
 *
 * setLogLevel('silent') // 모든 로그 억제
 * ```
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

/**
 * 현재 로그 레벨을 가져옵니다
 */
export function getLogLevel(): LogLevel {
  return currentLevel
}

function isEnabled(level: Exclude<LogLevel, 'silent'>): boolean {
  return LEVEL_ORDER[currentLevel] >= LEVEL_ORDER[level]
}

/**
 * 레벨 인식 로거
 *
 * `console`을 직접 호출하는 대신 이 로거를 사용하면, 소비자가 `setLogLevel`로
 * 라이브러리의 로그 출력을 제어할 수 있습니다. 활성화된 레벨에서는 인자를
 * 그대로 `console`에 전달합니다.
 */
export const logger = {
  error(...args: unknown[]): void {
    if (isEnabled('error')) {
      console.error(...args)
    }
  },
  warn(...args: unknown[]): void {
    if (isEnabled('warn')) {
      console.warn(...args)
    }
  },
  info(...args: unknown[]): void {
    if (isEnabled('info')) {
      console.info(...args)
    }
  },
  debug(...args: unknown[]): void {
    if (isEnabled('debug')) {
      console.debug(...args)
    }
  },
}

/**
 * 로거 타입
 */
export type Logger = typeof logger
