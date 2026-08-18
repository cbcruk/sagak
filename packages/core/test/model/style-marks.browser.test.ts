import { describe, it, expect, afterAll } from 'vitest'
import { createSagakSchema } from '@/model/schema'
import { roundTrip } from './round-trip'

/**
 * 값 붙는 마크 다섯을 **하나로 합칠 것인가.**
 *
 * 붙여넣기에서 `<span>` 이 겹겹이 쌓이는 것을 보고 나온 질문입니다. 합치면
 * 겹은 줄지만, ProseMirror 에서 **같은 종류의 마크는 한 번만 붙습니다** —
 * 안쪽 `<span>` 이 바깥 것을 밀어냅니다. 그러면 겹을 줄인 대가로 **속성이
 * 사라질** 수 있습니다.
 *
 * 그래서 두 가지를 같이 잽니다.
 *
 * | | |
 * | --- | --- |
 * | 겹 | 나온 HTML 의 `<span>` 최대 중첩 깊이 |
 * | 보존 | 들어간 스타일 속성이 나올 때도 있는가 |
 *
 * 겹만 재면 합치는 쪽이 이깁니다. 보존까지 재야 답이 나옵니다.
 */

const 나눈쪽 = createSagakSchema()
const 합친쪽 = createSagakSchema({ textStyle: true })

const CASES: Array<{ name: string; html: string; expect: string[] }> = [
  {
    /* 구글 문서는 한 `<span>` 에 다섯 속성을 몰아 넣습니다 — 합치는 쪽에 유리한 꼴 */
    name: '한 span 에 다섯 속성 (구글 문서 꼴)',
    html: `<p><span style="font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;letter-spacing:1px">글</span></p>`,
    expect: ['font-size', 'font-family', 'color'],
  },
  {
    /* 툴바로 글꼴을 주고 색을 주면 이 꼴이 됩니다 — 나눈 쪽에 유리한 꼴 */
    name: '겹친 span 에 서로 다른 속성 (툴바 꼴)',
    html: `<p><span style="font-family: Georgia"><span style="color: red">글</span></span></p>`,
    expect: ['font-family', 'color'],
  },
  {
    name: '세 겹',
    html: `<p><span style="font-family: Georgia"><span style="font-size: 24px"><span style="color: red">글</span></span></span></p>`,
    expect: ['font-family', 'font-size', 'color'],
  },
  {
    name: '겹친 것 + 굵게',
    html: `<p><strong><span style="font-family: Georgia"><span style="background-color: yellow">글</span></span></strong></p>`,
    expect: ['font-family', 'background-color'],
  },
]

function spanDepth(html: string, doc: Document): number {
  const el = doc.createElement('div')
  el.innerHTML = html

  let deepest = 0
  for (const span of el.querySelectorAll('span')) {
    let depth = 0
    for (let node: HTMLElement | null = span; node; node = node.parentElement) {
      if (node.tagName === 'SPAN') depth += 1
    }
    deepest = Math.max(deepest, depth)
  }
  return deepest
}

interface Row {
  name: string
  split: { depth: number; kept: string[]; html: string }
  merged: { depth: number; kept: string[]; html: string }
  want: string[]
}

const rows: Row[] = []

function measure(html: string, schema: ReturnType<typeof createSagakSchema>, want: string[]) {
  const out = roundTrip(html, schema, document).output
  return {
    depth: spanDepth(out, document),
    kept: want.filter((property) => out.includes(`${property}:`)),
    html: out,
  }
}

describe('값 붙는 마크를 합칠 것인가', () => {
  for (const { name, html, expect: want } of CASES) {
    it(name, () => {
      const split = measure(html, 나눈쪽, want)
      const merged = measure(html, 합친쪽, want)
      rows.push({ name, split, merged, want })

      /* 나눈 쪽은 무엇을 넣든 다 살아남아야 합니다 */
      expect(split.kept, `\n  나온 것: ${split.html}\n`).toEqual(want)
    })
  }

  afterAll(() => {
    console.log('\n         겹(깊이)      속성 보존')
    console.log('         나눔  합침    나눔      합침')
    for (const row of rows) {
      const s = `${row.split.kept.length}/${row.want.length}`
      const m = `${row.merged.kept.length}/${row.want.length}`
      const flag = row.merged.kept.length < row.want.length ? '  ← 잃음' : ''
      console.log(
        `  ${row.name}\n` +
          `         ${row.split.depth}     ${row.merged.depth}       ${s}       ${m}${flag}`
      )
      if (flag) {
        console.log(`           합침 결과: ${row.merged.html}`)
      }
    }
  })
})
