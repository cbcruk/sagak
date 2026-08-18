import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import {
  EventBus,
  createDefaultCommandRegistry,
  createDocumentStore,
  type CommandRegistry,
} from 'sagak-core'
import { sagakSchema, createSagakSchema } from '../src/schema'
import { roundTrip } from '../src/roundtrip'

/**
 * **제품이 실제로 만든 마크업**을 스키마에 통과시킵니다.
 *
 * jsdom 쪽 검사들은 제가 손으로 쓴 HTML 을 봅니다. 그건 규칙을 아는 입력이라
 * 통과하는 게 당연하고, 틀린 근거로 옳은 결론을 내는 길이기도 합니다
 * (`session-doc-model-spike.md` 의 "증명을 네 번 잘못했다").
 *
 * 여기서는 **코어의 커맨드가 직접 만든 DOM** 을 읽습니다. `execCommand` 와
 * 네이티브 선택 영역을 거치므로 브라우저가 있어야 하고, 브라우저마다 결과가
 * 다를 수 있다는 것 자체가 이 검사의 요지입니다.
 *
 * ## OPFS 실물 문서를 못 읽는 대신
 *
 * 사용자의 진짜 문서는 그 사람의 오리진에 있어서 검사에서 못 봅니다. 대신
 * **문서가 만들어지는 길 전체**를 재현합니다.
 *
 *     커맨드 → contentEditable → innerHTML → OPFS → 읽기 → 스키마 왕복
 *
 * 이게 저장된 문서가 겪는 경로 그대로입니다.
 */

interface Operation {
  name: string
  run: (registry: CommandRegistry) => void
}

/** 툴바가 커맨드 레지스트리로 부르는 것들 */
const OPERATIONS: Operation[] = [
  { name: '굵게', run: (r) => r.run('bold') },
  { name: '기울임', run: (r) => r.run('italic') },
  { name: '밑줄', run: (r) => r.run('underline') },
  { name: '취소선', run: (r) => r.run('strikeThrough') },
  { name: '아래첨자', run: (r) => r.run('subscript') },
  { name: '위첨자', run: (r) => r.run('superscript') },
  { name: '글꼴', run: (r) => r.run('fontName', 'Georgia') },
  { name: '글자 크기', run: (r) => r.run('fontSize', '24px') },
  { name: '글자 색', run: (r) => r.run('foreColor', '#ff0000') },
  { name: '배경 색', run: (r) => r.run('backColor', '#ffff00') },
  { name: '제목', run: (r) => r.run('formatBlock', 'h2') },
  { name: '가운데 정렬', run: (r) => r.run('justifyCenter') },
  { name: '글머리 목록', run: (r) => r.run('insertUnorderedList') },
  { name: '번호 목록', run: (r) => r.run('insertOrderedList') },
  { name: '들여쓰기', run: (r) => r.run('indent') },
  {
    name: '굵게 + 글꼴 + 색 (겹침)',
    run: (r) => {
      r.run('bold')
      r.run('fontName', 'Georgia')
      r.run('foreColor', '#ff0000')
    },
  },
]

const produced: Array<{ name: string; html: string; after: string }> = []

