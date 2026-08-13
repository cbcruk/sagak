import type { ComponentChildren, JSX } from 'preact'
import { useCallback, useEffect } from 'preact/hooks'
import { Menubar, MenubarItem } from 'kinu'
import { useDocument } from '../../hooks'
import { DocumentDialog } from '../document-dialog/document-dialog'
import { canSaveToComputer, saveToComputer } from './document-bar.utils'

/**
 * 문서 줄 — 레거시 텍스트 에디터의 제목과 메뉴입니다.
 *
 * 새로 만들기 · 열기 · 저장(⌘S) · 다른 이름으로 저장. 자동 저장은 없으므로
 * **저장은 여기서만 일어납니다** (`docs/document-model.md`).
 *
 * ## 동작은 kinu `Menubar` 가 아니라 여기 그대로 있습니다
 *
 * 메뉴 자리는 kinu 의 `Menubar`/`MenubarItem` 입니다. 다만 이건 **모양을
 * 넘긴 것**이지 동작을 넘긴 것이 아닙니다 — 항목은 여전히 한 번 누르면 그
 * 동작이 바로 일어납니다.
 *
 * 드롭다운(`File ▾` 안에 다섯 개)으로 접지 않은 이유는 저장이 **두 번
 * 클릭**이 되기 때문입니다. 자동 저장이 없는 에디터에서 가장 자주 누르는
 * 것이 저장인데, 그걸 한 겹 안으로 넣는 것은 모양을 위해 사용을 나쁘게
 * 만드는 쪽입니다. `MenubarItem` 은 이미 열린 드롭다운이 있을 때만
 * 마우스로 건너뛰는 동작을 갖고 있어서, 드롭다운이 없는 지금은 아무
 * 부작용도 없습니다.
 *
 * ## 저장 상태가 여기 있는 이유
 *
 * 예전 자동 저장 표시는 툴바 구석에서 `Unsaved changes` 와 `Saved at …` 를
 * 오갔고, 사람처럼 3번 치고 쉬면 **6번** 바뀌었습니다. 글 쓰는 내내 시야
 * 가장자리가 움직여서 결국 내렸습니다.
 *
 * 문서에 이름이 생기면 그 자리가 제목 옆이 됩니다. 바뀌는 것은 점 하나뿐이고,
 * 2초마다가 아니라 **저장할 때와 고칠 때**만 바뀝니다.
 *
 * ```
 * ● 메모.html    저장 안 됨
 *   메모.html    저장됨
 * ```
 */

/**
 * 점이 들어갈 자리는 **늘 잡아 둡니다.**
 *
 * 점이 나타났다 사라질 때 제목이 좌우로 밀리면, 예전 자동 저장 표시에서 고쳤던
 * 것과 같은 종류의 흔들림이 됩니다.
 */
const dotStyle: JSX.CSSProperties = {
  display: 'inline-block',
  width: '1em',
  flex: 'none',
  textAlign: 'center',
}

const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const titleStyle: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  fontSize: 13,
  fontWeight: 500,
}

const nameStyle: JSX.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export interface DocumentBarProps {
  /**
   * 이름을 받아 옵니다 — 기본은 브라우저 프롬프트입니다.
   *
   * 프로퍼티로 뺀 이유는 둘입니다. 나중에 이 저장소의 다이얼로그로 바꾸기
   * 쉽고, 테스트가 사람 없이 이름을 넣을 수 있습니다.
   *
   * @returns 이름, 또는 취소했으면 `null`
   */
  requestName?: (current: string) => string | null
}

const defaultRequestName = (current: string): string | null =>
  window.prompt('Document name', current)

export function DocumentBar({
  requestName = defaultRequestName,
}: DocumentBarProps = {}): ComponentChildren {
  const { name, untitled, dirty, available, create, save, saveAs, readNow } =
    useDocument()

  /** 이름이 없으면 물어보고 저장합니다 — 레거시 에디터의 ⌘S 그대로입니다 */
  const saveOrAsk = useCallback(async (): Promise<void> => {
    if (!untitled) {
      await save()
      return
    }
    const next = requestName('Untitled.html')
    if (!next) return
    await saveAs(next)
  }, [untitled, save, saveAs, requestName])

  const askAndSaveAs = useCallback(async (): Promise<void> => {
    const next = requestName(name)
    if (!next) return
    await saveAs(next)
  }, [name, saveAs, requestName])

  /**
   * 진짜 파일로 꺼냅니다.
   *
   * 대화상자를 먼저 띄우고 그 뒤에 내용을 읽습니다 — 순서가 바뀌면 사용자
   * 제스처를 잃어 대화상자가 안 뜹니다 (`document-bar.utils`).
   */
  const exportToComputer = useCallback((): void => {
    void saveToComputer(untitled ? 'Untitled.html' : name, readNow)
  }, [untitled, name, readNow])

  /*
   * ⌘S 는 **문서** 동작이라 편집 커맨드용 단축키 플러그인과 층이 다릅니다.
   * 그쪽은 편집 영역 안에서만 듣지만, 저장은 어디에 포커스가 있든 되어야
   * 합니다.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 's' || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      void saveOrAsk()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [saveOrAsk])

  /*
   * 자동 저장이 없으므로 이 경고가 **마지막 방어선**입니다. 저장 안 한 채로
   * 닫으면 글이 사라집니다.
   */
  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  if (!available) return null

  return (
    <div data-scope="document-bar" data-part="root" style={rowStyle}>
      <span data-part="title" style={titleStyle}>
        <span data-part="dot" style={dotStyle} aria-hidden="true">
          {dirty ? '●' : ''}
        </span>
        <span data-part="name" style={nameStyle}>
          {name}
        </span>
      </span>

      <Menubar data-part="actions" aria-label="Document">
        <MenubarItem
          type="button"
          data-part="new"
          onClick={() => void create()}
        >
          New
        </MenubarItem>

        <DocumentDialog requestName={requestName} />

        <MenubarItem
          type="button"
          data-part="save"
          onClick={() => void saveOrAsk()}
        >
          Save
        </MenubarItem>

        <MenubarItem
          type="button"
          data-part="save-as"
          onClick={() => void askAndSaveAs()}
        >
          Save As…
        </MenubarItem>

        {/*
          진짜 파일은 Chromium 계열에만 있습니다. 없는 브라우저에서는 아예
          안 내놓습니다 — `docs/toolbar-options.md` 의 규칙과 같습니다.
        */}
        {canSaveToComputer() && (
          <MenubarItem
            type="button"
            data-part="save-to-computer"
            onClick={exportToComputer}
            title="Save a copy to your computer"
          >
            Save to Computer…
          </MenubarItem>
        )}
      </Menubar>
    </div>
  )
}
