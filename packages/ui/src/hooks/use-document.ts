import { useCallback, useEffect, useState } from 'preact/hooks'
import type { DocumentMeta } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'
import {
  UNTITLED,
  attachDocument,
  create as createDocument,
  open as openDocument,
  readDocument,
  readNow as readContentNow,
  refresh as refreshDocuments,
  remove as removeDocument,
  rename as renameDocument,
  save as saveDocument,
  saveAs as saveDocumentAs,
  subscribeToDocument,
} from '../state/document-store'

/**
 * 열려 있는 문서 하나 — **Preact 쪽 어댑터**입니다.
 *
 * 값과 동작은 전부 `state/document-store.ts` 에 있습니다. 여기서는 그것을
 * 구독해 다시 그리고, `EditorContext` 를 받아 넘겨 주기만 합니다.
 *
 * ## 왜 얇아졌나
 *
 * 문서 줄과 문서 목록을 Svelte 로 옮기려면 둘이 같은 상태를 봐야 합니다.
 * 상태가 훅 안에 있으면 훅을 부를 수 있는 쪽만 볼 수 있으니, 밖으로 꺼내고
 * 여기는 얇은 껍데기만 남겼습니다. 이 훅도 결국 마지막에 사라집니다.
 *
 * 자세한 배경은 `docs/document-model.md` 참고.
 */

export { UNTITLED }

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
   * 내보내기처럼 저장을 거치지 않고 내용만 필요한 쪽이 씁니다. 담아 둔 값은
   * 비동기로 채워지므로 치자마자 부르면 예전 값입니다.
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
  const context = useEditorContext()
  const [, bump] = useState(0)

  /*
   * 신호는 `.value` 를 읽은 컴포넌트를 알아서 다시 그렸습니다. 저장소는
   * 그런 것이 없으므로 구독해서 직접 다시 그립니다 — 이 훅을 부른 컴포넌트가
   * 통째로 그려지는 것은 신호를 쓰기 전과 같습니다.
   */
  useEffect(() => {
    attachDocument(context)
    return subscribeToDocument(() => bump((n) => n + 1))
  }, [context])

  const snapshot = readDocument()

  return {
    ...snapshot,
    readNow: useCallback(() => readContentNow(context), [context]),
    refresh: refreshDocuments,
    create: useCallback(() => createDocument(context), [context]),
    open: useCallback((name: string) => openDocument(context, name), [context]),
    save: useCallback(() => saveDocument(context), [context]),
    saveAs: useCallback(
      (name: string) => saveDocumentAs(context, name),
      [context]
    ),
    rename: renameDocument,
    remove: removeDocument,
  }
}
