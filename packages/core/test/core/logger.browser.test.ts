import { describe, it, expect, afterEach, vi } from 'vitest'
import { logger, setLogLevel, getLogLevel } from '@/core/logger'

/**
 * Logger 테스트
 *
 * Why: 라이브러리 로그를 소비자가 레벨로 제어할 수 있어야 함 (프로덕션 억제)
 * How: setLogLevel로 레벨을 바꾸며 console 전달 여부와 인자 보존을 검증
 */
describe('logger', () => {
  afterEach(() => {
    // 전역 상태이므로 기본값으로 복원
    setLogLevel('warn')
    vi.restoreAllMocks()
  })

  it('기본 레벨은 warn 이어야 함', () => {
    expect(getLogLevel()).toBe('warn')
  })

  it('기본 레벨에서 warn/error를 console에 인자 그대로 전달해야 함', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.warn('경고', 1)
    logger.error('오류', 2)

    expect(warnSpy).toHaveBeenCalledWith('경고', 1)
    expect(errorSpy).toHaveBeenCalledWith('오류', 2)
  })

  it("'silent'이면 아무 것도 출력하지 않아야 함", () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    setLogLevel('silent')
    logger.warn('경고')
    logger.error('오류')

    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("'error'이면 error만 출력하고 warn은 억제해야 함", () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    setLogLevel('error')
    logger.warn('경고')
    logger.error('오류')

    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('오류')
  })

  it("'debug'이면 debug/info도 출력해야 함", () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    setLogLevel('debug')
    logger.debug('디버그')
    logger.info('정보')

    expect(debugSpy).toHaveBeenCalledWith('디버그')
    expect(infoSpy).toHaveBeenCalledWith('정보')
  })

  it('기본 레벨에서 debug/info는 억제해야 함', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.debug('디버그')
    logger.info('정보')

    expect(debugSpy).not.toHaveBeenCalled()
    expect(infoSpy).not.toHaveBeenCalled()
  })
})
