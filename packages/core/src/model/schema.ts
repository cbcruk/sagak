import { Schema } from 'prosemirror-model'
import type { NodeSpec, MarkSpec } from 'prosemirror-model'
import { addListNodes } from 'prosemirror-schema-list'
import { tableNodes } from 'prosemirror-tables'

/**
 * sagak 문서 모델의 스키마 — **툴바가 만들 수 있는 것 전부**입니다.
 *
 * `spike/pm-schema` 에서 재고 옮겨 왔습니다. 결정과 근거는
 * `docs/prosemirror-migration.md` §7·§8 에 있고, 스파이크에는 그 측정
 * (합친 마크와 나눈 마크 비교, 인용·코드블록 유무 비교)이 남아 있습니다.
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

/**
 * 위험한 주소를 **모델 문턱에서** 막습니다.
 *
 * 지금은 DOMPurify 가 DOM 에 넣기 직전에 걸러 줍니다. 그런데 그 문은 두 가지를
 * 못 지킵니다.
 *
 * 1. `EditorView` 가 DOM 을 소유하면 `innerHTML` 을 거치는 자리가 없어집니다
 * 2. **JSON 저장 경로는 HTML 을 아예 안 지납니다** (`setJSON`)
 *
 * 그래서 스키마에서 막습니다. 여기서 막으면 어느 길로 들어오든 — 붙여넣기,
 * HTML, 저장물 — 모델에 위험한 주소가 **담기지 않습니다.**
 *
 * `data:` 는 막지 않습니다. 이미지 업로드가 그 꼴로 들어오고, 그건 실행되지
 * 않습니다.
 */
const UNSAFE_URL = /^\s*(?:javascript|vbscript)\s*:/i

