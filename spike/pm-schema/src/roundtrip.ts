import { DOMParser, DOMSerializer } from 'prosemirror-model'
import type { Schema } from 'prosemirror-model'

/**
 * HTML → 모델 → HTML.
 *
 * 재려는 것은 "마크업이 그대로인가" 가 **아닙니다.** 스키마를 통과시키면
 * 마크업은 당연히 바뀝니다 — `<font color>` 는 `<span style>` 이 되고 목록
 * 항목 안에는 문단이 생깁니다. 그건 정규화지 손실이 아닙니다.
 *
 * 그래서 세 가지를 따로 잽니다.
 *
 * | 검사 | 뜻 |
 * | --- | --- |
 * | 손실 | 글자·링크·이미지가 **없어졌는가** — 이것만 진짜 문제입니다 |
 * | 안정 | 한 번 더 왕복해도 그대로인가 — 저장·재열기가 값을 갉지 않는가 |
 * | 변화 | 마크업이 달라졌는가 — 문제는 아니지만 **제품에 보이는** 것 |
 */

/** 뜻 없는 차이(속성 순서·따옴표·`style` 끝 세미콜론)를 지웁니다 */
export function normalize(html: string, doc: Document): string {
  const el = doc.createElement('div')
  el.innerHTML = html.trim()

  /*
   * `style` 은 파싱된 문자열이 그대로 남는데, 직렬화 쪽은 다시 쓰이며 꼴이
   * 바뀝니다. 양쪽 다 브라우저가 계산한 꼴로 덮어 맞춥니다.
   */
  for (const node of el.querySelectorAll<HTMLElement>('[style]')) {
    node.setAttribute('style', node.style.cssText)
  }
  return el.innerHTML
}

/** 무엇이 살아남아야 하는가 — 손실 판정의 기준입니다 */
export interface Content {
  text: string
  links: string[]
  images: string[]
}

export function contentOf(html: string, doc: Document): Content {
  const el = doc.createElement('div')
  el.innerHTML = html.trim()

  return {
    /*
     * 공백을 통째로 지우고 비교합니다.
     *
     * 저장된 HTML 은 블록 사이에 줄바꿈과 들여쓰기가 들어 있는데 직렬화한
     * 쪽은 붙여 씁니다. 그건 문서가 아니라 **포맷팅** 차이라 여기서 재면 안
     * 됩니다. 글자가 진짜로 없어지면 공백을 지워도 드러납니다.
     */
    text: (el.textContent ?? '').replace(/\s+/g, ''),
    links: [...el.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? ''),
    images: [...el.querySelectorAll('img')].map(
      (img) => img.getAttribute('src') ?? ''
    ),
  }
}

function convert(html: string, schema: Schema, doc: Document): string {
  const container = doc.createElement('div')
  container.innerHTML = html.trim()

  const node = DOMParser.fromSchema(schema).parse(container)
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
    node.content,
    { document: doc }
  )

  const out = doc.createElement('div')
  out.appendChild(fragment)
  return out.innerHTML
}

export interface RoundTrip {
  input: string
  output: string
  /** 한 번 더 왕복한 결과 — `output` 과 같아야 합니다 */
  again: string
  before: Content
  after: Content
  changed: boolean
  stable: boolean
  lost: boolean
}

export function roundTrip(
  html: string,
  schema: Schema,
  doc: Document
): RoundTrip {
  const output = convert(html, schema, doc)
  const again = convert(output, schema, doc)

  const input = normalize(html, doc)
  const normalized = normalize(output, doc)

  const before = contentOf(html, doc)
  const after = contentOf(output, doc)

  return {
    input,
    output: normalized,
    again: normalize(again, doc),
    before,
    after,
    changed: input !== normalized,
    stable: normalize(again, doc) === normalized,
    lost:
      before.text !== after.text ||
      before.links.join('|') !== after.links.join('|') ||
      before.images.join('|') !== after.images.join('|'),
  }
}
