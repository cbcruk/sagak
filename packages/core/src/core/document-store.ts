/**
 * 문서 저장소 — 브라우저 안의 파일 시스템(OPFS) 위에 놓입니다.
 *
 * 레거시 텍스트 에디터의 뼈대입니다: 목록 · 읽기 · 쓰기 · 이름 바꾸기 · 삭제.
 * 자동 저장은 여기 없습니다 — 언제 쓸지는 위층이 정합니다
 * (`docs/document-model.md`).
 *
 * ## 왜 OPFS 인가
 *
 * 웹에는 파일 시스템이 둘 있고 사는 곳이 다릅니다.
 *
 * | | OPFS | File System Access |
 * | --- | --- | --- |
 * | 진입점 | `navigator.storage.getDirectory()` | `showSaveFilePicker()` |
 * | 무엇 | 오리진 전용 **가상 FS** | 사용자의 **진짜 파일** |
 * | Chrome · Edge | O | O |
 * | Safari · Firefox | **O** | **X** |
 * | 권한 대화상자 | 없음 | 매번 |
 *
 * 진짜 파일 쪽을 기본으로 삼으면 Safari·Firefox 에서 저장 자체가 안 됩니다.
 * 그쪽은 "내 컴퓨터에 저장" 이라는 **덤**으로만 답니다.
 *
 * ## 얼마나 버티는가 (재 봤습니다)
 *
 * | 상황 | `persist()` | 할당량 |
 * | --- | --- | --- |
 * | 깨끗한 프로필 | `false` | 0.92GB |
 * | 알림 권한 부여 | `false` | 1.02GB |
 * | 실제 디스크 프로필 | `false` | **276GB** |
 *
 * `persist()` 는 거절당했지만 **브라우저를 껐다 켜도 문서는 그대로였습니다.**
 * `persisted: false` 는 "지워진다" 가 아니라 "저장 공간이 심각하게 모자라면
 * 지울 수도 있다" 는 뜻입니다.
 *
 * 그래도 **약속하지는 않습니다.** 저장이 사용자의 글을 다루는 일이므로,
 * 위층은 내보내기 같은 밖으로 꺼내는 길을 함께 줘야 합니다.
 *
 * ## 성능
 *
 * 488KB 문서 왕복이 **쓰기 6.3ms · 읽기 3.4ms** 였습니다. 원고지 수천 장이
 * 10ms 안에 오갑니다.
 */

/** 목록에 필요한 것만 — 내용은 담지 않습니다 */
export interface DocumentMeta {
  name: string
  /** 바이트 */
  size: number
  /** `File.lastModified` — 최근 수정 순 정렬에 씁니다 */
  modifiedAt: number
}

export interface DocumentStore {
  /** 최근에 고친 것이 앞입니다 */
  list(): Promise<DocumentMeta[]>
  has(name: string): Promise<boolean>
  read(name: string): Promise<string>
  write(name: string, content: string): Promise<void>
  /**
   * 이름을 바꿉니다.
   *
   * @throws 대상 이름이 이미 있으면 — 덮어쓰면 남의 글이 사라집니다
   */
  rename(from: string, to: string): Promise<void>
  remove(name: string): Promise<void>
}

/**
 * 이 브라우저가 문서를 보관할 수 있는가.
 *
 * 보안 컨텍스트가 아니거나(`http://` 원격) 아주 오래된 브라우저면 없습니다.
 */
export function isDocumentStorageAvailable(): boolean {
  return typeof navigator?.storage?.getDirectory === 'function'
}

/** `move()` 가 있는 핸들 — 없는 브라우저가 있어 선택적입니다 */
type MovableHandle = FileSystemFileHandle & {
  move?: (name: string) => Promise<void>
}

interface DirectoryWithEntries extends FileSystemDirectoryHandle {
  entries(): AsyncIterable<[string, FileSystemHandle]>
}

/**
 * 실제 파일 시스템이 못 받는 글자들입니다.
 *
 * **공백은 없습니다.** `회의 메모.html` 은 텍스트 에디터에서 자연스러운
 * 이름이고, OPFS 도 받습니다.
 */
