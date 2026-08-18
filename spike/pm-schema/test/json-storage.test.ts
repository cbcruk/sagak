import { describe, it, expect, afterAll } from 'vitest'
import { Node } from 'prosemirror-model'
import { sagakSchema } from '../src/schema'
import { toJSON, fromJSON, toHtml, parseHtml } from '../src/storage'

/**
 * **저장 형식을 JSON 으로 바꾸면 무엇이 달라지는가.**
 *
 * 지금은 `innerHTML` 을 그대로 OPFS 에 넣습니다. 그러면 문서를 열 때마다
 * 스키마를 통과하므로 §2 의 "변화 8건"(목록 항목 문단 감싸기 등)을 매번
 * 겪습니다. JSON 으로 저장하면 **모델이 곧 저장물**이라 그 왕복이 사라집니다.
 *
 * 사용자가 아직 없어 이관 부담이 없다는 것이 이 결정의 전제입니다.
 *
 * 여기서 재는 것 셋:
 *
 * | | |
 * | --- | --- |
 * | 무손실 | JSON 을 거쳐도 문서가 **같은 문서**인가 (`Node.eq`) |
 * | 안정 | 두 번 돌려도 같은 JSON 인가 — 저장·열기가 값을 갉지 않는가 |
 * | 크기 | HTML 대비 몇 배인가 — OPFS 에 들어가는 실제 비용 |
 */

const CASES: Array<{ name: string; html: string }> = [
  {
    name: '앱 초기 콘텐츠',
    html: `<h1>사각사각</h1><p>글을 씁니다.</p><ul><li>굵게 · 기울임 · 밑줄</li><li>표, 이미지, 링크</li></ul>`,
  },
  {
    name: '겹친 서식 (제품이 만드는 꼴)',
    html: `<p><span style="font-family: Georgia"><span style="color: red">가나</span>다라</span></p>`,
  },
  {
    name: '표',
    html: `<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>`,
  },
  {
    name: '코드블록',
    html: `<pre><code>function f() {\n  return 1\n}</code></pre>`,
  },
  {
    name: '문단 속성',
    html: `<p style="text-align: center; line-height: 2; margin-left: 40px">가운데</p>`,
  },
  {
    /*
     * 위 표본은 다 짧아서 **구조 비용이 부풀려 보입니다.** 실제 문서는 글자가
     * 대부분이라 비율이 내려갑니다. 그 값을 알아야 저장 비용을 판단할 수 있어
     * 긴 문서를 하나 넣습니다.
     */
    name: '긴 문서 (문단 200개)',
    html: Array.from(
      { length: 200 },
      (_, i) =>
        `<p>${i} 글을 씁니다. 위 도구 모음으로 서식을 적용해보세요. 한 문단이 이 정도 길이입니다.</p>`
    ).join(''),
  },
]

const sizes: Array<{ name: string; html: number; json: number }> = []

describe('JSON 으로 저장하기', () => {
  describe('무손실 — JSON 을 거쳐도 같은 문서인가', () => {
    for (const { name, html } of CASES) {
      it(name, () => {
        const doc = parseHtml(html, sagakSchema, document)
        const restored = fromJSON(toJSON(doc), sagakSchema)

        expect(
          restored.eq(doc),
          `\n  원본: ${toHtml(doc, sagakSchema, document)}\n  복원: ${toHtml(restored, sagakSchema, document)}\n`
        ).toBe(true)
      })
    }
  })

  describe('안정 — 두 번 돌려도 같은가', () => {
    for (const { name, html } of CASES) {
      it(name, () => {
        const once = toJSON(parseHtml(html, sagakSchema, document))
        const twice = toJSON(fromJSON(once, sagakSchema))

        expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
      })
    }
  })

  /**
   * HTML 로 내보낼 길은 남아 있어야 합니다 — 내보내기와 소스 보기가 씁니다.
   * JSON 이 진실이 되어도 그 길이 막히면 안 됩니다.
   */
  describe('HTML 로 되돌릴 수 있는가', () => {
    for (const { name, html } of CASES) {
      it(name, () => {
        const doc = parseHtml(html, sagakSchema, document)
        const viaJson = fromJSON(toJSON(doc), sagakSchema)

        const before = toHtml(doc, sagakSchema, document)
        const after = toHtml(viaJson, sagakSchema, document)

        sizes.push({
          name,
          html: before.length,
          json: JSON.stringify(toJSON(doc)).length,
        })

        expect(after).toBe(before)
      })
    }
  })

  /**
   * 저장물이 스키마 밖으로 나가면 어떻게 되는가.
   *
   * JSON 은 HTML 과 달리 **모르는 것을 조용히 무시하지 않습니다** — 스키마에
   * 없는 노드 이름이 들어오면 던집니다. 저장물이 깨졌을 때 조용히 반쪽 문서가
   * 되는 것보다 낫지만, **부르는 쪽이 그 오류를 받아야** 합니다.
   */
  it('모르는 노드가 든 JSON 은 조용히 넘어가지 않습니다', () => {
    expect(() =>
      Node.fromJSON(sagakSchema, {
        type: 'doc',
        content: [{ type: '없는노드', content: [] }],
      })
    ).toThrow()
  })

  afterAll(() => {
    console.log('\n저장 크기 — HTML vs JSON\n')
    for (const row of sizes) {
      const ratio = (row.json / row.html).toFixed(1)
      console.log(
        `  ${row.name.padEnd(24)} HTML ${String(row.html).padStart(5)}B` +
          `   JSON ${String(row.json).padStart(5)}B   (×${ratio})`
      )
    }
  })
})
