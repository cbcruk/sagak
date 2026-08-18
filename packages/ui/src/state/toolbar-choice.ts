import { atom } from 'nanostores'
import type { WritableAtom } from 'nanostores'
import type { EditorContext } from 'sagak-core'

/**
 * "안 따라가는" 툴바 드롭다운이 **마지막으로 고른 값**을 둡니다.
 *
 * ## 왜 필요한가
 *
 * 줄 간격·자간은 문서에서 값을 읽어 오지 않습니다 (읽을 데가 마땅치 않습니다
 * — 블록마다 다를 수 있습니다). 그래서 "고른 값" 자체가 상태인데, 그 값을
 * 보는 자리가 **둘**이 됐습니다.
 *
 * - 툴바의 `<select>` (`ToolbarSelect`)
 * - 더보기 메뉴의 하위 목록 (`MoreMenu`) — 좁은 화면에서 유일한 길입니다
 *
 * 각자 들고 있으면 메뉴에서 2.0 을 골라도 툴바는 1.5 를 가리킵니다. 한
 * 자리에서 보게 합니다.
 *
 * ## 에디터마다 따로입니다
 *
 * 처음엔 명세(`toolbar-select.specs`)에 `atom` 을 하나씩 박았습니다. 그러면
 * **모듈 하나에 값 하나**라, 한 페이지에 에디터가 둘이면 한쪽에서 고른 줄
 * 간격이 다른 쪽 툴바에도 비칩니다. 예전 `defaultValue` 는 인스턴스마다
 * 따로였으니 오히려 뒷걸음이었습니다.
 *
 * 검사가 잡았습니다 — 앞 테스트가 고른 값이 다음 테스트로 넘어왔습니다.
 *
 * 그래서 `EditorContext` 로 칸을 나눕니다. `subscribeToSelection` 이 추적기를
 * 에디터마다 두는 것과 같은 방식이고, `WeakMap` 이라 에디터가 사라지면 같이
 * 사라집니다.
 *
 * ## 폰트 목록과는 반대입니다
 *
 * `local-fonts` 는 **모듈 하나에 값 하나가 맞습니다** — 설치된 폰트는 그
 * 기계의 사실이라 에디터가 몇 개든 같습니다. 여기 값은 그 에디터의 툴바에서
 * 무엇을 골랐는가라, 나눠야 합니다. 같은 `state/` 에 있지만 이유가 정반대인
 * 두 저장소입니다.
 */

type Bucket = Map<string, WritableAtom<string>>

const buckets = new WeakMap<EditorContext, Bucket>()

function bucketFor(editor: EditorContext): Bucket {
  let bucket = buckets.get(editor)
  if (!bucket) {
    bucket = new Map()
    buckets.set(editor, bucket)
  }
  return bucket
}

/**
 * 이 에디터의 `key` 칸을 줍니다 — 없으면 `initial` 로 만듭니다.
 *
 * 같은 (에디터, key) 로 몇 번을 불러도 **같은 저장소**가 나옵니다. 그래야
 * 툴바와 더보기 메뉴가 한 자리를 봅니다.
 */
export function choiceStore(
  editor: EditorContext,
  key: string,
  initial: string
): WritableAtom<string> {
  const bucket = bucketFor(editor)

  let store = bucket.get(key)
  if (!store) {
    store = atom(initial)
    bucket.set(key, store)
  }
  return store
}
