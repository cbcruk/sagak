import { Schema } from 'prosemirror-model'
import type { NodeSpec, MarkSpec } from 'prosemirror-model'
import { addListNodes } from 'prosemirror-schema-list'
import { tableNodes } from 'prosemirror-tables'

/**
 * sagak 툴바가 **만들 수 있는 것 전부**를 ProseMirror 스키마로 적습니다.
 *
 * 이 파일의 목적은 스키마 설계가 아니라 **왕복 검증의 재료**입니다. 지금
 * 문서(OPFS 에 `innerHTML` 로 들어 있는 HTML)를 `DOMParser` 로 읽고
 * `DOMSerializer` 로 다시 쓸 때 무엇이 남고 무엇이 사라지는지를 봅니다.
 * 사라지는 것이 곧 스키마 작업 목록입니다.
 *
 * 파싱 규칙은 **코어가 실제로 만드는 마크업**에서 뽑았습니다 (테스트 기대값
 * 기준):
 *
 *   <span style="color: red">      <span style="font-family: Georgia">
 *   <span style="font-size: 24px">  <font size="5">        ← 레거시
 *   <p style="text-align: left">    <p style="margin-left: 40px">  ← 들여쓰기
 */

const BLOCK_ATTRS = {
  align: { default: null as string | null },
  lineHeight: { default: null as string | null },
  /** `margin-left: 40px` 단위로 들어옵니다 */
  indent: { default: null as string | null },
}

function readBlockAttrs(el: HTMLElement): Record<string, string | null> {
  return {
    align: el.style.textAlign || null,
    lineHeight: el.style.lineHeight || null,
    indent: el.style.marginLeft || null,
  }
}

function blockStyle(attrs: Record<string, unknown>): string | undefined {
  const parts: string[] = []
  if (attrs.align) parts.push(`text-align: ${String(attrs.align)}`)
  if (attrs.lineHeight) parts.push(`line-height: ${String(attrs.lineHeight)}`)
  if (attrs.indent) parts.push(`margin-left: ${String(attrs.indent)}`)
  return parts.length ? parts.join('; ') : undefined
}

const doc: NodeSpec = { content: 'block+' }

const paragraph: NodeSpec = {
  group: 'block',
  content: 'inline*',
  attrs: BLOCK_ATTRS,
  parseDOM: [{ tag: 'p', getAttrs: (el) => readBlockAttrs(el as HTMLElement) }],
  toDOM: (node) => {
    const style = blockStyle(node.attrs)
    return ['p', style ? { style } : {}, 0]
  },
}

const heading: NodeSpec = {
  group: 'block',
  content: 'inline*',
  defining: true,
  attrs: { level: { default: 1 }, ...BLOCK_ATTRS },
  parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
    tag: `h${level}`,
    getAttrs: (el: HTMLElement | string) => ({
      level,
      ...readBlockAttrs(el as HTMLElement),
    }),
  })),
  toDOM: (node) => {
    const style = blockStyle(node.attrs)
    return [`h${String(node.attrs.level)}`, style ? { style } : {}, 0]
  },
}

const horizontalRule: NodeSpec = {
  group: 'block',
  parseDOM: [{ tag: 'hr' }],
  toDOM: () => ['hr'],
}

const image: NodeSpec = {
  group: 'inline',
  inline: true,
  draggable: true,
  attrs: {
    src: {},
    alt: { default: null },
    width: { default: null },
    height: { default: null },
  },
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs: (dom) => {
        const el = dom as HTMLImageElement
        return {
          src: el.getAttribute('src'),
          alt: el.getAttribute('alt'),
          width: el.getAttribute('width') ?? (el.style.width || null),
          height: el.getAttribute('height') ?? (el.style.height || null),
        }
      },
    },
  ],
  toDOM: (node) => ['img', node.attrs],
}

const text: NodeSpec = { group: 'inline' }

const hardBreak: NodeSpec = {
  group: 'inline',
  inline: true,
  selectable: false,
  parseDOM: [{ tag: 'br' }],
  toDOM: () => ['br'],
}

