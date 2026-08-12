/**
 * 폰트 이름을 비교하려면 **양쪽을 같은 꼴로 만들어야** 합니다.
 *
 * 넣은 값과 읽히는 값이 글자 그대로 같지 않습니다. 브라우저가 CSS 값을 다시
 * 직렬화하면서 **따옴표가 필요 없는 이름의 따옴표를 떼기** 때문입니다.
 *
 * | 넣은 값 | 읽힌 값 |
 * | --- | --- |
 * | `"AppleMyungjo", "Batang", "Noto Serif KR", …` | `AppleMyungjo, Batang, "Noto Serif KR", …` |
 * | `"D2Coding", "Nanum Gothic Coding", …` | `D2Coding, "Nanum Gothic Coding", …` |
 * | `Apple SD Gothic Neo` | `"Apple SD Gothic Neo"` (공백이 있어 **붙습니다**) |
 *
 * 규칙이 한 방향이 아닙니다 — 떼기도 하고 붙이기도 합니다. 그래서 값을 "따옴표
 * 없이 잘 적어 두는" 식으로는 못 맞춥니다. 실제로 폴백 스택 셋 중 하나만
 * 우연히 맞아떨어졌고, 나머지 둘은 메뉴가 엉뚱한 항목을 가리켰습니다.
 *
 * 비교할 때 양쪽을 정규화하는 것이 유일하게 버티는 방법입니다.
 */

/**
 * 비교용 표준형으로 바꿉니다 — 따옴표를 없애고, 쉼표 구분을 정리하고,
 * 대소문자를 무시합니다 (CSS 의 family 이름은 대소문자를 구분하지 않습니다).
 */
export function canonicalFontFamily(value: string): string {
  return value
    .split(',')
    .map((part) => part.replace(/["']/g, '').trim().toLowerCase())
    .filter((part) => part.length > 0)
    .join(',')
}

/** 두 폰트 지정이 같은 것을 가리키는지 */
export function sameFontFamily(a: string, b: string): boolean {
  return canonicalFontFamily(a) === canonicalFontFamily(b)
}
