import {
  createDocumentStore,
  isDocumentStorageAvailable,
  CoreEvents,
  WysiwygEvents,
  type DocumentMeta,
  type EditorContext,
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
 */

/** 아직 이름이 없는 문서 */
export const UNTITLED = 'Untitled'

const store = createDocumentStore()

type Listener = () => void

const listeners = new Set<Listener>()

/** 어느 값이 바뀌든 한 번만 알립니다 — 부르는 쪽은 필요한 것만 다시 읽습니다 */
function notify(): void {
  for (const listener of listeners) listener()
}

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
  if (changed) notify()
}

export function subscribeToDocument(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
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

/**
 * 편집 영역의 내용을 **그 자리에서** 읽습니다.
 *
 * 내보내기처럼 저장을 거치지 않고 내용만 필요한 쪽이 씁니다. 담아 둔 값은
 * 비동기로 채워지므로 치자마자 부르면 예전 값입니다.
 */
export async function readNow(context: EditorContext): Promise<string> {
  return (await context.editingAreaManager?.getContent()) ?? ''
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
   * 내용이 바뀌는 길은 셋입니다 — 타이핑, 서식 커맨드, 프로그램적 교체
   * (열기·되돌리기). 셋 다 같은 자리로 모읍니다.
   */
  const sync = (): void => {
    void readNow(context).then((content) => set({ content }))
  }

  context.eventBus.on(WysiwygEvents.WYSIWYG_CONTENT_CHANGED, 'after', sync)
  context.eventBus.on(CoreEvents.STYLE_CHANGED, 'after', sync)
  context.eventBus.on(CoreEvents.CONTENT_RESTORED, 'on', sync)
}

export async function refresh(): Promise<void> {
  if (!isDocumentStorageAvailable()) return
  set({ list: await store.list() })
}

/** 편집 영역에 넣고, 그것을 저장된 상태로 삼습니다 */
async function load(
  context: EditorContext,
  name: string | null,
  content: string
): Promise<void> {
  await context.editingAreaManager?.setContent(content)
  set({ name, saved: content, content })
}

/** 빈 문서로 시작합니다 */
export async function create(context: EditorContext): Promise<void> {
  await load(context, null, '')
}

export async function open(
  context: EditorContext,
  name: string
): Promise<void> {
  await load(context, name, await store.read(name))
}

export async function saveAs(
  context: EditorContext,
  name: string
): Promise<void> {
  /*
   * 저장 직전의 내용을 **그 자리에서 읽습니다.** 담아 둔 값을 쓰면 마지막
   * 이벤트 이후의 타이핑이 빠질 수 있습니다.
   */
  const content = await readNow(context)
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