function safeUrl(value: string | null): string | null {
  if (!value) return null

  /* `&#106;avascript:` 같은 우회를 막으려면 엔티티를 먼저 풀어야 합니다 */
  const probe = document.createElement('textarea')
  probe.innerHTML = value

  return UNSAFE_URL.test(probe.value) ? null : value
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

/**
 * 이미지.
 *
 * `align` 이 있는 이유는 **문단에도 있기 때문**입니다 — 정렬은 글이 어디에
 * 놓이는가라는 문서의 뜻이고, 그래서 모델이 압니다. 반대로 테두리는 생김새라
 * 스타일시트의 몫입니다 (`docs/prosemirror-migration.md` §10).
 */
const image: NodeSpec = {
  group: 'inline',
  inline: true,
  draggable: true,
  attrs: {
    src: {},
    alt: { default: null },
    width: { default: null },
    height: { default: null },
    align: { default: null as string | null },
  },
  parseDOM: [
    {
      tag: 'img[src]',
      getAttrs: (dom) => {
        const el = dom as HTMLImageElement
        const src = safeUrl(el.getAttribute('src'))

        if (!src) return false

        return {
          src,
          alt: el.getAttribute('alt'),
          width: el.getAttribute('width') ?? (el.style.width || null),
          height: el.getAttribute('height') ?? (el.style.height || null),
          align: readImageAlign(el),
        }
      },
    },
  ],
  /*
   * 크기는 **스타일로** 나갑니다.
   *
   * `width` HTML 속성은 숫자만 받는데 제품이 다루는 값은 `'200px'` 처럼 단위가
   * 붙습니다. 속성으로 내보내면 브라우저가 무시해 크기가 안 먹습니다.
   * 읽을 때는 속성과 스타일 둘 다 받으므로(위 `getAttrs`) 밖에서 온 문서도
   * 그대로 통과합니다.
   */
  toDOM: (node) => {
    const { src, alt, width, height, align } = node.attrs as Record<
      string,
      string | null
    >
    const style = [
      width && `width: ${withUnit(width)}`,
      height && `height: ${withUnit(height)}`,
      ...imageAlignStyle(align),
    ]
      .filter(Boolean)
      .join('; ')

    return [
      'img',
      {
        src,
        ...(alt ? { alt } : {}),
        ...(style ? { style } : {}),
      },
    ]
  },
}

/** `'200'` 처럼 단위 없는 값은 픽셀로 봅니다 — HTML 속성이 그 뜻입니다 */
function withUnit(value: string): string {
  return /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value
}

/**
 * 이미지 정렬은 **여백으로** 그립니다.
 *
 * `text-align` 은 인라인 요소인 이미지에 안 통해서, 블록으로 만들고 좌우 여백을
 * `auto` 로 미는 방식입니다. 예전 `applyImageAlignment` 이 하던 것과 같은 꼴이라
 * 그때 만들어진 문서도 그대로 읽힙니다.
 */
function imageAlignStyle(align: string | null): string[] {
  if (!align || align === 'none') return []

  const margins: Record<string, string> = {
    left: 'margin-right: auto',
    right: 'margin-left: auto',
    center: 'margin-left: auto; margin-right: auto',
  }

  return margins[align] ? ['display: block', margins[align]] : []
}

function readImageAlign(el: HTMLElement): string | null {
  if (el.style.display !== 'block') return null

  const left = el.style.marginLeft === 'auto'
  const right = el.style.marginRight === 'auto'

  if (left && right) return 'center'
  if (left) return 'right'
  if (right) return 'left'

  return null
}

const text: NodeSpec = { group: 'inline' }

/**
 * 줄바꿈 — 다만 **채움용 `<br>` 은 줄바꿈이 아닙니다.**
 *
 * contentEditable 은 빈 블록에 캐럿을 놓지 못해서 브라우저와 우리 둘 다 빈
 * 문단에 `<br>` 을 채워 넣습니다. 그것까지 줄바꿈으로 읽으면 **빈 문단이
 * 저장될 때마다 없던 줄바꿈이 하나씩 생깁니다.**
 *
 * 그래서 블록의 **유일한 자식**인 `<br>` 은 무시합니다. `a<br>b` 처럼 옆에
 * 무엇이 있는 것만 진짜 줄바꿈입니다.
 */
const hardBreak: NodeSpec = {
  group: 'inline',
  inline: true,
  selectable: false,
  parseDOM: [
    {
      tag: 'br',
      getAttrs: (dom) => {
        const parent = (dom as HTMLElement).parentElement
        const filler = !!parent && parent.childNodes.length === 1

        return filler ? false : null
      },
    },
  ],
  toDOM: () => ['br'],
}

/**
 * 값 붙는 마크를 **하나로 합친** 꼴 — `textStyle` 후보입니다.
 *
 * 붙여넣기에서 `<span>` 이 겹겹이 쌓이는 것을 막으려는 것인데, 합치면 잃는
 * 것이 생깁니다. 어느 쪽이 나은지는 `style-marks.test.ts` 가 잽니다.
 */
const STYLE_PROPS = {
  fontFamily: 'font-family',
  fontSize: 'font-size',
  letterSpacing: 'letter-spacing',
  color: 'color',
  backgroundColor: 'background-color',
} as const

type StyleProp = keyof typeof STYLE_PROPS

function readStyles(el: HTMLElement): Record<StyleProp, string | null> {
  return {
    fontFamily: el.style.fontFamily || null,
    fontSize: el.style.fontSize || null,
    letterSpacing: el.style.letterSpacing || null,
    color: el.style.color || null,
    backgroundColor: el.style.backgroundColor || null,
  }
}

const textStyleMark: MarkSpec = {
  attrs: Object.fromEntries(
    (Object.keys(STYLE_PROPS) as StyleProp[]).map((key) => [
      key,
      { default: null },
    ])
  ),
  parseDOM: [
    {
      tag: 'span[style]',
      getAttrs: (dom) => {
        const attrs = readStyles(dom as HTMLElement)
        return Object.values(attrs).some(Boolean) ? attrs : false
      },
    },
    {
      tag: 'font[color]',
      getAttrs: (dom) => ({
        color: (dom as HTMLElement).getAttribute('color'),
      }),
    },
    {
      tag: 'font[size]',
      getAttrs: (dom) => ({
        fontSize:
          LEGACY_FONT_SIZES[(dom as HTMLElement).getAttribute('size') ?? ''] ??
          '16px',
      }),
    },
  ],
  toDOM: (mark) => {
    const style = (Object.keys(STYLE_PROPS) as StyleProp[])
      .filter((key) => mark.attrs[key])
      .map((key) => `${STYLE_PROPS[key]}: ${String(mark.attrs[key])}`)
      .join('; ')
    return ['span', { style }, 0]
  },
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

const baseMarks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => {
          const href = safeUrl((dom as HTMLElement).getAttribute('href'))

          /* 주소가 위험하면 링크를 안 답니다 — 글자는 그대로 남습니다 */
          if (!href) return false

          return { href, title: (dom as HTMLElement).getAttribute('title') }
        },
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

/** 값 붙는 마크 다섯을 뺀 나머지 — 합친 꼴에서 쓰는 바탕입니다 */
const STYLE_MARK_NAMES = [
  'fontFamily',
  'fontSize',
  'letterSpacing',
  'textColor',
  'backgroundColor',
] as const

function marksFor(textStyle: boolean): Record<string, MarkSpec> {
  if (!textStyle) return baseMarks

  const rest = Object.fromEntries(
    Object.entries(baseMarks).filter(
      ([name]) => !STYLE_MARK_NAMES.includes(name as never)
    )
  )
  return { ...rest, textStyle: textStyleMark }
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

/**
 * 툴바에는 없지만 **붙여넣기로는 들어오는** 블록들.
 *
 * 스키마에 없으면 문단으로 풀립니다 — 글자는 남고 구조만 사라집니다. 넣으면
 * 붙여넣기가 원문에 가까워지지만, 툴바가 만들 수 없는 것을 문서가 갖게 되고
 * 내보내기·CSS 도 따라와야 합니다.
 */
const blockquote: NodeSpec = {
  group: 'block',
  content: 'block+',
  defining: true,
  parseDOM: [{ tag: 'blockquote' }],
  toDOM: () => ['blockquote', 0],
}

const codeBlock: NodeSpec = {
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
  toDOM: () => ['pre', ['code', 0]],
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

export interface SchemaOptions {
  /** 값 붙는 마크 다섯을 `textStyle` 하나로 합칩니다 */
  textStyle?: boolean
  /** 인용·코드블록을 스키마에 넣습니다 */
  richBlocks?: boolean
}

export function createSagakSchema(options: SchemaOptions = {}): Schema {
  const marks = marksFor(options.textStyle ?? false)

  const nodes: Record<string, NodeSpec> = options.richBlocks
    ? { ...baseNodes, blockquote, code_block: codeBlock }
    : baseNodes

  /* 목록과 표는 기성품입니다 — 스파이크에 없던 노드 스키마 8개 중 5개가 여기서 덮입니다 */
  const withLists = addListNodes(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Schema({ nodes, marks }).spec.nodes as any,
    'paragraph block*',
    'block'
  )

  const withTables = withLists.append(
    tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {},
    })
  )

  return new Schema({ nodes: withTables, marks })
}

/**
 * 지금 결정 — **마크는 나누고, 인용·코드블록은 넣습니다.** 둘 다 쟀습니다.
 *
 * ## 마크를 안 합치는 이유 (`style-marks.test.ts`)
 *
 * 합치면 겹은 확실히 줄지만(최대 5겹 → 1겹) ProseMirror 에서 **같은 종류의
 * 마크는 한 번만 붙습니다.** 겹친 `<span>` 은 안쪽이 바깥을 밀어내고, 밀려난
 * 속성은 사라집니다.
 *
 *     <span style="font-family: Georgia"><span style="color: red">글
 *     합침 → <span style="color: red">글        ← 글꼴이 없어졌습니다
 *
 * 그리고 저 꼴은 남의 것이 아니라 **툴바가 만드는 꼴**입니다 — 글꼴을 주고
 * 색을 주면 저렇게 됩니다. 네 케이스 중 셋에서 속성을 잃었습니다. 겹치는
 * `<span>` 은 보기 싫을 뿐이고, 잃는 것은 서식입니다.
 *
 * ## 인용·코드블록을 넣는 이유 (`rich-blocks.test.ts`)
 *
 * 코드블록이 결정적입니다. 안 넣으면 `<pre>` 가 문단으로 풀리며 **줄바꿈과
 * 들여쓰기가 사라집니다.**
 *
 *     function f() {          →  function f() {   return 1 }
 *       return 1
 *     }
 *
 * 이건 구조 변화가 아니라 손실인데, 손실 검사가 공백을 지우고 비교하는 바람에
 * 통과하고 있었습니다 (`roundtrip.ts` 의 `contentOf`). 잣대가 못 보던 자리입니다.
 *
 * 인용은 그만큼 세지 않습니다 — 글자는 남고 구조만 풀립니다. 코드블록을 넣는
 * 김에 같이 넣습니다.
 *
 * **딸려 오는 일**: `blockquote`·`pre` 의 CSS, 내보내기 경로 확인, 그리고
 * 툴바가 만들 수 없는 것을 문서가 갖게 된다는 것 — 나중에 커맨드를 붙일지는
 * 따로 정합니다.
 */
export const sagakSchema = createSagakSchema({ richBlocks: true })
