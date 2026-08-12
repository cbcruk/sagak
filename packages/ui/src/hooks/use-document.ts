import { signal } from '@preact/signals'
import { useCallback } from 'preact/hooks'
import {
  createDocumentStore,
  isDocumentStorageAvailable,
  CoreEvents,
  WysiwygEvents,
  type DocumentMeta,
} from 'sagak-core'
import { useEditorContext } from '../context/editor-context'
import { useEditorEvent } from './use-editor-event'

/**
 * 열려 있는 문서 하나 — 레거시 텍스트 에디터의 상태입니다.
 *
 * 새로 만들기 · 열기 · 저장 · 다른 이름으로 저장. 자동 저장은 **없습니다**
 * (`docs/document-model.md`). 저장은 사용자가 시킬 때만 일어납니다.
 *
 * ## `dirty` 를 플래그로 들고 있지 않습니다
 *
 * 지금 내용과 **마지막으로 저장한 내용을 비교해서** 얻습니다.
 *
 * 자동 저장에는 `isDirty` 라는 플래그가 있었고, 저장·복원·비우기 등 여러
 * 자리에서 갱신되다가 실제 상태와 어긋났습니다. 비교로 얻으면 어긋날 자리가
 * 없습니다 — 두 문자열이 같으면 안 더러운 것이고, 그게 정의입니다.
 *
 * ## 상태가 모듈에 있는 이유
 *
 * 제목 · 메뉴 · 문서 목록이 **같은 문서를 봐야** 합니다. 컴포넌트마다 사본을
 * 들면 셋이 어긋납니다. 폰트 목록에서 같은 결론에 도달했고
 * (`use-local-fonts`), 그때 컴포넌트 3개가 각자 API 를 부르던 것을 재서
 * 확인했습니다.
 */

/** 아직 이름이 없는 문서 */
export const UNTITLED = 'Untitled'

const store = createDocumentStore()

/** 열려 있는 문서 이름 — 저장한 적이 없으면 `null` */
const nameSignal = signal<string | null>(null)

/** 마지막으로 저장한 내용. 여기에 안 맞으면 더러운 것입니다 */
const savedSignal = signal<string>('')

/** 지금 편집 영역의 내용 — 내용 변경 이벤트마다 갱신합니다 */
const contentSignal = signal<string>('')

const listSignal = signal<DocumentMeta[]>([])

export interface UseDocumentReturn {
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

  /**
   * 지금 편집 영역의 내용을 그 자리에서 읽습니다.
   *
   * 내보내기처럼 저장을 거치지 않고 내용만 필요한 쪽이 씁니다. 시그널에 담긴
   * 값은 비동기로 채워지므로 치자마자 부르면 예전 값입니다.
   */
  readNow: () => Promise<string>

  refresh: () => Promise<void>
  /** 빈 문서로 시작합니다 */
  create: () => Promise<void>
  open: (name: string) => Promise<void>
  /**
   * 저장합니다.
   *
   * @throws 이름이 없으면 — 부르는 쪽이 이름을 받아 `saveAs` 를 써야 합니다
   */
  save: () => Promise<void>
  saveAs: (name: string) => Promise<void>
  /**
   * 저장된 문서의 이름을 바꿉니다.
   *
   * 열려 있는 문서가 아니어도 됩니다 — 문서 목록에서 부르기 때문입니다.
   * 바꾼 것이 지금 열어 둔 문서면 제목도 따라 바뀝니다.
   */
  rename: (from: string, to: string) => Promise<void>
  remove: (name: string) => Promise<void>
}

export function useDocument(): UseDocumentReturn {
  const { editingAreaManager } = useEditorContext()

  const readContent = useCallback(async (): Promise<string> => {
    return (await editingAreaManager?.getContent()) ?? ''
  }, [editingAreaManager])

  /*
   * 내용이 바뀌는 길은 셋입니다 — 타이핑, 서식 커맨드, 프로그램적 교체(열기·
   * 되돌리기). 셋 다 같은 자리로 모읍니다.
   */
  const sync = useCallback(() => {
    void readContent().then((content) => {
      contentSignal.value = content
    })
  }, [readContent])

  useEditorEvent(WysiwygEvents.WYSIWYG_CONTENT_CHANGED, 'after', sync)
  useEditorEvent(CoreEvents.STYLE_CHANGED, 'after', sync)
  useEditorEvent(CoreEvents.CONTENT_RESTORED, 'on', sync)

  const refresh = useCallback(async (): Promise<void> => {
    if (!isDocumentStorageAvailable()) return
    listSignal.value = await store.list()
  }, [])

  /** 편집 영역에 넣고, 그것을 저장된 상태로 삼습니다 */
  const load = useCallback(
    async (name: string | null, content: string): Promise<void> => {
      await editingAreaManager?.setContent(content)
      nameSignal.value = name
      savedSignal.value = content
      contentSignal.value = content
    },
    [editingAreaManager]
  )

  const create = useCallback(async (): Promise<void> => {
    await load(null, '')
  }, [load])

  const open = useCallback(
    async (name: string): Promise<void> => {
      await load(name, await store.read(name))
    },
    [load]
  )

  const saveAs = useCallback(
    async (name: string): Promise<void> => {
      /*
       * 저장 직전의 내용을 **그 자리에서 읽습니다.** 시그널에 담긴 값을 쓰면
       * 마지막 이벤트 이후의 타이핑이 빠질 수 있습니다.
       */
      const content = await readContent()
      await store.write(name, content)
      nameSignal.value = name
      savedSignal.value = content
      contentSignal.value = content
      await refresh()
    },
    [readContent, refresh]
  )

  const save = useCallback(async (): Promise<void> => {
    const name = nameSignal.value
    if (!name) {
      throw new Error('Untitled document — ask for a name and use saveAs')
    }
    await saveAs(name)
  }, [saveAs])

  const rename = useCallback(
    async (from: string, to: string): Promise<void> => {
      await store.rename(from, to)
      if (nameSignal.value === from) nameSignal.value = to
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (name: string): Promise<void> => {
      await store.remove(name)
      /*
       * 열어 둔 문서를 지우면 이름만 떼고 내용은 그대로 둡니다 — 화면의 글을
       * 지우는 것은 사용자가 시킨 일이 아닙니다. 이름 없는 문서가 되므로
       * 다음 저장은 이름을 묻습니다.
       */
      if (nameSignal.value === name) nameSignal.value = null
      await refresh()
    },
    [refresh]
  )

  const name = nameSignal.value

  return {
    readNow: readContent,
    name: name ?? UNTITLED,
    untitled: name === null,
    dirty: contentSignal.value !== savedSignal.value,
    available: isDocumentStorageAvailable(),
    documents: listSignal.value,
    refresh,
    create,
    open,
    save,
    saveAs,
    rename,
    remove,
  }
}
