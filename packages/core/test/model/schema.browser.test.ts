import { describe, it, expect, afterAll } from 'vitest'
import { sagakSchema } from '@/model/schema'
import { roundTrip } from './round-trip'

/**
 * 툴바가 만들 수 있는 것을 **하나씩** 왕복시킵니다.
 *
 * 실패해도 그 자체가 결과입니다 — 무엇이 스키마를 못 통과하는지가 곧 작업
 * 목록입니다. 그래서 검사 이름을 기능 이름으로 두고, 실패 메시지에 들어온
 * 것과 나간 것을 같이 싣습니다.
 *
 * 입력 마크업은 **코어가 실제로 만드는 것**입니다 (`packages/core/test` 의
 * 기대값에서 뽑았습니다).
 */

const CASES: Array<{ name: string; html: string }> = [
  /* 앱이 띄우는 초기 문서 그대로 */
  {
    name: '앱 초기 콘텐츠',
    html: `
<h1>사각사각</h1>
<p>글을 씁니다. 위 도구 모음으로 서식을 적용해보세요.</p>
<ul>
  <li>굵게 · 기울임 · 밑줄</li>
  <li>표, 이미지, 링크</li>
  <li>찾기/바꾸기</li>
</ul>
`.trim(),
  },

  /* 인라인 토글 여섯 */
  { name: '굵게', html: '<p><strong>굵게</strong></p>' },
  { name: '기울임', html: '<p><em>기울임</em></p>' },
  { name: '밑줄', html: '<p><u>밑줄</u></p>' },
  { name: '취소선', html: '<p><s>취소선</s></p>' },
  { name: '아래첨자', html: '<p>H<sub>2</sub>O</p>' },
  { name: '위첨자', html: '<p>x<sup>2</sup></p>' },

  /* 값이 붙는 마크 여섯 */
  { name: '글꼴', html: '<p><span style="font-family: Georgia">가나다</span></p>' },
  { name: '글자 크기', html: '<p><span style="font-size: 24px">가나다</span></p>' },
  { name: '글자 색', html: '<p><span style="color: red">가나다</span></p>' },
  {
    name: '배경 색',
    html: '<p><span style="background-color: yellow">가나다</span></p>',
  },
  {
    name: '자간',
    html: '<p><span style="letter-spacing: 2px">가나다</span></p>',
  },
  { name: '링크', html: '<p><a href="https://example.com">링크</a></p>' },

  /* 문단 속성 */
  { name: '정렬', html: '<p style="text-align: center">가운데</p>' },
  { name: '줄 간격', html: '<p style="line-height: 2">넓게</p>' },
  { name: '들여쓰기', html: '<p style="margin-left: 40px">들여씀</p>' },
  { name: '제목', html: '<h2>제목 2</h2>' },

  /* 노드 */
  { name: '순서 없는 목록', html: '<ul><li>하나</li><li>둘</li></ul>' },
  { name: '순서 있는 목록', html: '<ol><li>하나</li><li>둘</li></ol>' },
  { name: '가로줄', html: '<p>위</p><hr><p>아래</p>' },
  {
    name: '이미지',
    html: '<p><img src="https://example.com/a.png" alt=""></p>',
  },
  {
    name: '표',
    html: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
  },

  /* 레거시 마크업 — execCommand 시절 문서가 이렇게 저장돼 있습니다 */
  { name: '레거시 <b>', html: '<p><b>굵게</b></p>' },
  { name: '레거시 <i>', html: '<p><i>기울임</i></p>' },
  { name: '레거시 <font size>', html: '<p><font size="5">큼</font></p>' },
  { name: '레거시 <font color>', html: '<p><font color="#ff0000">빨강</font></p>' },

  /* 겹침 */
  {
    name: '마크 겹침',
    html: '<p><strong><em><span style="color: red">셋</span></em></strong></p>',
  },
  {
    name: '목록 안 서식',
    html: '<ul><li><strong>굵은</strong> 항목</li></ul>',
  },
]

const results: Array<{ name: string; rt: ReturnType<typeof roundTrip> }> = []

describe('HTML → PM 모델 → HTML 왕복', () => {
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

        expect(
          rt.again,
          `\n  1회: ${rt.output}\n  2회: ${rt.again}\n`
        ).toBe(rt.output)
      })
    }
  })

  afterAll(() => {
    const changed = results.filter((r) => r.rt.changed)
    if (changed.length === 0) return

    console.log(`\n마크업이 달라진 것 ${changed.length}/${results.length} — 손실은 아니지만 제품에 보입니다\n`)
    for (const { name, rt } of changed) {
      console.log(`  [${name}]`)
      console.log(`    전: ${rt.input}`)
      console.log(`    후: ${rt.output}`)
    }
  })
})
