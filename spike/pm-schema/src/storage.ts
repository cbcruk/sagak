import { DOMParser, DOMSerializer, Node } from 'prosemirror-model'
import type { Schema } from 'prosemirror-model'

/**
 * 저장물과 문서 사이를 오가는 네 갈래.
 *
 * **JSON 이 진실입니다.** OPFS 에 들어가는 것도, 되돌리기가 다루는 것도 모델
 * 이고, HTML 은 내보내기·소스 보기·붙여넣기가 쓰는 **바깥 형식**입니다.
 *
 * 지금(`innerHTML` 저장)과 갈리는 지점이 여기입니다. HTML 로 저장하면 문서를
 * 열 때마다 스키마를 통과하므로 목록 항목이 문단으로 감싸지는 것 같은 정규화를
 * 매번 겪습니다. JSON 은 그 왕복이 없습니다 — 저장한 것이 곧 모델입니다.
 */

export type DocumentJSON = ReturnType<Node['toJSON']>

export function toJSON(doc: Node): DocumentJSON {
  return doc.toJSON()
}

/**
 * @throws 스키마에 없는 노드·마크가 들어 있으면.
 *
 * HTML 파싱은 모르는 것을 조용히 버리지만 이쪽은 던집니다. 저장물이 깨졌을 때
 * 반쪽 문서로 여는 것보다 낫지만, **부르는 쪽이 그 오류를 받아 줘야** 합니다.
 */
export function fromJSON(json: DocumentJSON, schema: Schema): Node {
  return Node.fromJSON(schema, json)
}

export function toHtml(doc: Node, schema: Schema, dom: Document): string {
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
    doc.content,
    { document: dom }
  )
  const out = dom.createElement('div')
  out.appendChild(fragment)
  return out.innerHTML
}

export function parseHtml(html: string, schema: Schema, dom: Document): Node {
  const container = dom.createElement('div')
  container.innerHTML = html.trim()
  return DOMParser.fromSchema(schema).parse(container)
}
