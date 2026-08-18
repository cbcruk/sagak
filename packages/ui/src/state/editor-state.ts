import type { Readable } from 'svelte/store'
import type { EditorContext } from 'sagak-core'
import { historyStore, historyCommands } from './history'
import type { HistoryState, HistoryCommands } from './history'
import { formattingStore, formattingCommands } from './formatting'
import type { FormattingState, FormattingCommands } from './formatting'
import { alignmentStore, alignmentCommands } from './alignment'
import type { AlignmentCommands } from './alignment'
import { listStore, listCommands } from './list'
import type { ListCommands } from './list'
import { linkStore } from './link'
import { tableStore } from './table'
import { fontFamilyStore } from './font-family'
import type { AlignmentType } from '../components/alignment-buttons/alignment-buttons.shared'
import type { ListType } from '../components/list-buttons/list-buttons.shared'

/**
 * 에디터 하나가 갖는 store 를 **한 자리에** 모읍니다.
 *
 * ## `WeakMap` 이 저장소 전체에 하나입니다
 *
 * 처음에는 store 를 만드는 파일마다 `WeakMap` 을 하나씩 뒀습니다. 둘일 때는
 * 안 보이지만 여덟이 되면 같은 캐시 코드가 여덟 번입니다. 도메인 파일
 * (`history.ts` 등)은 이제 **만들기만** 하고, 에디터당 하나로 지키는 일은
 * 여기서 합니다.
 *
 * ## 통째로 만들어도 비용이 없습니다
 *
 * `readable` 은 첫 구독자가 붙기 전에는 `start` 를 돌리지 않습니다. 아무도 안
 * 보는 store 는 버스 구독조차 걸지 않은 객체 한 칸입니다. 그래서 쓰든 안 쓰든
 * 묶음을 다 만들어 둘 수 있고, 컴포넌트는 필요한 것만 destructure 합니다.
 *
 * ## 여기 안 들어가는 것
 *
 * **문서 저장소는 에디터별이 아닙니다** (`document-store.ts`). 열린 문서는 앱에
 * 하나라 모듈 하나가 맞습니다. 설치된 글꼴(`local-fonts.ts`)도 기계의 사실이라
 * 마찬가지입니다. 여기 들어오는 것은 "이 에디터의 지금 상태"뿐입니다.
 */
export interface EditorState {
  history: Readable<HistoryState>
  formatting: Readable<FormattingState>
  alignment: Readable<AlignmentType>
  list: Readable<ListType>
  /** 캐럿이 링크 위인지 */
  link: Readable<boolean>
  /** 캐럿이 표 안인지 */
  table: Readable<boolean>
  /** 캐럿이 놓인 자리의 글꼴 이름 (날것) */
  fontFamily: Readable<string>
}

export interface EditorCommands {
  history: HistoryCommands
  formatting: FormattingCommands
  alignment: AlignmentCommands
  list: ListCommands
}

const bundles = new WeakMap<EditorContext, EditorState>()

export function editorState(editor: EditorContext): EditorState {
  let bundle = bundles.get(editor)
  if (!bundle) {
    bundle = {
      history: historyStore(editor),
      formatting: formattingStore(editor),
      alignment: alignmentStore(editor),
      list: listStore(editor),
      link: linkStore(editor),
      table: tableStore(editor),
      fontFamily: fontFamilyStore(editor),
    }
    bundles.set(editor, bundle)
  }
  return bundle
}

/**
 * 명령은 store 가 아니라 함수입니다 — 들고 있을 값이 없습니다.
 *
 * 그래서 캐시도 없습니다. 부를 때마다 새로 묶어도 닫힌 함수 몇 개일 뿐이고,
 * 같은 `editor` 로 부르면 하는 일도 같습니다.
 */
export function editorCommands(editor: EditorContext): EditorCommands {
  return {
    history: historyCommands(editor),
    formatting: formattingCommands(editor),
    alignment: alignmentCommands(editor),
    list: listCommands(editor),
  }
}
