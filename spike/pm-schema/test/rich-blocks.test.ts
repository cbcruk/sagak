import { describe, it, expect, afterAll } from 'vitest'
import { createSagakSchema } from '../src/schema'
import { roundTrip } from '../src/roundtrip'

/**
 * 인용·코드블록을 스키마에 **넣을 것인가.**
 *
 * 툴바에는 없습니다. 그런데 붙여넣기로는 들어옵니다. 안 넣으면 문단으로
 * 풀리고, 넣으면 원문에 가까워지는 대신 **툴바가 만들 수 없는 것을 문서가
 * 갖게 됩니다** — 내보내기·CSS·(나중에) 커맨드가 따라와야 합니다.
 *
 * 코드블록에서는 손실이 하나 더 걸립니다. `<pre>` 안의 **공백과 줄바꿈**은
 * 뜻이 있는데, 문단으로 풀리면 그게 사라집니다. 여기서는 그것도 같이 잽니다.
 */

const 안넣음 = createSagakSchema()
const 넣음 = createSagakSchema({ richBlocks: true })

const CASES: Array<{ name: string; html: string }> = [
  { name: '인용', html: `<blockquote><p>인용된 말</p></blockquote><p>본문</p>` },
  {
    name: '인용 안의 여러 문단',
    html: `<blockquote><p>첫째</p><p>둘째</p></blockquote>`,
  },
  {
    name: '코드블록 — 줄바꿈과 들여쓰기',
    html: `<pre><code>function f() {\n  return 1\n}</code></pre>`,
  },
]

const rows: Array<{ name: string; without: string; with: string }> = []

describe('인용·코드블록을 스키마에 넣을 것인가', () => {
  for (const { name, html } of CASES) {
    it(name, () => {
      const without = roundTrip(html, 안넣음, document)
      const withThem = roundTrip(html, 넣음, document)
      rows.push({ name, without: without.output, with: withThem.output })

      /* 넣든 안 넣든 글자는 안 없어져야 합니다 */
      expect(without.lost, `\n  ${without.output}\n`).toBe(false)
      expect(withThem.lost, `\n  ${withThem.output}\n`).toBe(false)
    })
  }

  it('코드블록의 줄바꿈은 넣어야 남습니다', () => {
    const html = CASES[2].html

    expect(roundTrip(html, 넣음, document).output).toContain('\n')
    expect(roundTrip(html, 안넣음, document).output).not.toContain('\n')
  })

  afterAll(() => {
    console.log('\n인용·코드블록 — 넣을 때와 안 넣을 때\n')
    for (const row of rows) {
      console.log(`  [${row.name}]`)
      console.log(`    안 넣음: ${row.without}`)
      console.log(`    넣음:    ${row.with}`)
    }
  })
})
