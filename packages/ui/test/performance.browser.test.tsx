import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from '@vitest/browser/context'
import {
  mountEditor,
  settle,
  placeCaretInText,
  type MountedEditor,
} from './harness'

/**
 * `docs/selection-state.md` §7 의 결론을 지킵니다.
 *
 * 선택 영역 추적은 **성능 문제가 아닙니다** — 실측 0.02ms/이벤트. 여기서 재는
 * 것은 "빠른가" 가 아니라 **"비싼 경로가 다시 들어오지 않았는가"** 입니다.
 * 상한을 실측의 수십 배로 잡아 흔들리지 않게 하고, 그 상한을 넘으면 무언가
 * 근본적으로 달라졌다는 뜻입니다.
 */

const longDocument = (paragraphs: number): string =>
  [
    '<h1>제목</h1>',
    ...Array.from(
      { length: paragraphs },
      (_, i) =>
        `<p>문단 ${i} — 본문입니다. <strong>굵게</strong> <em>기울임</em></p>`
    ),
  ].join('')

describe('성능', () => {
  let ed: MountedEditor | null = null

  afterEach(() => {
    ed?.unmount()
    ed = null
  })

  it('선택 영역 파생이 프레임 예산을 잠식하지 않아야 함', async () => {
    ed = await mountEditor(longDocument(500))
    placeCaretInText(ed.editable, 1)
    await settle(6)

    const registry = ed.context.commandRegistry
    expect(registry, '커맨드 레지스트리가 없습니다').toBeTruthy()

    const measure = (times: number, fn: () => unknown): number => {
      fn()
      const start = performance.now()
      for (let i = 0; i < times; i += 1) fn()
      return (performance.now() - start) / times
    }

    /*
     * `selectionchange` 한 번에 도는 일을 그대로 재현합니다.
     *
     * 자체 구현 커맨드는 `document.queryCommandState` 보다 100배쯤 빠릅니다.
     * 레거시 폴백으로 되돌아가면 여기서 잡힙니다 — 레거시는 호출당 0.14ms 라
     * 8회면 1ms 를 넘습니다.
     */
    const queries =
      6 * measure(300, () => registry!.queryState('bold')) +
      2 * measure(300, () => registry!.queryValue('fontName'))

    const walks =
      measure(300, () => {
        const selection = window.getSelection()
        let node: Node | null = selection?.anchorNode ?? null
        while (node && node !== document.body) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            void window.getComputedStyle(node as HTMLElement).textAlign
          }
          node = node.parentNode
        }
      }) +
      3 *
        measure(300, () => {
          const selection = window.getSelection()
          let node: Node | null = selection?.anchorNode ?? null
          while (node && node !== document.body) {
            node = node.parentNode
          }
        })

    // 실측 0.015~0.022ms. 프레임 예산 16.7ms 의 1/1000 입니다.
    expect(queries + walks).toBeLessThan(1)
  })

  it('긴 문서에 타이핑해도 긴 작업이 생기지 않아야 함', async () => {
    ed = await mountEditor(longDocument(500))
    placeCaretInText(ed.editable, 1)
    await settle(6)
    ed.editable.focus()

    const longTasks: number[] = []
    let observer: PerformanceObserver | null = null
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration)
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
      observer = null
    }

    await userEvent.keyboard('안녕하세요 여기에 글을 씁니다 hello world')
    await settle(4)
    observer?.disconnect()

    // 노드 1500개 문서에서 실측 0건. 하나라도 생기면 무언가 비싸졌습니다.
    expect(longTasks).toEqual([])
  })
})
