import type { ComponentChildren, JSX } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from 'lucide-preact'
import type { AutoSaveStatus } from 'sagak-core'
import { useAutoSave } from '../../hooks'
import {
  DELETED_MS,
  DELETED_TEXT,
  WIDEST_LABELS,
  formatTime,
} from './auto-save-indicator.shared'

const ICON_SIZE = 14

/**
 * 자동 저장 상태 표시.
 *
 * ## 레이아웃을 밀지 않는 것이 설계 조건입니다
 *
 * 이 자리는 툴바와 편집 영역 **사이**입니다. 여기서 크기가 변하면 글을
 * 쓰는 도중에 본문이 통째로 움직입니다.
 *
 * 예전 판은 두 군데서 밀었습니다 (`test/auto-save-layout.browser.test.tsx`
 * 에 수치가 있습니다).
 *
 * | | 예전 | 원인 |
 * | --- | --- | --- |
 * | 세로 | 편집 영역이 **23px** 내려감 | idle 일 때 `null` 을 돌려주다 갑자기 나타남 |
 * | 가로 | Discard 버튼이 **최대 50.7px** 튐 | 상태 문구 길이가 42.3~93.0px 로 제각각 |
 *
 * 그래서 —
 *
 * 1. **항상 렌더합니다.** 보일 것이 없으면 내용만 감추고 자리는 지킵니다
 * 2. **문구 자리를 가장 긴 문구에 맞춰 잡습니다.** 픽셀을 손으로 적지 않고
 *    모든 문구를 같은 칸에 겹쳐 놓아 브라우저가 재게 합니다 — 글꼴이
 *    바뀌거나 번역돼도 따라갑니다
 */

interface StatusView {
  icon: ComponentChildren
  text: string
  color: string
}

/**
 * 시각 표시가 없는 상태에도 **자리는 있어야 합니다.**
 *
 * `idle` 은 아직 아무 일도 없었다는 뜻이라 보여 줄 것이 없지만, 여기서
 * 안 그리면 다음 상태에서 아래가 밀립니다.
 */
const INVISIBLE: AutoSaveStatus[] = ['idle']

/** 확인 문구가 머무는 시간 */

function viewFor(
  status: AutoSaveStatus,
  lastSaved: Date | null,
  showTime: boolean
): StatusView {
  switch (status) {
    case 'pending':
      return {
        icon: <Cloud size={ICON_SIZE} />,
        text: 'Unsaved changes',
        color: 'var(--sagak-chrome-muted-fg)',
      }
    case 'saving':
      return {
        icon: <Loader2 size={ICON_SIZE} className="animate-spin" />,
        text: 'Saving...',
        color: '#3b82f6',
      }
    case 'saved':
      return {
        icon: <Check size={ICON_SIZE} />,
        text:
          showTime && lastSaved ? `Saved at ${formatTime(lastSaved)}` : 'Saved',
        color: '#22c55e',
      }
    case 'error':
      return {
        icon: <AlertCircle size={ICON_SIZE} />,
        text: 'Save failed',
        color: '#ef4444',
      }
    case 'idle':
    default:
      return {
        icon: <CloudOff size={ICON_SIZE} />,
        text: '',
        color: 'var(--sagak-chrome-muted-fg)',
      }
  }
}


/**
 * 시간 문구의 폭을 재기 위한 표본 시각들.
 *
 * ## 손으로 적으면 틀립니다
 *
 * 처음엔 `'Saved at 00:00'` 이라고 **문자열로 적었다가 틀렸습니다.** 이
 * 환경은 12시간제라 실제로는 `Saved at 05:49 AM` 이 뜹니다. 자리표시가
 * 71.33px, 실제가 93.00px 이라 버튼이 그대로 튀었습니다.
 *
 * 그래서 **같은 포매터로 만듭니다.** 이것이 실제로 값을 한 변경입니다 —
 * 표본이 하나여도 `formatTime` 을 거치면 `12:00 AM` 이 되어 폭이 맞습니다.
 *
 * ## 표본이 여럿인 이유 (재 봤습니다)
 *
 * 한 로케일 안에서도 시각에 따라 폭이 조금씩 다릅니다.
 *
 * | 로케일 | 편차 | 예 |
 * | --- | --- | --- |
 * | en-US | **1.8px** | `12:00 AM` 93.0 · `11:59 PM` 91.2 |
 * | ko-KR | 0.5px | `오전 12:00` 98.3 · `오후 11:59` 97.9 |
 * | de-DE · ja-JP · fr-FR | 0.0px | 24시간제라 항상 같음 |
 *
 * 표본을 하나만 두고 **가장 넓지 않은 시각을 고르면** 그만큼 버튼이 튑니다.
 * 오전·오후와 자릿수가 다른 것을 몇 개 두면 가장 넓은 것이 폭을 잡습니다.
 */

/**
 * 문구 자리의 폭을 정하는 후보들 — 실제로 뜨는 문구가 아니라 **자리를 재기
 * 위한** 것입니다.
 */


const rowStyle: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
}

/**
 * 문구 칸 — 후보를 전부 같은 칸에 겹쳐 두고 하나만 보입니다.
 *
 * 폭이 **언제나 가장 긴 후보**가 되므로 상태가 바뀌어도 옆의 버튼이
 * 움직이지 않습니다. `visibility` 라서 감춰진 것들도 자리는 차지합니다.
 */
