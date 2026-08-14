import type { IconNode } from 'lucide'

/**
 * lucide 아이콘을 **SVG 요소로** 만듭니다.
 *
 * ## 왜 `lucide-preact` 를 못 쓰나
 *
 * `lucide-preact` 는 아이콘을 **Preact 컴포넌트**로 줍니다. 커스텀 엘리먼트로
 * 옮기던 때 JSX 를 안 거치는 자리에서 쓸 수 없었고, 억지로 가져오면 Preact
 * 런타임이 딸려왔습니다 — 이 이주가 없애려던 바로 그것입니다.
 *
 * 지금은 Svelte 뿐이지만 그대로 씁니다. `{@html icon(…).outerHTML}` 한 줄로
 * 끝나고, 아이콘을 컴포넌트로 감싸 봐야 얻는 것이 없습니다. 이 함수는 렌더러
 * 를 **네 번** 갈아타는 동안 한 글자도 안 바뀌었습니다.
 *
 * 형제 패키지 `lucide` 는 같은 아이콘을 **데이터**로 줍니다
 * (`[tag, attrs][]`). 프레임워크가 없습니다.
 *
 * ```
 * Minus === [["path", { d: "M5 12h14" }]]
 * ```
 *
 * ## 이름이 다를 수 있습니다
 *
 * 두 패키지의 export 이름이 항상 같지는 않습니다 — 들여쓰기 아이콘은
 * `lucide-preact` 에서 `IndentDecrease` 인데 `lucide` 에서는
 * `ListIndentDecrease` 입니다. 옮길 때 이름부터 확인해야 합니다.
 *
 * ## 속성은 lucide 기본값을 그대로 씁니다
 *
 * `stroke-width: 2` 와 `currentColor` 가 툴바 아이콘의 생김새를 정합니다.
 * 여기서 달라지면 옮긴 버튼만 굵기가 다르게 보입니다.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'

const BASE_ATTRS: Record<string, string> = {
  xmlns: SVG_NS,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}

export function icon(node: IconNode, size: number): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')

  for (const [name, value] of Object.entries(BASE_ATTRS)) {
    svg.setAttribute(name, value)
  }
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  /* 아이콘은 장식입니다 — 이름은 버튼의 `aria-label` 이 답니다 */
  svg.setAttribute('aria-hidden', 'true')

  for (const [tag, attrs] of node) {
    const child = document.createElementNS(SVG_NS, tag)
    for (const [name, value] of Object.entries(attrs)) {
      if (name === 'key') continue
      child.setAttribute(name, String(value))
    }
    svg.append(child)
  }

  return svg
}