/** `<span style="…">` 하나에 값을 담는 마크들 — 여섯 개가 같은 꼴입니다 */
function styleMark(property: string, legacy?: NodeSpec['parseDOM']): MarkSpec {
  return {
    attrs: { value: {} },
    parseDOM: [
      {
        style: property,
        getAttrs: (value) => ({ value: String(value) }),
      },
      ...(legacy ?? []),
    ],
    toDOM: (mark) => [
      'span',
      { style: `${property}: ${String(mark.attrs.value)}` },
      0,
    ],
  }
}

const marks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => ({
          href: (dom as HTMLElement).getAttribute('href'),
          title: (dom as HTMLElement).getAttribute('title'),
        }),
      },
    ],
    toDOM: (mark) => ['a', mark.attrs, 0],
  },
  strong: {
    /*
     * `<b>` 를 곧이곧대로 믿으면 안 됩니다.
     *
     * 구글 문서는 **굵지 않은 글에도** `<b>` 껍데기를 씌우고
     * `font-weight: normal` 로 되돌립니다. 태그만 보면 붙여넣은 문서가 통째로
     * 굵어집니다 — 스파이크의 붙여넣기 검사가 실제로 그렇게 나왔습니다.
     *
     * 그래서 세 갈래로 봅니다. `<b>` 는 스스로 normal 이라 말하면 무시하고,
     * `font-weight: 400` 은 **바깥에서 씌운 굵게를 벗기고**(`clearMark`),
     * 굵기 값은 숫자까지 받습니다.
     */
    parseDOM: [
      { tag: 'strong' },
      {
        tag: 'b',
        getAttrs: (dom) =>
          (dom as HTMLElement).style.fontWeight !== 'normal' && null,
      },
      {
        style: 'font-weight=400',
        clearMark: (mark) => mark.type.name === 'strong',
      },
      {
        style: 'font-weight',
        getAttrs: (value) =>
          /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
      },
    ],
    toDOM: () => ['strong', 0],
  },
  em: {
    parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
    toDOM: () => ['em', 0],
  },
  underline: {
    parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
    toDOM: () => ['u', 0],
  },
  strikethrough: {
    parseDOM: [
      { tag: 's' },
      { tag: 'strike' },
      { style: 'text-decoration=line-through' },
    ],
    toDOM: () => ['s', 0],
  },
  subscript: { parseDOM: [{ tag: 'sub' }], toDOM: () => ['sub', 0] },
  superscript: { parseDOM: [{ tag: 'sup' }], toDOM: () => ['sup', 0] },

  fontFamily: styleMark('font-family'),
  fontSize: styleMark('font-size', [
    /* 레거시 `<font size="1~7">` — execCommand 시절 마크업입니다 */
    {
      tag: 'font[size]',
      getAttrs: (dom) => ({
        value: LEGACY_FONT_SIZES[(dom as HTMLElement).getAttribute('size') ?? ''] ?? '16px',
      }),
    },
  ]),
  letterSpacing: styleMark('letter-spacing'),
  textColor: styleMark('color', [
    {
      tag: 'font[color]',
      getAttrs: (dom) => ({
        value: (dom as HTMLElement).getAttribute('color') ?? '',
      }),
    },
  ]),
  backgroundColor: styleMark('background-color'),
}

/** `execCommand('fontSize')` 의 1~7 스케일 — 코어가 쓰던 값 */
const LEGACY_FONT_SIZES: Record<string, string> = {
  '1': '10px',
  '2': '13px',
  '3': '16px',
  '4': '18px',
  '5': '24px',
  '6': '32px',
  '7': '48px',
}

const baseNodes = {
  doc,
  paragraph,
  heading,
  horizontal_rule: horizontalRule,
  image,
  text,
  hard_break: hardBreak,
}

/* 목록과 표는 기성품입니다 — 스파이크에 없던 노드 스키마 8개 중 5개가 여기서 덮입니다 */
const withLists = addListNodes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new Schema({ nodes: baseNodes, marks }).spec.nodes as any,
  'paragraph block*',
  'block'
)

const withTables = withLists.append(
  tableNodes({ tableGroup: 'block', cellContent: 'block+', cellAttributes: {} })
)

export const sagakSchema = new Schema({ nodes: withTables, marks })