describe('제품이 만든 마크업이 스키마를 통과하는가', () => {
  let element: HTMLDivElement
  let registry: CommandRegistry

  beforeEach(() => {
    window.getSelection()?.removeAllRanges()

    element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>가나다라</p>'
    document.body.appendChild(element)

    registry = createDefaultCommandRegistry({ eventBus: new EventBus() })
  })

  afterEach(() => {
    element.remove()
  })

  /** 문단의 글자 전체를 고릅니다 — 툴바를 쓰기 직전 상태입니다 */
  function selectAll(): void {
    const paragraph = element.querySelector('p')!
    const text = paragraph.firstChild!

    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, text.textContent!.length)

    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
  }

  for (const operation of OPERATIONS) {
    it(operation.name, () => {
      selectAll()
      operation.run(registry)

      const html = element.innerHTML
      const result = roundTrip(html, sagakSchema, document)
      produced.push({ name: operation.name, html, after: result.output })

      expect(
        result.lost,
        `\n  제품이 만든 것: ${html}\n  왕복 후:        ${result.output}\n`
      ).toBe(false)

      expect(
        result.stable,
        `\n  1회: ${result.output}\n  2회: ${result.again}\n`
      ).toBe(true)
    })
  }

  /**
   * **§7-1 의 근거를 되재는 자리입니다.**
   *
   * 값 붙는 마크를 안 합치기로 한 근거는 "겹친 `<span>` 은 툴바가 만드는 꼴"
   * 이었는데, 그건 **재지 않고 가정한 것**이었습니다. 같은 범위에 셋을 걸면
   * 제품은 한 `<span>` 에 몰아넣습니다 — 합쳐도 잃을 것이 없는 꼴입니다.
   *
   * 그러면 겹친 `<span>` 은 언제 생기는가. **범위가 다를 때**입니다. 전체에
   * 글꼴을 주고 일부에 색을 주면 그때는 겹칩니다. 그것을 여기서 잽니다.
   */
  it('범위가 다르면 span 이 겹칩니다', () => {
    selectAll()
    registry.run('fontName', 'Georgia')

    /* 앞 두 글자에만 색 — 범위가 다릅니다 */
    const text = element.querySelector('span')?.firstChild ?? element.querySelector('p')!.firstChild!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 2)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    registry.run('foreColor', '#ff0000')

    const html = element.innerHTML
    produced.push({ name: '범위가 다른 겹침', html, after: roundTrip(html, sagakSchema, document).output })

    const depth = (() => {
      const probe = document.createElement('div')
      probe.innerHTML = html
      let deepest = 0
      for (const span of probe.querySelectorAll('span')) {
        let d = 0
        for (let n: HTMLElement | null = span; n; n = n.parentElement) {
          if (n.tagName === 'SPAN') d += 1
        }
        deepest = Math.max(deepest, d)
      }
      return deepest
    })()

    console.log(`\n  범위가 다른 겹침 — span 최대 겹: ${depth}\n  ${html}\n`)

    expect(depth, '범위가 다른데도 안 겹치면 §7-1 을 다시 봐야 합니다').toBe(2)

    /*
     * 그리고 이 꼴에서 합친 마크가 무엇을 잃는지 — 손으로 쓴 픽스처가 아니라
     * **제품이 만든 마크업**으로 확인합니다.
     *
     * 잃는 자리는 **겹치는 구간뿐**입니다. `다라` 는 글꼴만 걸려 있어 멀쩡하고,
     * `가나` 만 안쪽 색이 바깥 글꼴을 밀어냅니다. 그래서 문서 전체가 아니라
     * 글자를 집어서 봐야 합니다.
     */
    const stylesOn = (source: string, needle: string): string => {
      const probe = document.createElement('div')
      probe.innerHTML = source

      const walker = document.createTreeWalker(probe, NodeFilter.SHOW_TEXT)
      let node: Node | null = walker.nextNode()
      while (node && node.textContent !== needle) node = walker.nextNode()
      if (!node) return ''

      const parts: string[] = []
      for (
        let el = node.parentElement;
        el && el !== probe;
        el = el.parentElement
      ) {
        if (el.style.cssText) parts.push(el.style.cssText)
      }
      return parts.join(' ')
    }

    const split = roundTrip(html, sagakSchema, document).output
    const merged = roundTrip(
      html,
      createSagakSchema({ textStyle: true }),
      document
    ).output

    console.log(`\n  겹친 글자('가나')에 걸린 스타일`)
    console.log(`    나눔: ${stylesOn(split, '가나')}`)
    console.log(`    합침: ${stylesOn(merged, '가나')}\n`)

    /* 나눈 쪽은 둘 다 살아 있습니다 */
    expect(stylesOn(split, '가나')).toContain('font-family')
    expect(stylesOn(split, '가나')).toContain('color')

    /* 합친 쪽은 겹친 구간에서 바깥 것을 잃습니다 */
    expect(
      stylesOn(merged, '가나'),
      '합치면 겹친 구간의 글꼴이 사라집니다'
    ).not.toContain('font-family')
  })

  afterAll(() => {
    console.log('\n제품이 만든 마크업 → 스키마 왕복\n')
    for (const row of produced) {
      console.log(`  [${row.name}]`)
      console.log(`    제품:   ${row.html}`)
      console.log(`    왕복후: ${row.after}`)
    }
  })
})

/**
 * 저장 경로까지 포함해 한 바퀴 돌립니다.
 *
 * OPFS 는 글자를 그대로 담는 자리라 여기서 손실이 날 이유는 없습니다. 그래도
 * 재는 이유는 **경로 전체가 이어지는 것을 한 번은 봐야 하기** 때문입니다 —
 * 이 검사가 도는 것 자체가 "저장된 문서가 스키마를 통과한다" 의 근거입니다.
 */
describe('저장을 거쳐도 통과하는가 (OPFS)', () => {
  const NAME = 'pm-schema-spike.html'

  it('쓰고 읽은 뒤에도 손실이 없어야 함', async () => {
    const store = createDocumentStore()

    const element = document.createElement('div')
    element.contentEditable = 'true'
    element.innerHTML = '<p>가나다라</p>'
    document.body.appendChild(element)

    const registry = createDefaultCommandRegistry({ eventBus: new EventBus() })
    const text = element.querySelector('p')!.firstChild!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, text.textContent!.length)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    registry.run('bold')
    registry.run('fontName', 'Georgia')

    const saved = element.innerHTML
    element.remove()

    await store.write(NAME, saved)
    const loaded = await store.read(NAME)
    await store.remove(NAME)

    expect(loaded, '저장한 것과 읽은 것이 다릅니다').toBe(saved)

    const result = roundTrip(loaded, sagakSchema, document)
    expect(result.lost, `\n  ${result.output}\n`).toBe(false)
    expect(result.stable).toBe(true)
  })
})
