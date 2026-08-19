import { writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import {
  createDocumentStore,
  sagakSchema,
  toJSON,
  fromJSON,
  toHtml,
  isDocumentStorageAvailable,
  subscribeToModel,
  type DocumentMeta,
  type EditorContext,
  type DocumentJSON,
} from 'sagak-core'

/**
 * 열려 있는 문서 하나 — **렌더러와 무관한 저장소**입니다.
 *
 * ## 왜 옮겼나
 *
 * 원래 이 상태는 `use-document.ts` 안에 `@preact/signals` 로 있었습니다.
 * 문서 줄과 문서 목록을 Svelte 로 옮기려면 둘이 같은 상태를 봐야 하는데,
 * 신호를 그대로 두면 Preact 가 남습니다. 서식 토글에서 신호를 걷어낸 것과
 * 같은 이유이고, 여기는 상태가 컴포넌트 여럿에 걸쳐 있어 **먼저 밖으로
 * 꺼내야** 옮길 수 있습니다.
 *
 * 규칙은 폰트 목록·선택 영역 구독에서 정한 것과 같습니다 — **컴포넌트 밖의
 * 사실은 모듈로, 컴포넌트 생애에 묶인 것만 컴포넌트에** 둡니다. 열려 있는
 * 문서는 누가 그리든 하나입니다.
 *
 * ## 값은 그대로입니다
 *
 * `dirty` 를 플래그로 안 들고 **지금 내용과 마지막 저장 내용을 비교해서**
 * 얻는 것도 그대로입니다. 자동 저장 시절 `isDirty` 플래그가 여러 자리에서
 * 갱신되다 실제와 어긋났고, 비교로 얻으면 어긋날 자리가 없습니다.
 *
 * ## 알리는 길만 `svelte/store` 로 바꿨습니다
 *
 * 안쪽 `state` 는 그대로 평범한 객체입니다. `save`·`rename`·`remove` 가
 * **그 자리에서 동기로** 읽어야 하고(`get(store)` 를 부를 자리가 아닙니다),
 * 무엇보다 **값이 그대로면 아무에게도 안 알린다**는 성질을 지켜야 하기
 * 때문입니다. `writable.update` 는 같은 값을 돌려줘도 구독자를 부릅니다.
 *
 * 그래서 바뀐 것이 있을 때만 새 스냅샷을 `documentStore` 에 넣습니다.
 */

/** 아직 이름이 없는 문서 */
export const UNTITLED = 'Untitled'

const store = createDocumentStore()

interface State {
  /** 열려 있는 문서 이름 — 저장한 적이 없으면 `null` */
  name: string | null
  /** 마지막으로 저장한 내용. 여기에 안 맞으면 더러운 것입니다 */
  saved: string
  /** 지금 편집 영역의 내용 — 내용 변경 이벤트마다 갱신합니다 */
  content: string
  list: DocumentMeta[]
}

const state: State = { name: null, saved: '', content: '', list: [] }

/** 값이 그대로면 아무에게도 안 알립니다 — 신호가 하던 것과 같습니다 */
function set(next: Partial<State>): void {
  let changed = false
  for (const key of Object.keys(next) as (keyof State)[]) {
    const value = next[key]
    if (Object.is(state[key], value)) continue
    Object.assign(state, { [key]: value })
    changed = true
  }
  if (changed) snapshot.set(readDocument())
}

export interface DocumentSnapshot {
  /** 열려 있는 문서 이름. 저장한 적이 없으면 `'Untitled'` */
  name: string
  /** 아직 한 번도 저장하지 않은 문서인가 */
  untitled: boolean
  /** 마지막 저장 이후 바뀌었는가 */
  dirty: boolean
  /** 이 브라우저가 문서를 보관할 수 있는가 */
  available: boolean
  /** 최근에 고친 것이 앞인 목록. `refresh()` 로 갱신합니다 */
  documents: DocumentMeta[]
}

export function readDocument(): DocumentSnapshot {
  return {
    name: state.name ?? UNTITLED,
    untitled: state.name === null,
    dirty: state.content !== state.saved,
    available: isDocumentStorageAvailable(),
    documents: state.list,
  }
}

const errors = writable<string | null>(null)

/**
 * 문서를 열지 못한 이유 — 없으면 `null`.
 *
 * `Node.fromJSON` 은 스키마 밖을 만나면 **던집니다.** HTML 파싱이 조용히 버리는
 * 것과 반대이고, 그 편이 낫습니다 — 반쪽 문서로 여는 것보다 안 여는 것이
 * 낫습니다. 다만 **누군가는 그 사실을 화면에 알려야** 합니다.
 *
 * 그래서 `open()` 은 던지는 대신 여기에 담고 열던 문서를 그대로 둡니다.
 */
export const documentError: Readable<string | null> = {
  subscribe: errors.subscribe,
}

const snapshot = writable<DocumentSnapshot>(readDocument())

/** 열려 있는 문서 — 컴포넌트는 `$documentStore` 로 봅니다 */
export const documentStore: Readable<DocumentSnapshot> = {
  subscribe: snapshot.subscribe,
}

/**
 * 편집 영역의 내용을 **HTML 로** 그 자리에서 읽습니다.
 *
 * 내보내기가 씁니다 — 사용자의 진짜 파일로 나가는 길이라 HTML 이 맞습니다.
 * 저장에는 `readJSON` 을 쓰십시오 (`docs/prosemirror-migration.md` §8).
 *
 * 담아 둔 값은 비동기로 채워지므로 치자마자 부르면 예전 값입니다.
 */
export async function readNow(context: EditorContext): Promise<string> {
  const doc = await context.editingAreaManager?.getContent()

  return doc ? toHtml(doc, sagakSchema, document) : ''
}

/**
 * 저장할 꼴로 읽습니다 — **모델 JSON** 입니다.
 *
 * HTML 로 저장하면 문서를 열 때마다 스키마를 통과해 목록 항목이 문단으로
 * 감싸지는 것 같은 정규화를 매번 겪습니다. JSON 은 저장한 것이 곧 모델입니다.
 */
export async function readJSON(context: EditorContext): Promise<string> {
  const doc = await context.editingAreaManager?.getContent()

  return doc ? JSON.stringify(toJSON(doc)) : ''
}

const attached = new WeakSet<EditorContext>()

/**
 * 내용 변화를 좇기 시작합니다 — **에디터 하나당 한 번**입니다.
 *
 * 예전에는 `useDocument()` 를 부른 컴포넌트마다 구독했습니다. 문서 줄과 문서
 * 목록이 함께 떠 있으면 같은 이벤트를 두 번 듣고 같은 값을 두 번 씁니다.
 * 구독을 저장소로 올리면서 한 번으로 줄었습니다.
 *
 * 해제하지 않습니다 — `EditorCore.destroy()` 가 `eventBus.clearAll()` 을
 * 부르므로 에디터와 함께 사라집니다 (신호 저장소가 하던 것과 같습니다).
 */
export function attachDocument(context: EditorContext): void {
  if (attached.has(context)) return
  attached.add(context)

  /*
   * 내용이 바뀌는 길은 셋이었습니다 — 타이핑, 서식 커맨드, 프로그램적 교체
   * (열기·되돌리기). 셋을 세 이벤트로 듣고 같은 자리로 모았습니다.
   *
   * **이제 길이 하나입니다.** 셋 다 결국 문서를 고치는 일이고, 문서를 고치는
   * 것은 트랜잭션 하나입니다. 무엇이 바뀌었는지 짐작할 필요가 없어졌습니다.
   */
  subscribeToModel(context, () => {
    void readJSON(context).then((content) => set({ content }))
  })
}

export async function refresh(): Promise<void> {
  if (!isDocumentStorageAvailable()) return
  set({ list: await store.list() })
}

/**
 * 편집 영역에 넣고, 그것을 저장된 상태로 삼습니다.
 *
 * @throws 저장물이 스키마 밖이면. `Node.fromJSON` 은 HTML 파싱과 달리 조용히
 * 버리지 않습니다 — 반쪽 문서로 여는 것보다 낫지만 **부르는 쪽이 이 오류를
 * 받아 화면에 알려야** 합니다.
 */
async function load(
  context: EditorContext,
  name: string | null,
  content: string
): Promise<void> {
  const doc = content
    ? fromJSON(JSON.parse(content) as DocumentJSON, sagakSchema)
    : sagakSchema.topNodeType.createAndFill()!

  await context.editingAreaManager?.setContent(doc)

  /*
   * **넣은 문자열이 아니라 모델이 내놓는 것**을 기준으로 삼습니다.
   *
   * 빈 문서를 `''` 로 넣어 놓고 그것을 저장된 상태로 삼으면, 모델은 빈 문단
   * 하나짜리 JSON 을 내놓으므로 열자마자 "고쳤음" 이 됩니다. 예전에는 연 뒤에
   * 아무도 다시 안 읽어서 안 드러났을 뿐입니다.
   *
   * 저장물의 글자와 모델의 직렬화가 달라도(키 순서·공백) 같은 뜻이면 같다고
   * 봐야 하는데, 그 판정도 여기서 함께 얻습니다.
   */
  const actual = await readJSON(context)

  set({ name, saved: actual, content: actual })
}

/** 빈 문서로 시작합니다 */
export async function create(context: EditorContext): Promise<void> {
  await load(context, null, '')
}

export async function open(
  context: EditorContext,
  name: string
): Promise<boolean> {
  try {
    await load(context, name, await store.read(name))
    errors.set(null)

    return true
  } catch {
    /*
     * 열던 문서는 그대로 둡니다. 여는 데 실패했다고 보고 있던 글을 잃으면
     * 안 됩니다.
     */
    errors.set(`'${name}' 을(를) 열지 못했습니다 — 저장물이 이 에디터가 아는 꼴이 아닙니다.`)

    return false
  }
}

export async function saveAs(
  context: EditorContext,
  name: string
): Promise<void> {
  /*
   * 저장 직전의 내용을 **그 자리에서 읽습니다.** 담아 둔 값을 쓰면 마지막
   * 이벤트 이후의 타이핑이 빠질 수 있습니다.
   */
  const content = await readJSON(context)
  await store.write(name, content)
  set({ name, saved: content, content })
  await refresh()
}

/**
 * 저장합니다.
 *
 * @throws 이름이 없으면 — 부르는 쪽이 이름을 받아 `saveAs` 를 써야 합니다
 */
export async function save(context: EditorContext): Promise<void> {
  if (!state.name) {
    throw new Error('Untitled document — ask for a name and use saveAs')
  }
  await saveAs(context, state.name)
}

/**
 * 저장된 문서의 이름을 바꿉니다.
 *
 * 열려 있는 문서가 아니어도 됩니다 — 문서 목록에서 부르기 때문입니다.
 * 바꾼 것이 지금 열어 둔 문서면 제목도 따라 바뀝니다.
 */
export async function rename(from: string, to: string): Promise<void> {
  await store.rename(from, to)
  if (state.name === from) set({ name: to })
  await refresh()
}

export async function remove(name: string): Promise<void> {
  await store.remove(name)
  /*
   * 열어 둔 문서를 지우면 이름만 떼고 내용은 그대로 둡니다 — 화면의 글을
   * 지우는 것은 사용자가 시킨 일이 아닙니다. 이름 없는 문서가 되므로 다음
   * 저장은 이름을 묻습니다.
   */
  if (state.name === name) set({ name: null })
  await refresh()
}
