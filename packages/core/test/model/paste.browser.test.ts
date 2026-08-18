import { describe, it, expect, afterAll } from 'vitest'
import { sagakSchema } from '@/model/schema'
import { roundTrip } from './round-trip'

/**
 * **붙여넣기** — 우리가 만들지 않은 HTML 이 들어옵니다.
 *
 * `roundtrip.test.ts` 는 툴바가 만든 마크업만 봤습니다. 그건 우리가 규칙을
 * 아는 입력이라 통과하는 게 당연합니다. 진짜 위험은 여기입니다 — PM 은
 * 스키마에 없는 것을 **조용히 버립니다.**
 *
 * ## 잣대가 다릅니다
 *
 * 붙여넣기에서 구조가 바뀌는 것은 정상입니다(`<div>` 는 문단이 되고 인용은
 * 풀립니다). 그러나 **글자가 없어지면 안 됩니다.** 그래서 여기서도 손실
 * 기준은 글자·링크·이미지이고, 구조 변화는 기록만 합니다.
 *
 * ## 표본의 한계
 *
 * 아래 HTML 은 각 앱이 클립보드에 넣는 **알려진 꼴을 본떠 쓴 것**이지, 실제로
 * 복사해 받아 낸 덤프가 아닙니다. 브라우저에서 진짜 클립보드를 받아 보기
 * 전까지 이 검사가 "붙여넣기가 된다" 를 증명하지는 않습니다. 무엇이 깨지는지
 * 미리 보는 용도입니다.
 */

const CASES: Array<{ name: string; html: string }> = [
  {
    /*
     * 구글 문서는 굵게가 아닌 글에도 `<b>` 를 씌우고 `font-weight: normal` 로
     * 되돌립니다. 태그만 보는 파싱 규칙은 여기서 문서 전체를 굵게 만듭니다 —
     * PM 기본 스키마가 이 예외를 따로 두는 이유입니다.
     */
    name: '구글 문서 — font-weight: normal 을 쓴 <b> 껍데기',
    html: `<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-x"><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:400;font-style:normal;font-variant:normal;text-decoration:none;vertical-align:baseline;white-space:pre;white-space:pre-wrap;">보통 글입니다</span></p></b>`,
  },
  {
    name: '구글 문서 — 굵게가 진짜 굵게인 경우',
    html: `<b style="font-weight:normal"><p dir="ltr"><span style="font-size:11pt;font-family:Arial;font-weight:700;">굵은 글</span></p></b>`,
  },
  {
    name: '워드 — mso 스타일과 <o:p>',
    html: `<p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><span lang=EN-US style='font-size:11.0pt;font-family:"맑은 고딕",sans-serif;mso-fareast-language:KO'>워드에서 옵니다<o:p></o:p></span></p>`,
  },
  {
    name: '웹 페이지 — div 껍데기와 클래스',
    html: `<div class="post"><div class="body"><p class="lead">첫 문단</p><p>둘째 문단</p></div></div>`,
  },
  {
    name: '웹 페이지 — 인용',
    html: `<blockquote><p>인용된 말</p></blockquote><p>본문</p>`,
  },
  {
    name: '웹 페이지 — 코드 블록',
    html: `<pre><code>const x = 1</code></pre>`,
  },
  {
    name: '중첩 목록',
    html: `<ul><li>하나<ul><li>하나-하나</li></ul></li><li>둘</li></ul>`,
  },
  {
    name: '표 — 헤더와 병합',
    html: `<table><thead><tr><th colspan="2">머리</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>`,
  },
  {
    name: '<br> 로 줄을 나눈 문단',
    html: `<p>첫 줄<br>둘째 줄</p>`,
  },
  {
    name: '링크와 이미지가 섞인 글',
    html: `<p>앞 <a href="https://example.com" target="_blank" rel="noopener">링크</a> 뒤 <img src="https://example.com/a.png" alt="그림" width="100"></p>`,
  },
  {
    name: '알 수 없는 태그 (details/summary)',
    html: `<details><summary>접힌 제목</summary><p>펼친 내용</p></details>`,
  },
  {
    name: '정의 목록',
    html: `<dl><dt>말</dt><dd>뜻</dd></dl>`,
  },
]

const results: Array<{ name: string; rt: ReturnType<typeof roundTrip> }> = []

describe('붙여넣기 — 우리가 만들지 않은 HTML', () => {
  describe('손실 — 글자·링크·이미지가 없어지는가', () => {
    for (const { name, html } of CASES) {
      it(name, () => {
        const rt = roundTrip(html, sagakSchema, document)
        results.push({ name, rt })

        expect(
          rt.after,
          `\n  들어간 것: ${rt.input}\n  나온 것:   ${rt.output}\n`
        ).toEqual(rt.before)
      })
    }
  })

  describe('안정 — 한 번 더 왕복해도 그대로인가', () => {
    for (const { name, html } of CASES) {
      it(name, () => {
        const rt = roundTrip(html, sagakSchema, document)

        expect(rt.again, `\n  1회: ${rt.output}\n  2회: ${rt.again}\n`).toBe(
          rt.output
        )
      })
    }
  })

  /*
   * 손실 검사로는 안 잡히는 종류입니다 — 글자는 그대로인데 **서식이 생깁니다.**
   * 구글 문서 껍데기를 잘못 읽으면 문서 전체가 굵어집니다.
   */
  describe('서식 — 없던 굵게가 생기지 않는가', () => {
    it('normal 껍데기는 굵게가 아닙니다', () => {
      const rt = roundTrip(CASES[0].html, sagakSchema, document)
      expect(rt.output, `\n  나온 것: ${rt.output}\n`).not.toContain('<strong>')
    })

    it('진짜 굵게는 굵게로 남습니다', () => {
      const rt = roundTrip(CASES[1].html, sagakSchema, document)
      expect(rt.output, `\n  나온 것: ${rt.output}\n`).toContain('<strong>')
    })
  })

  afterAll(() => {
    console.log('\n붙여넣기 — 무엇이 되어 나오는가\n')
    for (const { name, rt } of results) {
      console.log(`  [${name}]${rt.lost ? '  ← 손실' : ''}`)
      console.log(`    후: ${rt.output}`)
    }
  })
})