const slotStyle: JSX.CSSProperties = {
  display: 'grid',
  justifyItems: 'start',
}

const layerStyle: JSX.CSSProperties = {
  gridArea: '1 / 1',
  whiteSpace: 'nowrap',
}

const discardStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0 2px',
  font: 'inherit',
  fontSize: 12,
  color: 'var(--sagak-chrome-muted-fg)',
  cursor: 'pointer',
  textDecoration: 'underline',
}

export interface AutoSaveIndicatorProps {
  showTime?: boolean
}

/**
 * 저장된 초안을 지우는 버튼은 초안이 있을 때만 **눌립니다.**
 *
 * ## 왜 "Discard draft" 가 아닌가
 *
 * 저장소만 비웁니다 — 편집 중인 글은 그대로 남고, 다음 입력에서 자동 저장이
 * 다시 씁니다. 그래서 "글을 되돌린다" 가 아니라 "저장된 초안을 지운다" 이고,
 * 쓸모가 있는 순간은 *다음에 열었을 때 이 초안이 되살아나지 않게 하고 싶을
 * 때* 입니다.
 *
 * 그 동작은 맞는데 **문구가 다른 모델에서 온 말**이었습니다.
 *
 * | 초안의 정체 | 버리기 UI | 예 |
 * | --- | --- | --- |
 * | 초안이 **문서 자체** | 있음 — 진짜로 지웁니다 | Gmail |
 * | 초안은 문서의 **백업** | **없음** — 복원 쪽만 둡니다 | TinyMCE · WordPress · CKEditor 5 |
 *
 * sagak 은 아래쪽(백업)인데 위쪽(Gmail)의 말인 "Discard draft" 를 쓰고
 * 있었습니다. 그래서 눌러도 글이 안 사라지니 **아무 일도 안 일어난 것처럼**
 * 보였습니다. 실제로 그 오해가 "discard 가 동작하지 않는다" 는 보고로
 * 돌아왔습니다.
 *
 * 고친 것은 동작이 아니라 말입니다.
 *
 * - `Discard draft` → **`Delete saved draft`** — 지우는 대상이 *저장된 초안*
 *   이라는 것이 문구 안에 들어옵니다
 * - 누른 뒤 표시가 **빈 칸이 되던 것**을 잠깐 `Draft deleted` 로 바꿉니다.
 *   예전에는 버튼만 사라져서 무엇이 일어났는지 알 길이 없었습니다
 */
export function AutoSaveIndicator({
  showTime = true,
}: AutoSaveIndicatorProps): ComponentChildren {
  const { status, lastSaved, clear } = useAutoSave()

  /** 지운 직후 잠깐만 뜨는 확인 문구 */
  const [justDeleted, setJustDeleted] = useState(false)

  useEffect(() => {
    if (!justDeleted) return
    const timer = setTimeout(() => setJustDeleted(false), DELETED_MS)
    return () => clearTimeout(timer)
  }, [justDeleted])

  /*
   * 다시 저장되기 시작하면 확인 문구는 자리를 비켜야 합니다 — 이어서 쓰면
   * 곧바로 새 초안이 생기고, 그때까지 "지웠음" 이 남아 있으면 거짓말입니다.
   *
   * 이것을 `useEffect` 로 맞추려다 한 번 틀렸습니다. 클릭 시점에는 아직
   * `status` 가 `saved` 라, **직전 렌더의 효과가 클릭 뒤에 흘러나와** 방금 켠
   * 플래그를 도로 껐습니다. 상태를 맞추는 대신 **끌어내면** 그 경합이 없습니다.
   */
  const showDeleted = justDeleted && status === 'idle'

  const base = viewFor(status, lastSaved, showTime)
  const { icon, text, color } = showDeleted
    ? {
        icon: base.icon,
        text: DELETED_TEXT,
        color: 'var(--sagak-chrome-muted-fg)',
      }
    : base
  const hidden = INVISIBLE.includes(status) && !lastSaved && !showDeleted

  return (
    <div
      data-scope="auto-save"
      data-part="indicator"
      data-status={status}
      style={{
        ...rowStyle,
        color,
        visibility: hidden ? 'hidden' : 'visible',
      }}
    >
      {icon}

      <span style={slotStyle}>
        {/*
          자리를 재기 위한 겹침 층. 화면 낭독기에는 실제 문구만 들려야
          하므로 나머지는 aria-hidden 입니다.
        */}
        {WIDEST_LABELS.map((label) => (
          <span
            key={label}
            aria-hidden="true"
            style={{ ...layerStyle, visibility: 'hidden' }}
          >
            {label}
          </span>
        ))}
        <span style={layerStyle}>{text}</span>
      </span>

      {/*
        버튼은 행의 **마지막**이라 나타나고 사라져도 아무것도 안 밀립니다.
        대조군으로 확인했습니다 — 조건부로 되돌려도 레이아웃 테스트 4개가
        전부 통과합니다. 그래서 예전 그대로 둡니다.
      */}
      {lastSaved && (
        <button
          type="button"
          onClick={() => {
            clear()
            setJustDeleted(true)
          }}
          style={discardStyle}
          title="Deletes the saved draft so it won't be restored next time. Your current text stays as it is, and editing saves again."
        >
          Delete saved draft
        </button>
      )}
    </div>
  )
}