const FORBIDDEN = /[:*?"<>|]/

/**
 * 이름을 검사합니다.
 *
 * ## 무엇을 OPFS 가 이미 막는가 (재 봤습니다)
 *
 * | 이름 | OPFS |
 * | --- | --- |
 * | `폴더/문서.html` · `역슬래시` | **거절** (`TypeError`) |
 * | 빈 이름 · `.` · `..` | **거절** |
 * | `별표*.html` · `물음표?.html` | **받아들임** |
 * | `공백 있음.html` | **받아들임** |
 *
 * 경로 구분자는 OPFS 가 알아서 막습니다. 처음엔 이걸 우리가 막는 줄 알고
 * "OPFS 는 이름의 일부로 받아들인다" 고 적었는데 사실이 아니었습니다.
 *
 * 그래서 여기서 하는 일은 둘입니다.
 *
 * 1. OPFS 가 던지는 날것의 `TypeError` 대신 **무엇이 잘못됐는지 말해주는** 오류
 * 2. OPFS 는 받지만 **진짜 파일 시스템이 못 받는 글자**를 미리 막기 —
 *    나중에 "내 컴퓨터에 저장" 을 붙일 때 여기서 걸러 두지 않으면 그때
 *    실패합니다
 */
function assertName(name: string): void {
  if (!name || name === '.' || name === '..') {
    throw new Error(`Invalid document name: ${JSON.stringify(name)}`)
  }

  if (name.includes('/') || name.includes(String.fromCharCode(92))) {
    throw new Error(
      `Document name cannot contain a path: ${JSON.stringify(name)}`
    )
  }

  if (FORBIDDEN.test(name)) {
    throw new Error(
      `Document name cannot contain :*?"<>| — got ${JSON.stringify(name)}`
    )
  }
}

async function root(): Promise<DirectoryWithEntries> {
  if (!isDocumentStorageAvailable()) {
    throw new Error('This browser cannot store documents (no OPFS)')
  }
  return (await navigator.storage.getDirectory()) as DirectoryWithEntries
}

/**
 * OPFS 위의 문서 저장소를 만듭니다.
 *
 * 상태를 안 들고 있으므로 여러 번 만들어도 같은 곳을 봅니다.
 */
export function createDocumentStore(): DocumentStore {
  const store: DocumentStore = {
    async list() {
      const dir = await root()
      const items: DocumentMeta[] = []

      for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file') continue
        const file = await (handle as FileSystemFileHandle).getFile()
        items.push({ name, size: file.size, modifiedAt: file.lastModified })
      }

      /*
       * 수정시각이 같으면 이름으로 갈라 순서를 고정합니다. 안 그러면 같은 초에
       * 만든 문서들의 차례가 실행할 때마다 달라집니다.
       */
      return items.sort(
        (a, b) => b.modifiedAt - a.modifiedAt || a.name.localeCompare(b.name)
      )
    },

    async has(name) {
      assertName(name)
      const dir = await root()
      try {
        await dir.getFileHandle(name)
        return true
      } catch {
        return false
      }
    },

    async read(name) {
      assertName(name)
      const dir = await root()
      const handle = await dir.getFileHandle(name)
      return (await handle.getFile()).text()
    },

    async write(name, content) {
      assertName(name)
      const dir = await root()
      const handle = await dir.getFileHandle(name, { create: true })
      /*
       * 기본값이 **빈 파일로 시작**입니다. 재 봤습니다 — 20자를 쓴 뒤 2자를
       * 덮으면 `"BB"` 가 남습니다. 예전 꼬리를 남기려면 오히려
       * `{ keepExistingData: true }` 를 줘야 합니다.
       *
       * 처음엔 `truncate(0)` 을 넣고 "안 그러면 꼬리가 남는다" 고 적었는데,
       * 대조군에서 그 줄을 지워도 테스트가 하나도 안 깨져서 드러났습니다.
       */
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
    },

    async rename(from, to) {
      assertName(from)
      assertName(to)
      if (from === to) return

      if (await store.has(to)) {
        throw new Error(`Document already exists: ${to}`)
      }

      const dir = await root()
      const handle = (await dir.getFileHandle(from)) as MovableHandle

      /*
       * `move()` 는 한 번에 끝나지만 **모든 브라우저에 있지는 않습니다.**
       * 없으면 읽어서 새 이름으로 쓰고 지웁니다 — 결과는 같고 큰 문서에서
       * 두 배 비용입니다.
       */
      if (typeof handle.move === 'function') {
        await handle.move(to)
        return
      }

      const content = await (await handle.getFile()).text()
      await store.write(to, content)
      await dir.removeEntry(from)
    },

    async remove(name) {
      assertName(name)
      const dir = await root()
      await dir.removeEntry(name)
    },
  }

  return store
}
