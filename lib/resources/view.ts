/**
 * 목록 화면이 쓰는 순수 변환들 - 자원 선언 + JSON:API 응답 → 화면이 그대로
 * 그릴 수 있는 값.
 *
 * ## 왜 화면이 아니라 여기 있는가
 *
 * `app/(app)/examples/page.tsx` 는 RSC 라 `headers()` 를 부르고, 이 저장소는
 * 요청 스코프를 스텁하지 않는 관례를 갖는다(루트 `AGENTS.md`). 즉 **판단이
 * `page.tsx` 에 남으면 그만큼이 관측 불가다.** D2 의 `lib/auth/flow.ts` ↔
 * `app/(auth)/actions.ts` 와 같은 분리다 - 저쪽도 "어디로 보낼지" 라는 판단을
 * Server Action 밖으로 꺼내서 단위 테스트가 닿게 했다.
 *
 * `page.tsx` 에 남는 것은 fetch 와 JSX 뿐이다.
 *
 * ## 이 디렉터리의 규칙을 어기지 않는다
 *
 * `lib/resources/AGENTS.md`: **JSX 도 fetch 도 없다.** 여기 있는 것은 문자열과
 * 평범한 객체를 만드는 순수 함수뿐이고, 그리는 것은
 * `components/resource/resource-table.tsx`, 부르는 것은 `page.tsx` 다.
 * 화면 경로(`/examples`)도 여기 없다 - 라우팅은 `app/` 의 것이다.
 *
 * 이 파일이 `lib/jsonapi/` 를 읽는 것은 계층 위반이 아니다. 스펙 4장의 표에서
 * 이 디렉터리가 소유하는 것에 "표시 라벨" 이 있고, 그 라벨을 실제 응답 값에
 * 붙이려면 응답을 읽는 쪽(`normalize` · `errors`)이 필요하다. 반대 방향은
 * 여전히 금지다 - `lib/jsonapi/` 는 자원을 모른다.
 *
 * (template-typescript-expo) 요청 옵션에 `Accept-Language` 를 싣지 않는다 - 그 헤더를 싣는
 * 자리는 앱의 API 클라이언트 한 곳이다(`platform/api.ts`, 스펙 9.4). 목록은 커서로 끝까지
 * 따라가고(스펙 8.3, `listQuery`·`nextPageQuery`), 백엔드가 응답조차 주지 못하면 던지지 않고
 * `unreachable` 을 돌려준다 - 화면이 앱 문구와 "다시 시도" 를 그린다(스펙 9.3, `ListFailure`).
 * 필터 시트의 값은 `FormData` 가 아니라 폼 상태 객체다(스펙 6.2, `FilterFormValues`).
 */

import type { JsonApiResult, RequestOptions } from '@/lib/jsonapi/client'
import {
  isCollectionDocument,
  type CollectionDocument,
  type ErrorObject,
  type RelationshipObject,
  type ResourceIdentifier,
  type ResourceObject,
  type SingleDocument,
} from '@/lib/jsonapi/document'
import { actionForErrors, groupErrors } from '@/lib/jsonapi/errors'
import {
  indexResources,
  isResourceObject,
  resolveToMany,
  resolveToOne,
  type ResourceIndex,
} from '@/lib/jsonapi/normalize'
import {
  buildQuery,
  canonicalFilterParameter,
  filterParameter,
  formatSortToken,
  hasFilterParams,
  INCLUDE_PARAMETER,
  isFilterParameter,
  isPagePositionParameter,
  linkQuery,
  pageParameter,
  parseSortToken,
  SORT_PARAMETER,
  toBackendQuery,
  type FilterInput,
  type FilterOperator,
} from '@/lib/jsonapi/query'
import {
  resourcePath,
  type AttributeDefinition,
  type AttributeKind,
  type EnumValue,
  type RelationshipDefinition,
  type ResourceDefinition,
} from './define'
import { resourceByType } from './index'

/** Next 의 `searchParams` 모양. 값이 없는 키가 실제로 온다. */
type SearchParams = Readonly<Record<string, string | string[] | undefined>>

/** 표의 열 하나. `key` 는 속성 또는 관계의 이름이다. */
export interface ListColumn {
  key: string
  label: string
}

/**
 * 표의 칸 하나.
 *
 * `values` 가 배열인 것은 to-many 관계 때문이다. 속성 칸은 0개(빈 값) 또는
 * 1개이고, 관계 칸은 0개 이상이다. **비어 있음을 `''` 가 아니라 빈 배열로
 * 표현한다** - 그래야 "값이 없다" 하나로 두 경우(속성이 null · 관계가 빔)를
 * 같은 모양으로 그릴 수 있다.
 *
 * `kind` 는 그리는 쪽이 배지로 그릴지 글자로 그릴지 정하는 데 쓴다. **자원
 * 이름이 아니라 구조**라, 이것으로 분기하는 것은 스펙 4장 위반이 아니다.
 */
export interface ListCell {
  key: string
  kind: 'attribute' | 'relationship'
  values: readonly string[]
}

/**
 * 표의 행 하나. `id` 는 JSON:API 자원 id 다 - **행의 첫 칸을 상세로 보내는
 * 링크가 이걸 쓴다**(`components/resource/resource-table.tsx` 의 `rowHref`).
 * 주소를 만드는 규칙은 `app/` 의 것이라 여기 담지 않는다.
 */
export interface ListRow {
  id: string
  cells: readonly ListCell[]
}

/**
 * 화면이 그릴 것. 브리핑 Step 4 의 세 상태 중 둘이 `'list'` 안에 있다.
 *
 * "목록" 과 "빈 목록" 을 한 갈래로 묶은 이유: 둘의 차이는 `rows.length` 하나
 * 뿐이고, 빈 상태에서도 **열 머리는 그대로 그리는 편이 낫다**(무엇을 담는
 * 표인지 사라지지 않는다). 빈 상태를 어떻게 그릴지는
 * `components/resource/resource-table.tsx` 가 갖는다 - 거기 두면 그 갈래가
 * `renderToStaticMarkup` 으로 실제로 관측된다. 여기서 `{kind:'empty'}` 로
 * 갈라 두면 그 분기가 `page.tsx` 의 JSX 로 올라가 관측 불가가 된다.
 *
 * `filtered` 가 그 빈 상태를 다시 둘로 나눈다 - `hasFilterParams` 주석 참고.
 */
export type ListView =
  | {
      kind: 'list'
      columns: readonly ListColumn[]
      rows: readonly ListRow[]
      filtered: boolean
      /**
       * (template-typescript-expo) 뒤따르는 쪽을 읽다 실패했으면 그 실패, 아니면 `null`. 이미
       * 읽은 행은 그대로 둔다 - 화면은 목록 끝에 실패와 "다시 시도" 를 그린다.
       */
      failure: ListFailure | null
    }
  | ListFailure

/**
 * (template-typescript-expo) 목록·상세 대신 그리는 실패 둘. `banner` 는 백엔드가 협상한
 * 문구이고(스펙 9.2), `unreachable` 은 백엔드가 응답조차 주지 못한 것(네트워크 실패·타임아웃)이라
 * 문구를 앱이 갖고 "다시 시도" 를 함께 그린다(스펙 9.3). 원본은 뒤엣것을 던져 `app/error.tsx`
 * 로 보냈다 - 이 앱에서 렌더 중 예외는 Expo Router 의 ErrorBoundary 가 받는데, 그 화면은 요청을
 * 다시 보내지 않는다.
 */
export type ListFailure = { kind: 'banner'; messages: readonly string[] } | { kind: 'unreachable' }

/** 목록에 그리는 속성만, 선언 순서 그대로. */
function listedAttributes(
  resource: ResourceDefinition,
): readonly (readonly [string, AttributeDefinition])[] {
  return Object.entries(resource.attributes).filter(([, attribute]) => attribute.listed)
}

/**
 * 이 자원을 한 줄로 대표하는 속성 - **`listed` 인 첫 속성**이다.
 *
 * 관계 칸이 대상 자원을 이름으로 그릴 때(`relatedText`) 어느 속성을 읽을지
 * 정하는 것이 이 함수다. 목록의 첫 열이 그 자원을 대표한다는 뜻이므로, 다른
 * 자원의 관계 칸에서도 같은 값을 쓰는 것이 일관된다.
 *
 * `'name'` 처럼 이름을 박지 않는다 - 그 규약을 지키지 않는 자원(첫 속성이
 * `name` 이 아닌 자원)에서 조용히 빈 칸이 된다.
 *
 * **`listed` 를 거르는 것이 `[0]` 과 다른 이유:** 첫 속성이 목록에서 빠진
 * 자원이면 둘은 갈린다. 지금 등록된 셋에는 그런 자원이 없어서 이 저장소의
 * 선언만으로는 두 구현이 같은 답을 낸다 - 그래서 이 함수를 따로 내보내
 * `probe*` 선언으로 직접 잰다(test/unit/resources/view.test.ts).
 */
export function displayAttribute(
  resource: ResourceDefinition,
): readonly [name: string, attribute: AttributeDefinition] | undefined {
  return listedAttributes(resource)[0]
}

/**
 * 열 = 목록에 그리는 속성 + **관계 전부**.
 *
 * 관계에는 `listed` 같은 표시를 두지 않았다(YAGNI, 스펙 1.1). 속성과 달리
 * 관계는 값이 짧고(이름 하나 또는 배지 몇 개) 자원마다 두어 개뿐이라, 지금
 * 선언 셋 중 어디에도 "빼고 싶은 관계" 가 없다. 값이 하나도 `false` 가 아닌
 * 표시는 아무 결정도 기록하지 않는다. 많은 관계를 가진 자원이 생기는 날
 * `AttributeBase.listed` 와 같은 모양으로 더해라.
 */
export function listColumns(resource: ResourceDefinition): readonly ListColumn[] {
  return [
    ...listedAttributes(resource).map(([name, attribute]) => ({
      key: name,
      label: attribute.label,
    })),
    ...Object.entries(resource.relationships).map(([name, relationship]) => ({
      key: name,
      label: relationship.label,
    })),
  ]
}

/**
 * 표시용 날짜 형식 - **문자열을 자르지 않고 `Date` 를 거친다**(R-10③).
 *
 * 세 백엔드의 `createdAt` 표현이 전부 다르다(마이크로초 UTC · 밀리초 `Z` ·
 * `+09:00` 로컬). 셋 다 올바른 ISO 8601 이라 `new Date(...)` 는 전부 같은
 * 순간을 만들지만, **입력 문자열을 `slice(0, 10)` 하면 `+09:00` 인 Rails 에서
 * 하루가 어긋난다.**
 *
 * 아래에서 `slice` 를 쓰는 대상은 입력이 아니라 `toISOString()` 의 출력이다 -
 * 그쪽은 언제나 UTC 이고 형식이 스펙으로 고정돼 있어 자르는 것이 안전하다.
 *
 * **표시 타임존은 UTC 로 고정한다.** 서버 렌더링이라 보는 사람의 타임존을 알
 * 수 없고(브라우저만 안다), 컨테이너의 `TZ` 를 따르면 같은 화면이 배포
 * 환경마다 다른 시각을 보여준다. `Intl` 을 쓰지 않는 이유도 같은 종류다 -
 * 출력이 Node 의 ICU 버전에 따라 달라져 테스트가 환경에 묶인다. 사용자
 * 타임존으로 그리는 것은 클라이언트 경계를 하나 여는 일이라, 필요해지면 그때
 * 판단할 자리다.
 */
function formatDateTime(value: unknown): string {
  const raw = toText(value)
  const date = new Date(raw)
  // 파싱할 수 없는 값은 지어내지 않고 원문 그대로 보여준다 - 거울이 어긋난
  // 것을 화면에서 볼 수 있어야 한다.
  if (Number.isNaN(date.getTime())) return raw
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * 속성 값 하나를 표시 문자열로. 없는 값(`null`·키 없음)은 빈 문자열이다.
 *
 * `enum` 은 선언의 라벨로 바꾼다(`EnumValue`, D4 Task 1) - 목록·상세·폼의
 * `<select>` 가 같은 라벨을 쓰게 하는 것이 이 변경의 목적이다.
 */
export function formatAttributeValue(attribute: AttributeDefinition, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (attribute.kind === 'datetime') return formatDateTime(value)
  if (attribute.kind === 'enum') return enumLabel(attribute.values, value)
  return toText(value)
}

/**
 * enum 값 하나를 라벨로. 선언에 없는 값(백엔드와 거울이 어긋난 경우)은 원문
 * 그대로 돌려준다 - `formatDateTime` 이 파싱 못 한 값을 원문 그대로 두는 것과
 * 같은 판단이다. 라벨을 못 찾았다고 감추면 어긋난 사실이 화면에서 사라진다.
 */
function enumLabel(values: readonly EnumValue[], value: unknown): string {
  const text = toText(value)
  return values.find((candidate) => candidate.value === text)?.label ?? text
}

/**
 * 응답 값 하나를 문자열로. 값의 **타입**은 선언의 거울일 뿐 보장이 아니다 -
 * `JSON.parse` 가 만든 것이면 무엇이든 올 수 있다.
 *
 * 원시값이 아닌 것(객체·배열)은 `String()` 이 `'[object Object]'` 로
 * 뭉개는데, 그러면 거울이 어긋난 사실이 화면에서 사라진다. 실제로 온 모양을
 * 보여준다 - `formatDateTime` 이 파싱 못 한 값을 원문 그대로 두는 것과 같은
 * 판단이다.
 */
function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return JSON.stringify(value) ?? ''
}

/**
 * 관계 대상 하나를 표시 문자열로.
 *
 * ## `resourceByType` 이 `undefined` 를 돌려주는 자리다
 *
 * 인자의 `type` 은 우리 코드가 아니라 **백엔드 응답에서 온다.** 등록되지 않은
 * type 이면 그 자원의 선언이 없으므로 **어느 속성이 이름인지 알 수 없다** -
 * 그때는 id 로 물러선다. `resourceByType(t)!` 로 지우면 백엔드가 관계 하나를
 * 새 type 으로 늘리는 순간 목록 전체가 죽는다(`lib/resources/AGENTS.md`).
 *
 * **Task 6 은 여기에 링크를 붙이지 않았다.** 이 앱에는 분류·라벨의 상세
 * 화면이 없고(라우트가 `/examples` 와 `/examples/[id]` 뿐이다), 선언의 `path`
 * 는 **백엔드 경로**라 화면 주소가 아니다 - 그것을 링크로 걸면 사용자를
 * JSON 응답으로 보낸다. 근거 전체는 `detailFields` 주석이 갖는다.
 *
 * 그 결정의 부수 효과 하나: 네 갈래가 **전부 같은 모양**(글자 하나)으로
 * 남으므로 `isResourceObject` 의 거짓 음성이 여전히 관측 불가다 - 그 술어의
 * "남는 거짓 음성이 왜 안전한가" 절이 기대는 전제가 그대로다.
 *
 * 무엇을 이름으로 쓰는지는 `displayAttribute` 가 정한다.
 */
export function relatedText(related: ResourceObject | ResourceIdentifier): string {
  // 자원 객체가 아니면 애초에 attributes 자체가 없다(include 를 걸지 않았거나
  // 백엔드가 담지 않은 대상).
  if (!isResourceObject(related)) return related.id

  const definition = resourceByType(related.type)
  if (definition === undefined) return related.id

  return displayText(definition, related)
}

/**
 * 자원 하나를 **한 줄로 대표하는 문자열**. 선언을 이미 아는 쪽이 부른다.
 *
 * `relatedText` 와 갈라 둔 이유: 저쪽은 대상의 선언을 **응답의 type 으로 찾아야
 * 하지만**(관계 대상이라 우리가 고른 자원이 아니다), 상세 화면의 제목은 이미
 * 어느 자원인지 알고 들어온다(`detailView` 의 `resource` 인자). 거기서 다시
 * `resourceByType(data.type)` 을 지나가면 백엔드가 `data.type` 을 다른 값으로
 * 내보내는 날 화면이 **제 자원의 선언을 두고도** id 로 물러선다.
 */
function displayText(resource: ResourceDefinition, object: ResourceObject): string {
  const display = displayAttribute(resource)
  if (display === undefined) return object.id

  // 이름 자리가 비어 있으면(선언과 응답이 어긋났거나 값이 null) id 로
  // 물러선다 - 빈 배지·빈 제목을 그리면 무엇을 가리키는지 알 수 없다.
  const text = formatAttributeValue(display[1], object.attributes?.[display[0]])
  return text === '' ? object.id : text
}

function cellsOf(
  resource: ResourceDefinition,
  object: ResourceObject,
  index: ResourceIndex,
): readonly ListCell[] {
  const attributes = listedAttributes(resource).map(([name, attribute]): ListCell => {
    const text = formatAttributeValue(attribute, object.attributes?.[name])
    return { key: name, kind: 'attribute', values: text === '' ? [] : [text] }
  })

  const relationships = Object.entries(resource.relationships).map(
    ([name, relationship]): ListCell => ({
      key: name,
      kind: 'relationship',
      values: relationshipValues(relationship, object.relationships?.[name], index),
    }),
  )

  return [...attributes, ...relationships]
}

/**
 * 관계 하나의 대상들을 표시 문자열로. **목록의 칸과 상세의 항목이 같은 규칙을
 * 쓴다** - 같은 관계가 두 화면에서 다르게 읽히면 그게 결함이다.
 *
 * 선언과 백엔드의 cardinality 가 어긋나면 `resolveToOne`·`resolveToMany` 가
 * 던진다. **여기서 잡지 않는다** - 잡으면 거울이 어긋난 사실이 빈 칸 하나로
 * 조용히 묻힌다. 거울의 어긋남을 잡는 것은 D5 의 계약 거울 테스트다
 * (`lib/resources/AGENTS.md`).
 */
function relationshipValues(
  relationship: RelationshipDefinition,
  data: RelationshipObject | undefined,
  index: ResourceIndex,
): readonly string[] {
  const related =
    relationship.cardinality === 'many'
      ? resolveToMany(data, index)
      : toList(resolveToOne(data, index))
  return related.map(relatedText)
}

function toList<T>(value: T | null): T[] {
  return value === null ? [] : [value]
}

/**
 * 컬렉션 문서를 표의 행들로.
 *
 * `included` 색인은 문서 하나에 하나뿐이다 - 여러 행이 같은 분류를 가리켜도
 * 같은 색인으로 전부 풀린다(`normalize.ts` 머리말).
 */
export function listRows(
  resource: ResourceDefinition,
  document: CollectionDocument,
): readonly ListRow[] {
  const index = indexResources(document.included)
  return document.data.map((object) => ({ id: object.id, cells: cellsOf(resource, object, index) }))
}

/**
 * (template-typescript-expo) 목록 한 쪽의 크기 - 스펙 8.3. 한 화면을 채우고 세 백엔드의 상한
 * 100 안에 든다. URL 에 `page[size]` 가 있으면 그 값이 이긴다(`listQuery`).
 */
export const LIST_PAGE_SIZE = 20

/**
 * 목록 요청의 백엔드 쿼리.
 *
 * ## `include` 를 **반드시** 싣는다 (R-10②)
 *
 * **빼먹었을 때의 증상이 백엔드마다 다르다**(2026-09-07 D3 Task 7 이 정본에
 * 직접 물어 잰 것 + R-10②):
 *
 * | 백엔드 | `include` 없이 오는 것 | 화면 |
 * | --- | --- | --- |
 * | 정본 | linkage(`type`·`id`)는 온다. **`included` 는 통째로 없다** | 배지가 이름 대신 **UUID** |
 * | NestJS | linkage 자체가 없다 | `resolveToOne` 이 `null` → 조용히 **"분류 없음"** |
 *
 * 오래 통용된 서술("정본에서는 화면이 똑같아 보인다")은 **틀렸다.** linkage 에
 * 있는 것은 `type`·`id` 뿐이고 **이름은 `included` 에만 있다** - 색인에 없는
 * 관계를 `relatedText` 가 id 글자로 그리기 때문에(Task 6 §3) 정본에서도
 * 화면이 눈에 띄게 달라진다.
 *
 * ### 어느 층을 무엇이 지키는가 - 두 층이 다르다 (뮤테이션 실측)
 *
 * | 무엇을 지웠나 | 단위 | E2E |
 * | --- | --- | --- |
 * | **이 함수의 아래 `query.set(...)` 줄** | **3 실패** | 1 실패 |
 * | `page.tsx` 가 그 결과를 `request()` 로 넘기는 **배선** | 0 (667 통과) | **1 실패** |
 *
 * 즉 **이 줄 자체는 단위가 먼저 잡는다**(`test/unit/resources/view.test.ts`
 * 의 `listQuery` 절이 나가는 쿼리를 통째로 고정한다). E2E 단독으로만 지켜지는
 * 것은 **화면이 그 쿼리를 실제로 태워 보내는가** 라는 배선 층이다
 * (`test/e2e/examples.spec.ts`). 둘을 뭉뚱그려 "이 줄은 E2E 가 지킨다" 고 읽지
 * 마라 - 빠른 반복에서 이 줄을 만졌다가 단위가 왜 죽는지 못 찾게 된다.
 *
 * 여전히 정본이 재현하지 못하는 것은 **NestJS 쪽 증상**이다 - 그쪽은 화면도
 * 로그도 아무 말을 하지 않는 조용한 실패라 D5 의 매트릭스가 볼 자리다.
 *
 * **`set` 이지 `append` 가 아니다.** URL 에 이미 `include` 가 있으면 덮는다 -
 * 붙이면 중복 `include` 가 되어 백엔드가 400 `INVALID_INCLUDE` 로 거절하고
 * (R-8) 목록이 통째로 배너가 된다. 스펙 8.1 의 "남의 파라미터를 걸러내지
 * 않는다" 와 어긋나지 않는다 - 이건 걸러내는 것이 아니라 **이 화면이 그리는
 * 관계를 요청에 실는 것**이고, 그러지 않으면 그릴 수 없다.
 *
 * 관계가 없는 자원은 `includes` 가 빈 집합이라 아무것도 싣지 않는다 -
 * 참조 자원에 `?include=` 를 붙이는 것 자체가 400 이다(R-5).
 *
 * ## 싣지 않는 것 둘
 *
 * - **`sort`.** URL 에 없으면 백엔드가 자기 기본 정렬을 쓴다(R-4 의
 *   `-createdAt`, 선언의 `defaultSort` 가 그 거울이다). 고른 정렬을 URL 로
 *   되돌리는 것은 정렬 UI 를 만드는 쪽의 일이다.
 * - **`page[totals]`.** 이 화면은 총 개수를 어디에도 표시하지 않는다. 스펙
 *   8.3 은 실제로 표시하는 화면에서만 켜라고 한다 - 백엔드가 COUNT 를
 *   피하려고 만든 계약이다. 페이지 번호 UI 가 총 페이지 수를 필요로 하는
 *   순간이 그것을 켤 자리다.
 */
export function listQuery(
  resource: ResourceDefinition,
  searchParams: SearchParams,
): URLSearchParams {
  const query = toBackendQuery(withoutUndefined(searchParams))
  // (template-typescript-expo) 목록은 커서다(스펙 8.3) - 위치는 이 화면이 정한다. 무한 스크롤은
  // 언제나 처음부터 읽으므로 URL 에 실린 쪽 번호·커서는 버리고 커서의 입구(`page[after]=`)를
  // 싣는다. 남기면 offset 과 cursor 가 섞여 400 이다. 쪽 크기는 위치가 아니라 "한 쪽에 몇
  // 개" 라서 URL 에 있으면 그 값을 쓴다.
  for (const name of [...query.keys()]) {
    if (isPagePositionParameter(name)) query.delete(name)
  }
  query.set(pageParameter('after'), '')
  if (!query.has(pageParameter('size'))) query.set(pageParameter('size'), String(LIST_PAGE_SIZE))
  if (resource.includes.length > 0) query.set(INCLUDE_PARAMETER, resource.includes.join(','))
  return query
}

/**
 * Next 의 `searchParams` 는 값이 `undefined` 일 수 있는 레코드다.
 * `toBackendQuery` 의 입력 타입에는 그 자리가 없으므로 여기서 떨군다 -
 * 값이 없는 파라미터는 보낼 것도 없다.
 */
function withoutUndefined(input: SearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(input)) {
    if (value !== undefined) out[name] = value
  }
  return out
}

/**
 * 목록 화면이 백엔드에 보낼 요청 하나. `request()` 의 두 인자와, 그 요청을
 * 만든 쿼리를 함께 들고 있다.
 *
 * **쿼리를 따로 들고 있는 이유:** 화면 상태를 정할 때 "이 결과가 필터가 걸린
 * 결과인가" 를 알아야 하는데(`listView` 의 `filtered`), 그 판정은 **실제로
 * 나간 쿼리**에 대해서만 뜻이 있다. 화면이 쿼리를 두 번 만들면 두 벌이
 * 갈라질 수 있으므로 한 객체에 묶는다.
 */
export interface ListRequest {
  path: string
  query: URLSearchParams
  options: RequestOptions
}

/**
 * 목록 요청 하나를 통째로 조립한다. **화면이 부르는 것은 이 함수 하나다.**
 *
 * ## 왜 `page.tsx` 에서 조각조각 부르지 않는가 (리뷰 라운드 1, Important-1)
 *
 * (template-typescript-expo) 아래 경위는 원본 저장소의 것이다 - 이 파일은 `withAcceptLanguage` 를
 * 쓰지 않는다. 언어는 앱의 API 클라이언트(`platform/api.ts`)가 싣는다(스펙 9.4).
 *
 * 처음에는 `page.tsx` 가 `listQuery` · `withAcceptLanguage` · `EXAMPLE.path` 를
 * 각각 불렀다. 그 배선은 **어느 계층도 관측하지 못한다** - RSC 라 단위
 * 테스트가 부를 수 없고, E2E 는 그 결과를 화면으로만 본다. 리뷰어가 실제로
 * 뮤턴트를 넣어 확인했다: `listQuery(...)` 호출을 빈 `URLSearchParams` 로
 * 바꾸고, `withAcceptLanguage` 를 지워도 **게이트 8/8 이 초록이었다.**
 *
 * 그중 `include` 를 잃는 쪽이 특히 나쁘다 - 정본에서는 분류·태그 배지가
 * **이름에서 UUID 로** 바뀌고, NestJS 배포에서는 **조용히 빈다.** (예전에 여기
 * *"정본에서는 아무 변화가 없다"* 고 적혀 있었으나 거짓이다 - `listQuery`
 * 주석의 표가 실측이다.)
 *
 * 조립을 여기로 모으면 세 값이 **한 번의 `toEqual`** 로 고정된다.
 *
 * ## 남는 무방비 - 정확히 어디까지인가
 *
 * 이 함수가 지우지 못하는 것은 **`page.tsx` 가 이 함수를 부르고 그 결과를
 * `request()` 에 그대로 넘긴다**는 한 줄이다. 그 한 줄은 이 저장소의 알려진
 * 구조적 한계다(요청 스코프를 스텁하지 않는 관례 - 루트 `AGENTS.md`). 즉:
 *
 * - **지켜진다:** `include` 를 싣는가 · 옵션에 `Accept-Language` 를 싣지 않는가(싣는 자리는
 *   `platform/api.ts` 하나다, 스펙 9.4) · 어느 경로로 가는가 · 남의 파라미터를 거르는가.
 *   전부 아래 테스트가 잰다.
 * - ~~**지켜지지 않는다:** `page.tsx` 가 `plan.options` 대신 `{}` 를
 *   넘기는 것.~~ **(D3 Task 7) E2E 가 닫았다** - `test/e2e/examples.spec.ts`
 *   가 행 있는 목록을 상대로 돌고, 뮤턴트(`request(plan.path, {})`)가 14개 중
 *   11개를 죽였다. 남는 것은 **그 화면이 애초에 이 함수를 부르는가** 뿐이고,
 *   그것은 요청 스코프를 스텁하지 않는 관례가 만드는 구조적 한계다.
 * - **`include` 도 E2E 가 닫는다 - 옛 서술은 틀렸다.** 여기 오래 *"정본은
 *   include 없이도 linkage 를 주므로 분류 이름이 그대로 그려진다"* 고 적혀
 *   있었는데 **거짓이다.** linkage 에는 `type`·`id` 뿐이고 이름은 `included`
 *   에만 있다 - 빼면 정본에서도 배지가 UUID 로 바뀐다(`listQuery` 의 표,
 *   2026-09-07 실측). D5 의 매트릭스가 볼 자리는 이 **줄**이 아니라 NestJS
 *   쪽의 **조용한 증상**이다.
 */
export function listRequest(resource: ResourceDefinition, searchParams: SearchParams): ListRequest {
  const query = listQuery(resource, searchParams)
  return {
    path: resource.path,
    query,
    // 읽기는 완전 공개라 accessToken 을 넣지 않는다(R-9). 넣으면 이 화면이
    // 세션에 결합되는데 백엔드는 그 헤더를 아예 파싱하지 않는다.
    //
    // (template-typescript-expo) Accept-Language 도 넣지 않는다 - 앱의 API 클라이언트
    // (`platform/api.ts`)가 모든 요청에 싣는다(스펙 9.4).
    options: { query },
  }
}

/**
 * 배너에 그릴 문구들.
 *
 * `groupErrors` 의 세 통을 **전부 편다.** 목록 화면에는 오류를 붙일 입력도
 * 관계 선택기도 없으므로, 필드 통에 담긴 문구를 버리면 사용자는 아무 설명도
 * 없는 빈 표를 본다. 실측(R-8)으로는 조회 오류가 전부 `source.parameter` 라
 * 문서 통으로만 오지만, 그 사실에 기대어 나머지 둘을 버리면 백엔드가 언젠가
 * `pointer` 를 붙이는 날 조용히 문구가 사라진다.
 *
 * 문구 자체는 만들지 않는다 - 백엔드가 `Accept-Language` 로 협상해 내려준
 * `detail`·`title` 그대로다(스펙 9.2).
 */
export function bannerMessages(errors: readonly ErrorObject[]): readonly string[] {
  const grouped = groupErrors(errors)
  return [
    ...grouped.document,
    ...Object.values(grouped.attributes).flat(),
    ...Object.values(grouped.relationships).flat(),
  ]
}

/** 사용자에게 보이지 않는 진단 문자열. `app/error.tsx` 가 콘솔에만 남긴다. */
function diagnosticOf(errors: readonly ErrorObject[]): string {
  return errors.map((error) => `${error.status ?? '?'} ${error.code ?? '?'}`).join(', ')
}

/**
 * 응답 하나에서 화면 상태를 정한다.
 *
 * ## 오류 갈래 - 배너로 충분한가 (브리핑 Step 4 의 판단)
 *
 * **충분하다.** 조회 오류 다섯(`INVALID_FILTER`·`INVALID_SORT`·`INVALID_PAGE`·
 * `INVALID_INCLUDE`·`INVALID_QUERY_PARAMETER`)은 전부 `source.parameter` 를
 * 갖는데 `placeError` 는 `pointer` 만 읽으므로 `{kind:'document'}` 가 되고,
 * `actionForErrors` 가 `'banner'` 를 고른다(R-8·D-5). 즉 **어느 컨트롤이
 * 문제인지 화면이 알 수 없다.**
 *
 * 그것을 알려면 `source.parameter` 를 해석하는 새 코드가 필요하다. Task 3 은
 * "붙일 컨트롤이 하나도 없다" 를 이유로 미뤘고, **컨트롤이 생긴 Task 4 가
 * 다시 판단해 여전히 붙이지 않기로 했다** - 근거 셋과 무엇이 바뀌면 뒤집히는지는
 * 이 파일 아래 `filterQuery` 의 "오류를 컨트롤에 붙이지 않는다" 절이 갖는다.
 *
 * ## 던지는 자리 셋 - 전부 `app/error.tsx` 로 간다
 *
 * (template-typescript-expo) 첫째는 던지지 않는다 - `{ kind: 'unreachable' }` 을 돌려주고
 * 화면이 앱 문구와 "다시 시도" 를 그린다(스펙 9.3, `ListFailure`). 남은 둘은 이 앱에서 Expo
 * Router 의 ErrorBoundary 로 간다.
 *
 * 1. **`'transport'`** - 백엔드가 응답조차 주지 못했다. D2 가 세운 계약이다
 *    (스펙 9.2). 합성 코드 문자열을 비교하지 않고 `actionForErrors` 의 분류로
 *    판정한다(`lib/jsonapi/AGENTS.md`).
 * 2. **본문 없는 성공 응답(204).** 컬렉션 GET 에 올 수 없는 응답이다. 빈
 *    목록으로 다루면 깨진 백엔드가 "자료 없음" 으로 위장한다.
 * 3. **문구가 하나도 없는 오류 문서.** 배너를 그려도 빈 상자라(`FormBanner` 는
 *    빈 배열에 `null` 이다) 사용자는 아무 설명 없는 빈 화면을 본다.
 *
 * 셋 다 **여기서** 던진다 - `page.tsx` 에 `if (...) throw` 를 두면 그 줄이
 * 관측 불가가 된다(이 파일 머리말). 던지는 문구는 진단용이고 사용자에게
 * 보이지 않는다 - `app/error.tsx` 가 자기 문구를 그리고 이것은 콘솔로만 간다.
 *
 * `document` 를 **`status` 가 아니라 `document !== null` 로 좁힌다** -
 * `JsonApiResult` 의 판별자가 섞여 있어 `status` 로는 좁혀지지 않는다
 * (`lib/jsonapi/client.ts` 의 실측).
 *
 * ## 쿼리가 아니라 `ListRequest` 를 받는다
 *
 * `filtered` 를 정하는 쿼리는 **실제로 나간 요청의 그것이어야** 뜻이 있다.
 * 화면이 쿼리를 따로 넘기게 두면 요청에 쓴 것과 다른 것을 넘길 수 있는데,
 * 그 자리는 RSC 라 아무 테스트도 보지 못한다(`listRequest` 의 "남는 무방비").
 * 한 객체로 묶으면 화면이 쿼리를 두 벌 만들 **이유**가 없어진다.
 *
 * **다만 타입이 그것을 강제하지는 못한다.** `RequestOptions` 의 필드가 전부
 * 선택적이라 `query` 와 `options.query` 는 타입 수준에서 서로 무관하다 -
 * 둘이 어긋난 `ListRequest` 를 손으로 지어 이 함수에 넘겨도 `pnpm typecheck`
 * 가 통과한다(리뷰어가 실증했다). 실제로 지키는 것은 타입이 아니라
 * **`page.tsx` 가 같은 `plan` 변수를 `request()` 와 여기에 재사용하는 코드
 * 관례**다. 같은 종류의 무방비이고, `listRequest` 주석의 "남는 무방비" 절이
 * 그 범위를 갖는다.
 *
 * ## 쪽 여럿을 한 목록으로 (template-typescript-expo)
 *
 * 무한 스크롤이 읽은 쪽들을 순서대로 잇는다(스펙 8.3). 첫 쪽이 실패하면 그 실패가 화면 전부이고,
 * 뒤따르는 쪽이 실패하면 읽은 행은 두고 `failure` 에 싣는다. 실패한 쪽 뒤에는 쪽이 없다 -
 * `nextPageQuery` 가 실패한 쪽에서 `null` 을 준다. 같은 id 는 처음 나온 행만 남긴다 - 쪽을
 * 읽는 사이 정렬 값이 바뀐 행은 두 쪽에 걸릴 수 있고, 목록의 키가 겹치면 React 가 오류를 낸다.
 */
export function listView(
  resource: ResourceDefinition,
  plan: ListRequest,
  pages: readonly JsonApiResult<CollectionDocument>[],
): ListView {
  const rows: ListRow[] = []
  const seen = new Set<string>()
  let failure: ListFailure | null = null

  for (const [position, result] of pages.entries()) {
    if (!result.ok) {
      failure = failureOf('목록', result.errors)
      if (position === 0) return failure
      break
    }

    if (result.document === null) {
      throw new Error(`목록 요청이 본문 없는 응답을 받았다: ${result.status}`)
    }

    for (const row of listRows(resource, result.document)) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      rows.push(row)
    }
  }

  return {
    kind: 'list',
    columns: listColumns(resource),
    rows,
    filtered: hasFilterParams(plan.query),
    failure,
  }
}

/**
 * (template-typescript-expo) 오류 응답 하나 → 화면이 그릴 실패. 배너에 그릴 문구가 하나도 없으면
 * 던진다 - 빈 배너는 아무 설명 없는 빈 화면이다(`listView` 의 "던지는 자리").
 */
function failureOf(request: string, errors: readonly ErrorObject[]): ListFailure {
  if (actionForErrors(errors) === 'transport') return { kind: 'unreachable' }
  const messages = bannerMessages(errors)
  if (messages.length === 0) {
    throw new Error(`${request} 요청이 문구 없는 오류로 실패했다: ${diagnosticOf(errors)}`)
  }
  return { kind: 'banner', messages }
}

/**
 * (template-typescript-expo) 무한 스크롤의 다음 요청 쿼리 - 응답의 `links.next` 가 담은 쿼리
 * 그대로다(스펙 8.3). 커서를 만들지도 해석하지도 않는다 - `linkQuery` 가 문자열을 옮길 뿐이다.
 *
 * 더 읽을 것이 없으면 `null` 이다:
 *
 * - **링크가 없다.** 정본·Rails 는 `null` 로, NestJS 는 키를 지워서 말한다(R-10①) - 판정은
 *   `linkPresent` 하나다.
 * - **이 쪽이 비었다.** NestJS 는 커서 모드의 끝에서도 `next` 에 커서를 채워 보낸다(R-10①).
 *   빈 쪽 뒤에 읽을 행은 없다 - 그 링크를 따라가면 빈 쪽을 한 번 더 부를 뿐이다.
 * - **이 쪽이 실패했거나 본문이 없다.** 실패한 쪽 뒤로는 읽지 않는다(`listView` 의 `failure`).
 * - **링크를 읽을 수 없다.** `linkQuery` 가 `null` 을 준다 - 던지지 않는다.
 * - **링크에 쿼리가 없다.** `''` 이거나 경로뿐인 링크는 따라갈 커서가 없다. `linkQuery` 는 이때 빈
 *   `URLSearchParams` 를 주는데, 호출자가 그것을 문자열로 바꿔 쪽 매개변수로 삼으면(`?.toString()`)
 *   `''` 가 된다. `''` 는 "다음 쪽 없음"(`undefined`)이 아니라 쪽 매개변수라 끝이 오지 않고 빈
 *   쿼리의 요청을 한 번 더 보낸다.
 */
export function nextPageQuery(result: JsonApiResult<CollectionDocument>): URLSearchParams | null {
  if (!result.ok || result.document === null) return null
  if (result.document.data.length === 0) return null
  const next = result.document.links?.next
  if (!linkPresent(next)) return null
  const query = linkQuery(next)
  if (query === null || query.toString() === '') return null
  return query
}

/* ------------------------------------------------------------------------- *
 * 필터 바 (D3 Task 4)
 * ------------------------------------------------------------------------- */

/**
 * 선택 컨트롤의 보기 하나. `value` 는 **백엔드가 받는 값 그대로**이고
 * `label` 이 사람이 읽는 것이다.
 *
 * enum 값의 라벨은 선언이 갖는다(`EnumValue`, D4 Task 1) - `enumOptions` 가
 * 그 라벨을 그대로 옮긴다. 필터 바와 폼의 `<select>` 가 같은 라벨을 쓴다.
 */
export interface FilterOption {
  readonly value: string
  readonly label: string
}

/**
 * 범위의 끝에 쓸 수 있는 연산자 - 하한 둘, 상한 둘뿐이다.
 *
 * `FilterOperator` 그대로 두지 않는 이유: 범위의 끝에 `isNull` 이나 `in` 이
 * 오는 것은 뜻이 없고, `FilterInput` 이 연산자로 판별되는 합집합이라
 * (`lib/jsonapi/query.ts`) 넓은 타입은 그 합집합에 그대로 들어가지도 않는다.
 */
export type BoundOperator = 'gte' | 'gt' | 'lte' | 'lt'

/** 범위 컨트롤의 한쪽 끝. 하한인지 상한인지는 `FilterField` 안의 자리가 말한다. */
export interface FilterBound {
  readonly operator: BoundOperator
  readonly parameter: string
  /** 지금 URL 이 담고 있는 값 - **입력이 그대로 그릴 수 있는 모양**이다. */
  readonly value: string
}

/**
 * 필터 컨트롤 하나 + 지금 URL 이 담고 있는 값.
 *
 * **화면은 이것만 받으면 그린다.** 자원 선언도, 어떤 자원인지도 필요 없다 -
 * 그래서 `components/resource/filter-bar.tsx` 가 자원 이름으로 분기하지 않는다
 * (`components/resource/AGENTS.md`).
 *
 * `parameter` 를 들고 다니는 이유가 둘이다. 하나는 **입력의 `name` 이 곧 URL
 * 파라미터 이름**이라 폼에서 값을 되읽는 자리가 한 벌뿐이라는 것이고, 다른
 * 하나는 나중에 `source.parameter` 를 컨트롤에 붙이고 싶어지는 날(아래
 * `filterQuery` 의 "오류를 컨트롤에 붙이지 않는다") 맞댈 값이 이미 여기
 * 있다는 것이다.
 */
export type FilterField =
  | {
      readonly kind: 'select'
      readonly id: string
      readonly key: string
      readonly label: string
      readonly operator: FilterOperator
      readonly parameter: string
      /** 여럿 고를 수 있는가. 참이면 `operator` 는 `in` 이고 값이 쉼표로 묶인다. */
      readonly multiple: boolean
      readonly options: readonly FilterOption[]
      readonly selected: readonly string[]
    }
  | {
      readonly kind: 'text'
      readonly id: string
      readonly key: string
      readonly label: string
      readonly operator: FilterOperator
      readonly parameter: string
      readonly value: string
    }
  | {
      readonly kind: 'range'
      readonly id: string
      readonly key: string
      readonly label: string
      /** 입력의 `type`. 값을 어떻게 쓰고 되읽는지도 이것이 정한다. */
      readonly shape: 'number' | 'date' | 'text'
      /** 백엔드가 허용한 쪽만 있다. 둘 다 없으면 애초에 이 컨트롤이 없다. */
      readonly lower: FilterBound | null
      readonly upper: FilterBound | null
    }

/**
 * 관계에서 나온 필터 키의 꼬리. `QueryField`(define.ts)가 FK 필터를
 * `` `${관계이름}.id` `` 로 정의한다 - 자원 이름이 아니라 **선언의 구조**다.
 */
const RELATIONSHIP_FILTER_SUFFIX = '.id'

/** 날짜 입력이 내놓는 모양. `<input type="date">` 는 언제나 이 형식이다. */
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 조회 필드 하나에 붙일 이름 - **필터 컨트롤과 정렬 항목이 함께 쓴다.**
 *
 * 세 갈래다. 속성에서 온 이름은 그 속성의 `label`, 관계에서 온 FK 이름
 * (`category.id`)은 **그 관계의 `label`**, 그 밖(`queryOnlyFields`)은 키
 * 그대로. 가운데 갈래가 없으면 화면에 `category.id` 라는 날것이 뜬다 -
 * 그 이름은 사용자가 아니라 백엔드 조회 정책의 것이다.
 *
 * `sorts` 와 `filters` 는 **같은 어휘(`QueryField`)를 쓴다**(define.ts). 같은
 * 필드가 필터 바에서는 "점수", 정렬 메뉴에서는 "score" 로 보이면 사용자는 그
 * 둘을 같은 것으로 읽지 못한다 - 그래서 규칙을 이 함수 하나에 둔다.
 *
 * **`queryOnlyFields` 갈래는 키를 그대로 낸다 - 세 번째 갈래가 아직 없다.**
 * `EXAMPLE_CATEGORY.sorts` 의 `createdAt` 이 실제로 이 자리를 밟는다(그
 * 자원에서 `createdAt` 은 속성이 아니라 `queryOnlyFields` 다) - 정렬 메뉴에
 * `createdAt` 이라는 날문자가 뜬다. **오늘은 보이지 않는다**: `app/` 에는
 * 분류·라벨의 목록 화면이 없어서(라우트가 `/examples` 와 `/examples/[id]`
 * 뿐이다) 이 자원으로 `sortOptions`·`filterFields` 를 부르는 화면 자체가
 * 없다. 분류·라벨 목록 화면이 생기는 날 이 자리를 고쳐라 - `queryOnlyFields`
 * 이름 → 사람이 읽을 라벨의 대응표가 필요해진다(D4 Task 1 조사, 핸드오프
 * §6-9).
 */
function fieldLabel(resource: ResourceDefinition, key: string): string {
  const attribute = resource.attributes[key]
  if (attribute !== undefined) return attribute.label

  if (key.endsWith(RELATIONSHIP_FILTER_SUFFIX)) {
    const relationship = resource.relationships[key.slice(0, -RELATIONSHIP_FILTER_SUFFIX.length)]
    if (relationship !== undefined) return relationship.label
  }

  return key
}

/** 이 파라미터로 URL 에 들어 있는 값들. 없으면 빈 배열이다. */
function paramValues(searchParams: SearchParams, name: string): readonly string[] {
  const value = searchParams[name]
  return value === undefined ? [] : valueList(value)
}

/** 이 파라미터의 값 하나. 여럿이면 첫 번째다(그 URL 은 어차피 백엔드가 400 을 낸다). */
function paramValue(searchParams: SearchParams, name: string): string {
  return paramValues(searchParams, name)[0] ?? ''
}

/** 허용된 연산자들 중 후보 순서대로 처음 맞는 것. 없으면 `null`. */
function pickOperator(
  operators: readonly FilterOperator[],
  candidates: readonly BoundOperator[],
): BoundOperator | null {
  for (const candidate of candidates) {
    if (operators.includes(candidate)) return candidate
  }
  return null
}

/**
 * ISO 8601 순간 → 날짜 입력이 그릴 수 있는 **UTC 날짜**.
 *
 * `Date` 를 거친다 - 입력 문자열을 자르면 `+09:00` 인 Rails 값에서 하루가
 * 어긋난다(R-10③, `formatDateTime` 과 같은 이유). UTC 로 접는 것은 이 화면의
 * 시각 표시가 이미 UTC 고정이기 때문이다 - 열에 보이는 날짜와 필터가 뜻하는
 * 날짜가 같아야 한다.
 *
 * 읽을 수 없는 값은 빈 문자열이다. `<input type="date">` 가 그릴 수 없는 값을
 * 넣으면 브라우저가 조용히 비우므로 여기서 미리 비운다 - 대가는 아래
 * `filterQuery` 의 "바가 표현할 수 없는 값" 절에 적었다.
 */
function toDateInputValue(raw: string): string {
  if (raw === '') return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

/**
 * 날짜 입력의 UTC 날짜 → 그 날의 **경계 순간**.
 *
 * 날짜 입력이 고르는 것은 순간이 아니라 하루라, 하한은 그 날의 시작이고
 * 상한은 그 날의 끝이다. 상한을 `T00:00:00` 으로 두면 사용자가 고른 날이
 * 통째로 빠진다.
 *
 * **offset 을 반드시 붙인다.** `filter[createdAt][gte]=2026-09-01` 도
 * `...T00:00:00`(offset 없음)도 백엔드가 400 으로 거절한다(R-6, 2026-09-07
 * 정본으로 재확인). 날짜 입력 값을 그대로 실어 보내는 구현은 **누르는 족족
 * 오류**가 된다.
 *
 * ## 끝을 `.999999` 로 잡은 근거 - **실측은 한 줄뿐이다**
 *
 * **실측:** 정본이 `...T23:59:59.999999+00:00` 을 200 으로 받는다(2026-09-07).
 *
 * **추론(재지 않았다):** 그 값이 *그 날의 마지막 표현 가능한 순간* 이라는 것.
 * 세 백엔드가 `timestamptz`(마이크로초)로 저장한다고 **보고** 잡았고, 그
 * 저장 타입을 실제로 확인한 것은 아니다. NestJS·Rails 가 이 값을 받는지도
 * 재지 않았다 - **그 자리를 닫는 것은 D5 의 3-백엔드 매트릭스다.** 더 짧은
 * 마이크로초 이하 정밀도를 가진 백엔드가 있다면 그 날의 마지막 몇 나노초가
 * 빠질 수 있다.
 *
 * 다음 날 `00:00:00` 에 `lt` 를 거는 방법은 그 추론에 기대지 않지만 프론트에
 * 날짜 산술이 생긴다 - 그쪽으로 옮길 자리를 여기 적어 둔다.
 *
 * 날짜 입력의 모양이 아닌 값은 **손대지 않고 그대로 보낸다** - 스펙 8.1 의
 * 원칙 그대로 백엔드가 판정한다. 브라우저의 `type="date"` 는 이 갈래를 만들지
 * 않으므로 실제로 밟히는 것은 단위 테스트뿐이다.
 */
function fromDateInputValue(day: string, edge: 'lower' | 'upper'): string {
  if (!DATE_INPUT_PATTERN.test(day)) return day
  return edge === 'lower' ? `${day}T00:00:00+00:00` : `${day}T23:59:59.999999+00:00`
}

/** enum 선언의 값들을 보기로. 라벨은 선언이 갖는다(D4 Task 1). */
function enumOptions(values: readonly EnumValue[]): readonly FilterOption[] {
  return values.map(({ value, label }) => ({ value, label }))
}

/**
 * "아무것도 고르지 않음" 의 문구.
 *
 * **한 곳에 둔다.** 단일 선택은 이것을 보기 하나(`ANY_OPTION`)로 그리고, 다중
 * 선택은 보기가 아니라 **아무것도 안 골랐을 때의 자리표시자**로 그린다 -
 * 표현이 둘로 갈리는데 문구는 같아야 한다. 컴포넌트에 리터럴로 적어 두면
 * 여기를 고칠 때 다중 선택만 옛 문구로 남는다(리뷰 라운드 1 의 Minor-4).
 */
export const ANY_FILTER_LABEL = '전체'

/** 단일 선택의 "고르지 않음". 값이 `''` 라 제출하면 파라미터가 사라진다. */
const ANY_OPTION: FilterOption = { value: '', label: ANY_FILTER_LABEL }

/** `isNull` 컨트롤의 보기 둘. 값은 백엔드 문법이고(R-6) 라벨만 사람의 것이다. */
const NULLNESS_OPTIONS: readonly FilterOption[] = [
  { value: 'true', label: '값 없음' },
  { value: 'false', label: '값 있음' },
]

function selectField(
  key: string,
  label: string,
  operator: FilterOperator,
  multiple: boolean,
  options: readonly FilterOption[],
  searchParams: SearchParams,
): FilterField {
  const parameter = filterParameter(key, operator)
  const known = new Set(options.map((option) => option.value))
  // 다중 선택은 URL 에 쉼표로 묶여 있다(R-6). 단일 선택은 값 하나다.
  const raw = multiple
    ? paramValue(searchParams, parameter)
        .split(',')
        .map((value) => value.trim())
    : [paramValue(searchParams, parameter)]

  return {
    kind: 'select',
    id: parameter,
    key,
    label,
    operator,
    parameter,
    multiple,
    options,
    // **보기에 없는 값은 버린다.** 컨트롤이 그릴 수 없는 값을 골라 둔 것처럼
    // 보이게 할 수 없고, 그런 값은 어차피 백엔드가 400 으로 거절한다.
    selected: [...new Set(raw.filter((value) => value !== '' && known.has(value)))],
  }
}

function textField(
  key: string,
  label: string,
  operator: FilterOperator,
  searchParams: SearchParams,
): FilterField {
  const parameter = filterParameter(key, operator)
  return {
    kind: 'text',
    id: parameter,
    key,
    label,
    operator,
    parameter,
    value: paramValue(searchParams, parameter),
  }
}

function boundOf(
  key: string,
  operator: BoundOperator | null,
  shape: 'number' | 'date' | 'text',
  searchParams: SearchParams,
): FilterBound | null {
  if (operator === null) return null
  const parameter = filterParameter(key, operator)
  const raw = paramValue(searchParams, parameter)
  return { operator, parameter, value: shape === 'date' ? toDateInputValue(raw) : raw }
}

/** 속성의 종류 → 입력의 모양. 값을 쓰고 되읽는 규칙도 여기서 갈린다. */
function shapeOf(kind: AttributeDefinition['kind']): 'number' | 'date' | 'text' {
  if (kind === 'int') return 'number'
  if (kind === 'datetime') return 'date'
  return 'text'
}

/**
 * 필터 키 하나의 **값 컨트롤**. 없으면 `null`.
 *
 * 사다리를 위에서부터 하나만 고른다:
 *
 * 1. **enum + `in` → 다중 선택.** 값 집합이 닫혀 있고 여럿을 고를 수 있다.
 * 2. **enum + `exact` → 단일 선택.**
 * 3. **하한/상한 연산자가 하나라도 → 범위 입력.** 있는 쪽만 그린다.
 * 4. **`contains` → 텍스트 입력.**
 * 5. **`exact` → 텍스트 입력.**
 *
 * ## 왜 이 순서인가
 *
 * - **enum 이 맨 위인 것은 값 목록을 아는 유일한 갈래이기 때문이다.** 고를 수
 *   있는 것을 보여주는 컨트롤이 자유 입력보다 언제나 낫다. `in` 이 `exact` 를
 *   포함하므로(값 하나짜리 `in` 도 200 이다 - 실측) 둘 다 있으면 `in` 을 쓴다.
 * - **범위가 텍스트보다 위인 것은 순서가 있는 필드이기 때문이다.** 백엔드가
 *   비교 연산자를 허용했다는 것이 곧 그 뜻이고, 그런 필드에 `contains` 를
 *   주는 백엔드는 없다(R-4).
 * - **`contains` 가 `exact` 보다 위인 것은 검색이 목록 화면의 질문이기
 *   때문이다.** 제목을 정확히 아는 사람은 목록을 보지 않는다.
 *
 * ## 속성 선언이 없으면 값 컨트롤을 만들지 않는다
 *
 * 필터 키의 어휘는 `QueryField` 라 **속성이 아닌 키가 실재한다**
 * (`category.id`, `queryOnlyFields`). 그런 키는 `kind` 를 알 수 없으므로 위
 * 사다리를 탈 수 없다 - 값이 UUID 인지 이름인지, 목록이 무엇인지 모른다.
 *
 * 물러서서 자유 입력을 주는 선택도 있었지만 그러지 않았다. FK 자리에 사람이
 * 손으로 칠 수 있는 값은 UUID 뿐이고(정본은 형식이 틀린 값도 400 을 낸다 -
 * 실측), 고를 목록을 가져오려면 대상 자원을 **조회**해야 하는데 그것은
 * `relationship-picker.tsx`(스펙 5.2)의 일이고 이 계층은 fetch 를 하지
 * 않는다. 즉 여기서 만들 수 있는 것은 "누르면 대개 400 이 나는 칸" 뿐이다.
 * FK 를 실제로 고르는 컨트롤은 그 선택기를 만드는 태스크가 붙일 자리다.
 */
function valueField(
  key: string,
  label: string,
  attribute: AttributeDefinition | undefined,
  operators: readonly FilterOperator[],
  searchParams: SearchParams,
): FilterField | null {
  if (attribute === undefined) return null

  if (attribute.kind === 'enum') {
    if (operators.includes('in')) {
      return selectField(key, label, 'in', true, enumOptions(attribute.values), searchParams)
    }
    if (operators.includes('exact')) {
      return selectField(
        key,
        label,
        'exact',
        false,
        [ANY_OPTION, ...enumOptions(attribute.values)],
        searchParams,
      )
    }
    // 값 목록을 쓸 연산자가 없다. 아래 사다리로 내려간다 - enum 이라는 사실이
    // 컨트롤을 없앨 이유는 아니다.
  }

  const shape = shapeOf(attribute.kind)
  // 포함하는 쪽(`gte`·`lte`)을 먼저 고른다 - 컨트롤의 뜻이 "이 값부터/까지" 다.
  const lower = boundOf(key, pickOperator(operators, ['gte', 'gt']), shape, searchParams)
  const upper = boundOf(key, pickOperator(operators, ['lte', 'lt']), shape, searchParams)
  if (lower !== null || upper !== null) {
    return { kind: 'range', id: `${key}:range`, key, label, shape, lower, upper }
  }

  if (operators.includes('contains')) return textField(key, label, 'contains', searchParams)
  if (operators.includes('exact')) return textField(key, label, 'exact', searchParams)

  // 남은 연산자로는 이 바가 컨트롤을 만들 수 없다(예: 값 목록 없는 `in`).
  // 손으로 친 URL 은 그대로 나가므로 그 필터를 쓸 길이 사라지지는 않는다.
  return null
}

/**
 * 자원 선언 + 지금 URL → **필터 바가 그릴 컨트롤 전부.**
 *
 * 스펙 5.2: *"`filter-bar.tsx` — `filters` — 필드마다 허용 연산자만 노출"*.
 * 무엇을 그릴지 정하는 것은 **선언의 `filters` 와 `attributes` 뿐**이고, 자원
 * 이름은 이 함수에도 화면에도 없다.
 *
 * 한 필터 키가 컨트롤을 **둘까지** 만든다 - 값 컨트롤(`valueField`)과
 * `isNull` 컨트롤. 둘을 합치지 않은 이유: **"값이 있는가" 는 "값이 무엇인가"
 * 와 다른 질문**이라 한 컨트롤에 넣으면 "없음" 이 다른 값들과 같은 층위의
 * 보기처럼 보인다. 백엔드도 둘을 다른 연산자로 받고, 같은 필드에 서로 다른
 * 연산자 둘은 AND 로 허용된다(R-6, 실측). `isNull` 컨트롤은 값의 모양을 몰라도
 * 되므로 **속성 선언이 없는 키에도 붙는다** - `category.id` 가 그 자리다.
 *
 * 순서는 선언의 `filters` 순서 그대로다(`Object.entries`). 선언 순서가 곧
 * 표시 순서라는 것은 `attributes` 와 같은 규약이다(define.ts).
 */
export function filterFields(
  resource: ResourceDefinition,
  searchParams: SearchParams,
): readonly FilterField[] {
  const fields: FilterField[] = []

  for (const [key, operators] of Object.entries(resource.filters)) {
    const label = fieldLabel(resource, key)

    const value = valueField(key, label, resource.attributes[key], operators, searchParams)
    if (value !== null) fields.push(value)

    if (operators.includes('isNull')) {
      fields.push(
        selectField(
          key,
          // 값 컨트롤과 이름이 같으면 둘이 무엇을 다르게 묻는지 보이지 않는다.
          `${label} 유무`,
          'isNull',
          false,
          [ANY_OPTION, ...NULLNESS_OPTIONS],
          searchParams,
        ),
      )
    }
  }

  return fields
}

/**
 * 컨트롤들이 지금 담고 있는 값 전체를 한 문자열로.
 *
 * **React 가 입력을 다시 만들게 하는 열쇠다.** 이 바의 입력은 전부
 * 비제어(`defaultValue`)라, URL 이 바뀌어도 React 는 DOM 의 값을 건드리지
 * 않는다. 필터를 걸고 **뒤로 가기**를 누르면 주소는 되돌아갔는데 칸에는 지운
 * 조건이 남아 있게 된다 - 바가 걸리지 않은 필터를 걸린 것처럼 보여준다.
 * `<form key={...}>` 가 바뀌면 React 가 그 아래를 통째로 다시 만든다.
 *
 * `id` 를 함께 넣는 이유: 값만 이으면 컨트롤이 **바뀌었는데** 값이 우연히 같은
 * 경우(선언이 바뀌어 필터 키가 달라졌을 때)를 구별하지 못한다.
 */
export function filterFieldsKey(fields: readonly FilterField[]): string {
  return fields
    .map((field) => {
      if (field.kind === 'select') return `${field.id}=${field.selected.join(',')}`
      if (field.kind === 'text') return `${field.id}=${field.value}`
      return `${field.id}=${field.lower?.value ?? ''}..${field.upper?.value ?? ''}`
    })
    .join('&')
}

/**
 * (template-typescript-expo) 필터 시트가 들고 있는 값 - 파라미터 이름 → 값들. 원본의 `FormData`
 * 자리다(스펙 6.2: 입력이 `FormData` 가 아니라 폼 상태 객체다). 한 이름에 값이 여럿인 것은
 * 다중 선택이다 - `FormData.getAll` 과 같은 모양이다.
 */
export type FilterFormValues = Readonly<Record<string, readonly string[]>>

/** 폼에서 이 이름의 값들. 공백만인 값과 빈 값은 **없는 것으로 친다.** */
function formValues(form: FilterFormValues, name: string): readonly string[] {
  return (form[name] ?? []).map((entry) => entry.trim()).filter((value) => value !== '')
}

/**
 * 필터 바가 만드는 다음 URL 의 쿼리.
 *
 * ## 빈 값은 **파라미터를 지운다** — 실측된 함정 둘이 여기 있다
 *
 * 1. **빈 `in` 은 `buildQuery` 가 `Error` 를 던진다.** 다중 선택을 전부
 *    해제하면 정확히 그 자리를 밟는다(R-11③). 그래서 값이 하나도 없으면
 *    `filters` 에 넣지 않는다 - 던질 입력을 애초에 만들지 않는다.
 * 2. **빈 값을 실어 보내면 백엔드가 400 이다.** `filter[title]=` ·
 *    `filter[title][contains]=` · `filter[score][gte]=` · `filter[status][in]=`
 *    전부 `INVALID_FILTER` 다(2026-09-07 정본 실측). 즉 "빈 칸은 조건 없음"
 *    을 프론트가 지켜야 한다 - `<form method="get">` 처럼 빈 칸을 그대로
 *    직렬화하는 구현은 누르는 족족 오류를 낸다.
 *
 * ## 같은 필드+같은 연산자를 두 번 내지 않는다
 *
 * **그것이 400 이다**(R-6). 바가 소유한 파라미터 이름(`owned`)은 URL 에 있던
 * 것을 **버리고** 폼의 값으로 다시 쓴다. 남겨 두고 더하면 두 번이 된다.
 * 다중 선택도 이름을 반복하지 않는다 - `buildQuery` 가 쉼표로 묶는다.
 *
 * ## 손으로 친 파라미터는 그대로 지나간다 (스펙 8.1)
 *
 * 바가 소유하지 않은 이름은 값을 보지 않고 옮겨 싣는다 - `sort` 든
 * `utm_source` 든 정책에 없는 필터든. 스펙 8.1 이 말하는 "막지 않는다" 가
 * 이것이다. 바가 **만드는** 것만 정책 안에 있으면 되고, 정책 밖 파라미터의
 * 판정은 백엔드가 하고 그 오류를 화면이 띄운다.
 *
 * **바가 표현할 수 없는 값은 예외다.** 소유한 이름에 손으로 친 값이 들어 있고
 * 그것을 컨트롤이 그릴 수 없으면(형식이 깨진 날짜, 보기에 없는 enum 값) 바를
 * 제출하는 순간 사라진다. 제출은 "지금 화면에 보이는 조건으로 보여 달라" 는
 * 뜻이므로, 보이지 않는 조건이 몰래 따라가는 편이 더 나쁘다. 사라지기 전에
 * 사용자는 그 값이 만든 오류 배너를 이미 본다.
 *
 * ## 페이지 번호를 버린다
 *
 * 조건이 바뀌면 결과 집합이 달라지므로 옛 위치는 뜻을 잃는다.
 * `page[number]=5` 를 들고 가면 다섯째 쪽이 없는 결과에서 **빈 목록**이 나와
 * 사용자가 "조건에 맞는 자료가 없다" 로 오해한다(빈 목록의 두 갈래를 굳이
 * 나눈 이 화면에서는 특히 나쁘다). 커서는 정렬 서명이 들어 있어 400 이 될
 * 수도 있다. 판정은 `isPagePositionParameter` 가 갖는다 - 근거가 JSON:API 의
 * page 문법이라 자원을 모르는 계층의 것이다.
 *
 * **`page[size]` 와 `sort` 는 남긴다.** 둘은 위치가 아니라 "어떻게 보여줄
 * 것인가" 라, 조건이 바뀌어도 그대로 뜻이 있다.
 *
 * ## 오류를 컨트롤에 붙이지 않는다 (Task 4 의 판단)
 *
 * 조회 오류의 `source` 는 전부 `parameter` 이고(R-8) 각 컨트롤은 자기
 * `parameter` 를 들고 있으니 맞대는 것 자체는 할 수 있다. 하지 않는 이유 셋:
 *
 * 1. **문구가 값을 지목하지 않는다.** 백엔드 카탈로그의 일반 문구라(R-8)
 *    컨트롤 옆에 옮겨 놓아도 배너보다 더 알려주는 것이 없다.
 * 2. **바가 만든 것은 400 이 되지 않는다.** 필드+연산자 조합이 선언 안에서만
 *    나오고 빈 값을 내지 않기 때문이다. 그래서 실제로 오는 `INVALID_FILTER`
 *    는 (a) 손으로 친 URL - **붙일 컨트롤이 없다** - 이거나 (b) 선언이 백엔드와
 *    어긋난 것인데, (b)를 잡는 지정된 수단은 D5 의 계약 거울 테스트다(스펙
 *    10.2). 컨트롤 옆의 빨간 글씨는 둘 중 어느 쪽에도 답이 아니다.
 * 3. **배선이 는다.** `ListView` 의 배너 갈래가 문구 대신 `ErrorObject` 를
 *    계속 들고 다녀야 하고, 화면이 그것을 다시 컨트롤과 맞춰야 한다.
 *
 * **무엇이 바뀌면 뒤집히는가:** 백엔드가 `source.parameter` 와 함께 **값을
 * 지목하는** 문구를 주기 시작하면(예: "0 이상 100 이하여야 합니다"). 그때 붙일
 * 자리는 이 파일이고(`lib/jsonapi/errors.ts` 는 자원을 모른다), 맞댈 값은 각
 * 컨트롤의 `parameter` 로 이미 준비돼 있다.
 */
export function filterQuery(
  fields: readonly FilterField[],
  searchParams: SearchParams,
  form: FilterFormValues,
): URLSearchParams {
  const filters: FilterInput[] = []
  const owned = new Set<string>()

  for (const field of fields) {
    if (field.kind === 'range') {
      for (const [bound, edge] of [
        [field.lower, 'lower'],
        [field.upper, 'upper'],
      ] as const) {
        if (bound === null) continue
        owned.add(bound.parameter)
        const value = formValues(form, bound.parameter)[0]
        if (value === undefined) continue
        filters.push({
          name: field.key,
          operator: bound.operator,
          value: field.shape === 'date' ? fromDateInputValue(value, edge) : value,
        })
      }
      continue
    }

    owned.add(field.parameter)
    const values = formValues(form, field.parameter)

    if (field.operator === 'isNull') {
      // **폼은 문자열을 준다.** `'false'` 를 그대로 넘기면 직렬화의 truthy
      // 검사가 그것을 `true` 로 뒤집어서, "값 있음" 을 고른 사람이 값이
      // **없는** 행을 보게 된다 - 문법상 유효한 값이라 200 이고 배너도 없다.
      // 변환을 여기 한 곳에서만 하고, 어긋남은 `FilterInput` 의 타입이 막는다.
      const chosen = values[0]
      if (chosen !== undefined) {
        filters.push({ name: field.key, operator: 'isNull', value: chosen === 'true' })
      }
      continue
    }

    if (field.kind === 'select' && field.multiple) {
      // 하나도 안 골랐으면 넣지 않는다 - 빈 배열은 buildQuery 가 던진다.
      if (values.length > 0) {
        filters.push({ name: field.key, operator: field.operator, value: values })
      }
      continue
    }

    const value = values[0]
    if (value !== undefined) filters.push({ name: field.key, operator: field.operator, value })
  }

  const query = buildQuery({ filters })

  for (const [name, values] of Object.entries(searchParams)) {
    if (values === undefined) continue
    // 이름이 아니라 **접은 이름**으로 판정한다 - `filter[f]` 와
    // `filter[f][exact]` 는 서로 다른 문자열인데 백엔드는 같은 필터로 읽어서,
    // 이름으로만 보면 그 별칭이 빠져나가 중복 400 이 된다
    // (`canonicalFilterParameter`).
    if (owned.has(canonicalFilterParameter(name))) continue
    if (isPagePositionParameter(name)) continue
    for (const value of valueList(values)) query.append(name, value)
  }

  return query
}

/**
 * (template-typescript-expo) 필터 시트를 열 때의 값 - 지금 URL 이 담은 조건 중 컨트롤이 그릴 수
 * 있는 것. 원본에서는 입력의 `defaultValue` 가 이 일을 했다. 그대로 `filterQuery` 에 넘기면 URL
 * 의 조건이 다시 나온다(시험이 고정한다).
 */
export function filterFormValues(fields: readonly FilterField[]): FilterFormValues {
  const values: Record<string, readonly string[]> = {}
  for (const field of fields) {
    if (field.kind === 'select') {
      values[field.parameter] = field.selected
    } else if (field.kind === 'text') {
      values[field.parameter] = field.value === '' ? [] : [field.value]
    } else {
      for (const bound of [field.lower, field.upper]) {
        if (bound !== null) values[bound.parameter] = bound.value === '' ? [] : [bound.value]
      }
    }
  }
  return values
}

/**
 * (template-typescript-expo) 필터 시트의 "적용" 이 갈 주소 - 이 화면의 주소에 `filterQuery` 를
 * 붙인다. 원본에서는 `filter-bar.tsx` 가 같은 조립을 했다. 이 앱에는 컴포넌트 시험이 없어서
 * (스펙 11.1) 조립을 여기 둔다.
 *
 * 주소의 인코딩은 `hrefWithQuery` 의 것이다 - 키와 값을 퍼센트 인코딩한다(`filter%5B...`).
 * Expo Router 57 은 그 모양의 딥링크에서 대괄호 키를 평평한 키로 되살린다(D1 실측 M2). 앱 안의
 * 이동도 같은 해석을 지난다 - 왕복은 test/unit/resources/view-expo.test.ts 가 라우터의 해석 순서
 * 그대로 잰다.
 */
export function filterHref(
  path: string,
  fields: readonly FilterField[],
  searchParams: SearchParams,
  form: FilterFormValues,
): string {
  return hrefWithQuery(path, filterQuery(fields, searchParams, form))
}

/* ------------------------------------------------------------------------- *
 * 정렬 메뉴와 필터 지우기 (D3 Task 5)
 * ------------------------------------------------------------------------- */

/**
 * 쿼리를 화면 주소에 붙인다. 빈 쿼리는 **`?` 를 남기지 않는다** - `/examples?`
 * 는 `/examples` 와 다른 문자열이라 같은 조건이 두 주소가 되고, 공유했을 때도
 * 지저분하다.
 *
 * `URLSearchParams.toString()` 이 `[`·`]` 를 퍼센트 인코딩하는데(`filter%5B...`)
 * 그대로 둔다 - `filter-bar.tsx` 의 제출 경로가 이미 같은 문자열을 만든다.
 * 두 경로가 다른 인코딩을 쓰면 같은 조건이 서로 다른 주소가 되어 히스토리와
 * 캐시가 갈린다.
 */
function hrefWithQuery(path: string, query: URLSearchParams): string {
  const text = query.toString()
  return text === '' ? path : `${path}?${text}`
}

/** `searchParams` 한 칸의 값들. 배열도 홑값도 같은 모양으로 편다. */
function valueList(values: string | string[]): readonly string[] {
  return Array.isArray(values) ? values : [values]
}

/**
 * 지금 URL 에서 **이 화면이 유지해야 할 파라미터**만 옮겨 담는다.
 *
 * `drop` 이 참인 이름은 호출부가 새로 쓸 것이거나 뜻을 잃은 것이다. 둘(정렬
 * 이동 · 필터 지우기)이 전부 이 모양이라 한 함수로 묶었다 - 두 벌로 두면
 * "남의 파라미터를 그대로 옮긴다"(스펙 8.1)를 한 곳에서만 고쳐도 나머지가
 * 조용히 옛 규칙으로 남는다. (template-typescript-expo) 원본에는 페이지 이동이 셋째였다 -
 * offset 쪽 이동을 뺐다.
 */
function carriedParams(
  searchParams: SearchParams,
  drop: (name: string) => boolean,
): URLSearchParams {
  const query = new URLSearchParams()
  for (const [name, values] of Object.entries(searchParams)) {
    if (values === undefined) continue
    if (drop(name)) continue
    for (const value of valueList(values)) query.append(name, value)
  }
  return query
}

/**
 * 정렬 항목 하나 - **메뉴가 이것만 받으면 그린다.**
 *
 * 방향을 `boolean` 이 아니라 `'asc' | 'desc' | null` 로 낸 이유가 둘이다.
 * 하나는 **"지금 이 키로 정렬 중인가" 와 "어느 방향인가" 가 한 값에 들어가서**
 * 컴포넌트가 두 필드를 맞춰 보지 않아도 되는 것이고, 다른 하나는
 * `SortTerm.descending` 의 함정(`lib/jsonapi/query.ts`)이 화면 쪽으로 새어
 * 나가지 않는 것이다 - `'false'` 같은 문자열이 truthy 로 읽힐 자리가 없다.
 *
 * `href` 는 **누르면 갈 곳**이다. 지금 활성인 항목이면 방향이 뒤집힌 주소이고,
 * 아니면 그 키의 기본 방향으로 가는 주소다.
 */
export interface SortOption {
  readonly key: string
  readonly label: string
  readonly href: string
  /** 지금 이 키로 정렬돼 있으면 그 방향, 아니면 `null`. */
  readonly direction: 'asc' | 'desc' | null
}

/**
 * 지금 걸린 정렬 토큰. URL 에 없거나 비었으면 **선언의 `defaultSort`** 다.
 *
 * ## 왜 `defaultSort` 로 물러서는가
 *
 * URL 에 `sort` 가 없어도 목록은 정렬돼 있다 - 백엔드가 자기 기본 정렬을
 * 쓴다(R-4 의 `-createdAt`). 그때 메뉴가 아무 항목도 활성으로 표시하지 않으면
 * **메뉴가 화면에 대해 거짓을 말한다**: 정렬돼 있는데 정렬이 없다고 보인다.
 * 선언의 `defaultSort` 가 바로 그 백엔드 기본값의 거울이다(example.ts).
 *
 * 거울이 어긋나면 메뉴가 틀린 항목을 활성으로 표시한다. 그 어긋남을 잡는
 * 지정된 수단은 D5 의 계약 거울 테스트다(스펙 10.2) - 응답에 "무엇으로
 * 정렬했는가" 가 없어서 여기서 확인할 방법이 없다.
 *
 * ## 빈 문자열도 `defaultSort` 로 본다
 *
 * `?sort=` 는 **400 이다**(2026-09-07 정본 실측). 즉 그 URL 에서는 표가 아니라
 * 배너가 뜨고, 메뉴는 거기서 빠져나갈 유일한 수단이다. 무엇을 활성으로 그려도
 * 거짓이 아닌 상태라(정렬된 목록 자체가 없다) 기본값으로 물러선다 - 그래야
 * 모든 항목의 `href` 가 정상적인 토큰을 갖는다.
 */
export function currentSortToken(resource: ResourceDefinition, searchParams: SearchParams): string {
  const raw = paramValue(searchParams, SORT_PARAMETER)
  return raw === '' ? resource.defaultSort : raw
}

/**
 * 여러 항으로 된 정렬에서 **첫 항**. 그것이 백엔드가 먼저 정렬하는 축이다.
 *
 * `?sort=-score,title` 은 유효하고(200, 실측) 손으로 칠 수 있다. 그 URL 에서
 * 메뉴는 "점수 내림차순" 을 활성으로 표시한다 - 목록이 실제로 그렇게 보이므로
 * 거짓이 아니다. 다만 항목을 누르면 나머지 항(`,title`)은 사라진다. 그것이
 * 이 메뉴가 표현할 수 없는 값이기 때문이고, 필터 바가 같은 자리에서 같은
 * 판단을 한다(`filterQuery` 의 "바가 표현할 수 없는 값" 절).
 */
function primarySortTerm(token: string): string {
  return token.split(',')[0] ?? ''
}

/**
 * 이 키를 **처음 누를 때**의 방향. 참이면 내림차순이다.
 *
 * 시각(`datetime`)과 수(`int`)는 큰 쪽이 먼저인 것이 사람이 기대하는 첫
 * 정렬이다 - "최근 것부터", "점수 높은 것부터". 이름·상태는 사전순이 기대값
 * 이다. 선언에 없는 키(`queryOnlyFields`)는 무엇인지 알 수 없으므로 오름차순
 * 으로 둔다.
 *
 * **분기의 근거가 `kind` 라는 점이 중요하다** - 자원 이름이 아니라 구조다
 * (`components/resource/AGENTS.md` 의 허용 목록과 같은 종류). 이 함수가
 * 컴포넌트가 아니라 여기 있는 이유는 그것이 판단이기 때문이다.
 */
function firstClickDescending(attribute: AttributeDefinition | undefined): boolean {
  if (attribute === undefined) return false
  return attribute.kind === 'datetime' || attribute.kind === 'int'
}

/**
 * 이 토큰으로 정렬하는 이 화면의 주소가 될 쿼리.
 *
 * ## 옛 `sort` 를 **버리고** 다시 쓴다
 *
 * 남겨 두고 더하면 `sort` 가 두 번 나가는데 **그것이 400 이다**(R-4, 실측).
 * 그리고 다중 정렬은 파라미터를 반복하는 것이 아니라 하나에 쉼표로 묶는
 * 문법이다 - `buildQuery` 가 그 규칙을 갖는다.
 *
 * ## 위치 파라미터를 **반드시** 버린다 - 커서는 특히
 *
 * 정렬이 바뀌면 결과 집합의 순서가 통째로 달라지므로 `page[number]=5` 는 뜻을
 * 잃는다. 커서는 그 정도가 아니라 **400 이다** - `page[after]` 의 base64url
 * 안에 정렬 서명이 들어 있어서 정렬이 바뀐 커서는 백엔드가 거절한다(R-7).
 * 즉 이 한 줄이 없으면 정렬을 바꾸는 순간 목록이 오류가 된다. 판정은
 * `isPagePositionParameter` 가 갖는다(필터 바가 쓰는 것과 같은 함수).
 *
 * **`page[size]` 는 남긴다.** 위치가 아니라 "한 쪽에 몇 개" 라, 정렬이 바뀌어도
 * 그대로 뜻이 있다 - `filterQuery` 와 같은 판단이다.
 *
 * ## 빈 `sort` 를 만들 수 없다
 *
 * 토큰은 언제나 선언의 `sorts` 에 있는 키로 만들어진다(`sortOptions`). 그래서
 * `sort=` 가 나가는 갈래가 **구조적으로 없다** - 정렬을 "끄는" 컨트롤을 두지
 * 않았고(활성 항목을 다시 누르면 방향이 뒤집힌다), 빈 값은 400 이다(실측).
 */
function sortQuery(searchParams: SearchParams, token: string): URLSearchParams {
  const query = carriedParams(
    searchParams,
    (name) => name === SORT_PARAMETER || isPagePositionParameter(name),
  )
  query.set(SORT_PARAMETER, token)
  return query
}

/**
 * 자원 선언 + 지금 URL → **정렬 메뉴가 그릴 항목 전부.**
 *
 * 순서는 선언의 `sorts` 순서 그대로다. 이름은 `fieldLabel` 이 정해서 필터
 * 바와 같은 말을 쓴다.
 *
 * ## 다중 정렬 UI 를 만들지 않았다
 *
 * 백엔드는 지원한다(`sort=-score,title` 이 200 - 실측). 만들지 않은 이유 셋:
 *
 * 1. **필요를 아직 아무도 말하지 않았다**(YAGNI, 스펙 1.1). 목록 화면이 묻는
 *    것은 "무엇을 먼저 볼까" 이고, 그 질문의 답은 축 하나다.
 * 2. **비용이 컨트롤 하나가 아니다.** 순서 있는 목록에 더하기·빼기·순서 바꾸기가
 *    붙고, 그 UI 가 만들기 쉬운 두 실수를 백엔드가 정확히 400 으로 벌한다 -
 *    같은 키를 두 번 넣는 것과 파라미터를 두 번 내는 것(R-4, 둘 다 실측).
 *    지금의 단일 선택은 **그 두 400 을 구조적으로 만들 수 없다**(항목 하나가
 *    파라미터 하나를 통째로 다시 쓴다).
 * 3. **길이 막히지 않는다.** 손으로 친 `?sort=-score,title` 은 그대로 백엔드로
 *    나가고(스펙 8.1), 메뉴는 그 첫 항을 활성으로 표시한다(`primarySortTerm`).
 *
 * 뒤집힐 조건: 한 축으로 순서가 정해지지 않는 목록(동점이 흔한 자원)이
 * 생기고 사용자가 두 번째 축을 실제로 요구할 때. 그날 고칠 자리는 이 함수와
 * `sort-menu.tsx` 둘이다.
 */
export function sortOptions(
  resource: ResourceDefinition,
  path: string,
  searchParams: SearchParams,
): readonly SortOption[] {
  const current = parseSortToken(primarySortTerm(currentSortToken(resource, searchParams)))

  return resource.sorts.map((key): SortOption => {
    const active = key === current.name
    // 활성이면 뒤집고, 아니면 그 키의 기본 방향으로. **방향이 만들어지는 자리
    // 둘 중 하나**다(다른 하나는 `parseSortToken` 의 `startsWith('-')`). 이 줄의
    // 두 갈래가 전부 진짜 boolean 이라 문자열이 건널 경계가 없다 - 둘의 목록은
    // `SortTerm` 주석이 갖는다.
    const descending = active ? !current.descending : firstClickDescending(resource.attributes[key])

    return {
      key,
      label: fieldLabel(resource, key),
      href: hrefWithQuery(
        path,
        sortQuery(searchParams, formatSortToken({ name: key, descending })),
      ),
      direction: active ? (current.descending ? 'desc' : 'asc') : null,
    }
  })
}

/**
 * 링크가 "있다" 는 뜻인가. **`!= null` 이다(`!== null` 이 아니다)** - 없는 링크를 정본과
 * Rails 는 `null` 로 주고 NestJS 는 키째 지운다(R-10①). 지워진 키는 `undefined` 라, 엄격
 * 비교로 판정하면 NestJS 에서 언제나 "있다" 가 된다.
 *
 * (template-typescript-expo) 무한 스크롤의 `nextPageQuery`(더 읽을 것이 있는가)와 참조 목록의
 * `referenceList`(더 있는가, D4 Task 4 아래) 둘 다 **이 함수 하나로만** 판정한다 - 판정 규칙이
 * 두 자리로 갈라지면 하나만 고치는 사고가 난다. 원본의 쪽 이동(`pageHref`·`paginationView`)은
 * offset 목록의 것이라 뺐다(스펙 8.3: 목록은 커서다).
 */
function linkPresent(link: string | null | undefined): link is string {
  return link != null
}

/**
 * "필터 지우기" 가 갈 주소.
 *
 * ## **`sort` 를 남긴다** (Task 5 의 결정 - Task 4 의 동작을 뒤집었다)
 *
 * Task 4 까지는 두 "필터 지우기"(바의 버튼 · 빈 표의 링크)가 쿼리 없는
 * `LIST_PATH` 로 갔고, 그래서 **정렬도 함께 지웠다.** 정렬 UI 가 없던 동안에는
 * 보이지 않던 결정인데 이제 보인다. 남기기로 한 이유 둘:
 *
 * 1. **컨트롤의 이름이 "필터 지우기" 다.** 이름이 말한 것보다 많이 지우는
 *    컨트롤은 거짓말을 한다. 정렬을 되돌리고 싶은 사람에게는 정렬 메뉴가 있다.
 * 2. **같은 화면의 두 길이 갈라지면 안 된다.** 모든 필터를 비우고 "적용" 을
 *    누르면 `filterQuery` 가 `sort` 를 남긴다 - 그것은 "조건이 바뀌어도 어떻게
 *    보여줄 것인가는 그대로" 라는 판단이고(그 함수의 마지막 절), 필터를
 *    지우는 것도 조건을 바꾸는 일이다. 두 길이 같은 곳에 닿아야 한다.
 *
 * ## 바가 그릴 수 없는 필터까지 **전부** 지운다
 *
 * `filterQuery` 는 바가 소유한 이름만 다시 쓰고 나머지는 옮긴다(스펙 8.1).
 * 여기서는 반대로 `filter[...]` 를 **문법으로** 전부 버린다
 * (`isFilterParameter`). 남기면 사용자가 지우기를 눌러도 조건이 남는데, 그
 * 필터를 없앨 컨트롤이 화면에 하나도 없다 - 바가 그리지 못하는 필터이기 때문에
 * 이 자리에 온 것이다. "지우기" 가 지우지 못하면 그 URL 에서 빠져나갈 길이
 * 사라진다.
 *
 * 위치 파라미터도 버린다 - 조건이 바뀌면 옛 위치는 뜻을 잃는다(`filterQuery`
 * 의 같은 절). `page[size]` 와 정렬, 그리고 손으로 친 남의 파라미터는 남는다.
 */
export function clearFiltersHref(path: string, searchParams: SearchParams): string {
  return hrefWithQuery(
    path,
    carriedParams(searchParams, (name) => isFilterParameter(name) || isPagePositionParameter(name)),
  )
}

/* ------------------------------------------------------------------------- *
 * 상세 화면 (D3 Task 6)
 * ------------------------------------------------------------------------- */

/**
 * 상세가 보여주는 항목 하나의 **이름표**. 값 없이 선언만으로 정해진다 -
 * 스켈레톤(`loading.tsx`)이 응답을 받기 전에 이걸 쓴다.
 *
 * `ListColumn` 과 모양이 같지만 따로 둔다. 저쪽은 표의 **열**이고 이쪽은
 * 설명 목록의 **이름**이라, 한 이름을 둘이 나눠 쓰면 목록의 열을 바꾸는 일이
 * 상세를 조용히 바꾼다(실제로 그렇다 - 아래에서 상세는 `listed` 를 따르지
 * 않는다).
 */
export interface DetailLabel {
  key: string
  label: string
}

/**
 * 상세 항목 하나의 종류. **속성은 선언의 `kind` 를 그대로 들고 온다.**
 *
 * `ListCell.kind` 는 `'attribute' | 'relationship'` 둘뿐인데 여기서는 더
 * 잘게 나눈다. 이유가 하나 있다 - **상세는 `text` 를 실제로 그리는 첫
 * 화면이다.** `string` 과 `text` 는 백엔드 타입이 같고 "여러 줄로 그린다" 는
 * 프론트의 표시 결정만 다른데(`define.ts`), 목록은 `text` 속성을 열에서 빼
 * 두었기 때문에(`EXAMPLE.description` 의 `listed: false`) 그 구별을 쓸 일이
 * 없었다. 상세가 전부 그리므로 여기서 처음 필요해진다.
 *
 * **자원 이름이 아니라 구조다** - `components/resource/` 가 이것으로 분기하는
 * 것은 그 디렉터리의 규칙에 걸리지 않는다(`AGENTS.md` 의 허용 목록에
 * `kind` 가 있다).
 */
export type DetailFieldKind = AttributeKind | 'relationship'

/**
 * 값까지 채워진 상세 항목 하나.
 *
 * `values` 가 배열인 것과 "비어 있음" 을 빈 배열로 표현하는 것은 `ListCell`
 * 과 같은 이유다 - 속성이 `null` 인 것과 관계가 빈 것을 한 모양으로 그린다.
 */
export interface DetailField extends DetailLabel {
  kind: DetailFieldKind
  values: readonly string[]
}

/**
 * 상세 화면이 그릴 것. 세 갈래다.
 *
 * `'notFound'` 를 **값으로** 돌려주고 `notFound()` 를 여기서 부르지 않는다 -
 * `next/navigation` 은 `app/` 의 것이고 이 디렉터리는 라우팅을 모른다
 * (`lib/resources/AGENTS.md`). 판정(이 응답이 404 인가)은 여기 남아 관측되고,
 * 행동(Next 에게 알리는 것)만 화면으로 간다.
 */
export type DetailView =
  | { kind: 'detail'; heading: string; fields: readonly DetailField[] }
  | { kind: 'notFound' }
  // (template-typescript-expo) 배너와 닿지 못함 - 목록과 같은 두 실패다(`ListFailure`).
  | ListFailure

/**
 * 상세 요청 하나. **`ListRequest` 와 달리 `query` 를 따로 들지 않는다** -
 * 저쪽이 쿼리를 밖으로 내는 것은 `listView` 가 `filtered` 를 그 쿼리로
 * 판정해야 하기 때문인데(그 인터페이스 주석), 상세에는 쿼리로 갈리는 화면
 * 상태가 없다. 아무도 읽지 않을 필드를 두면 "요청에 쓴 것" 과 "판정에 쓴 것"
 * 이 같아야 한다는 저쪽의 계약을 흉내만 낸 모양이 된다.
 */
export interface DetailRequest {
  path: string
  options: RequestOptions
}

/**
 * 선언 순서 그대로의 상세 항목들 - **속성 전부 + 관계 전부.**
 *
 * 값을 채우는 `detailFields` 와 이름만 내는 `detailLabels` 가 둘 다 이 함수를
 * 지나간다. 스켈레톤과 실제 화면의 항목 수·순서가 갈라질 수 없다.
 */
type DetailEntry =
  | { key: string; label: string; attribute: AttributeDefinition }
  | { key: string; label: string; relationship: RelationshipDefinition }

function detailEntries(resource: ResourceDefinition): readonly DetailEntry[] {
  return [
    ...Object.entries(resource.attributes).map(([key, attribute]) => ({
      key,
      label: attribute.label,
      attribute,
    })),
    ...Object.entries(resource.relationships).map(([key, relationship]) => ({
      key,
      label: relationship.label,
      relationship,
    })),
  ]
}

/**
 * 상세가 보여줄 항목들의 이름 - **선언만으로 정해진다.**
 *
 * `listColumns` 와 같은 자리(응답 없이 부를 수 있는 것)이고, `loading.tsx` 가
 * 스켈레톤 줄 수를 여기서 가져간다. 상수로 박으면 선언에 속성을 더하는 날
 * 스켈레톤과 실제 화면의 길이가 갈라진다.
 */
export function detailLabels(resource: ResourceDefinition): readonly DetailLabel[] {
  return detailEntries(resource).map(({ key, label }) => ({ key, label }))
}

/**
 * 자원 하나를 상세 항목들로.
 *
 * ## `listed` 를 따르지 않는다 - **속성을 전부 보여준다** (Task 6 의 판단)
 *
 * `listed` 는 **목록의 열**을 말하는 표시이지 "보여줄 가치가 있는가" 가
 * 아니다. 그렇게 읽어야 하는 근거가 선언 안에 이미 셋 있다:
 *
 * 1. `AttributeBase.listed` 의 주석: *"`false` 로 둔 속성도 상세 화면·폼에서는
 *    그대로 쓰인다 - 이 표시가 말하는 것은 목록의 열뿐이다."*
 * 2. `EXAMPLE.description` 이 `listed: false` 인 이유: *"여러 줄 본문이라 표의
 *    한 칸에 담기지 않는다. **상세 화면(Task 6)과 폼(D4)이 그린다.**"*
 * 3. `EXAMPLE.updatedAt` 이 `listed: false` 인 이유: *"'언제 고쳤나' 는 **상세
 *    화면의 질문**이다."*
 *
 * 즉 두 속성은 **상세가 그린다는 것을 전제로** 목록에서 빠졌다. 상세까지
 * `listed` 를 따르면 그 두 주석이 거짓이 되고, 이 앱에서 `description` 과
 * `updatedAt` 을 볼 수 있는 화면이 하나도 없어진다.
 *
 * **`listed` 가 상세에 전혀 안 쓰이는 것은 아니다** - 제목(`detailView` 의
 * `heading`)은 `displayAttribute` 를 지나가고 그 함수가 `listed` 로 대표 속성을
 * 고른다. "이 자원을 한 줄로 대표하는 값" 이라는 질문의 답은 목록의 첫 열과
 * 상세의 제목이 같아야 하기 때문이다 - 행을 눌러 들어온 사람이 같은 글자를
 * 본다.
 *
 * ## 관계에는 링크를 걸지 않는다 (Task 6 의 판단)
 *
 * 브리핑은 `resourceByType(type).path` 로 상세 링크를 만들라고 하면서 동시에
 * *"이 앱에 분류 상세 화면이 있는지부터 판단해라 - 없으면 링크를 걸지 마라"*
 * 라고 적는다. **없다.** 이 앱의 라우트는 `/`·`/login`·`/register`·
 * `/examples`·`/examples/[id]` 가 전부이고, `exampleCategories`·`exampleTags`
 * 를 그리는 화면은 하나도 없다(둘은 쓰기 라우트조차 없는 참조 자원이다, R-5).
 *
 * 그리고 선언의 `path` 는 **백엔드 API 경로**다(`/api/v1/categories`). 그것을
 * `href` 로 쓰면 사용자를 이 앱 밖의 JSON 응답으로 보낸다. 화면 경로는 `app/`
 * 이 소유하므로(`app/(app)/examples/paths.ts`), 링크를 걸려면 먼저 그 화면과
 * 그 경로 상수가 있어야 한다 - 없는 화면을 위해 type→경로 표를 지금 만드는
 * 것은 YAGNI(스펙 1.1)다.
 *
 * **뒤집힐 조건:** 분류·라벨의 화면이 생기는 날(D4 의 관계 선택기가 그 후보다).
 * 그때 `resourceByType` 의 `undefined` 갈래가 "링크 없이 이름만" 으로 물러서야
 * 하고(`lib/resources/AGENTS.md`), **그 순간 `isResourceObject` 의 거짓 음성이
 * 처음으로 관측 가능해진다** - 그 술어의 주석이 그 조건을 갖는다.
 */
export function detailFields(
  resource: ResourceDefinition,
  object: ResourceObject,
  included: readonly ResourceObject[] | undefined,
): readonly DetailField[] {
  const index = indexResources(included)

  return detailEntries(resource).map((entry): DetailField => {
    if ('attribute' in entry) {
      const text = formatAttributeValue(entry.attribute, object.attributes?.[entry.key])
      return {
        key: entry.key,
        label: entry.label,
        kind: entry.attribute.kind,
        values: text === '' ? [] : [text],
      }
    }

    return {
      key: entry.key,
      label: entry.label,
      kind: 'relationship',
      values: relationshipValues(entry.relationship, object.relationships?.[entry.key], index),
    }
  })
}

/**
 * 단건 요청 하나를 통째로 조립한다. **화면이 부르는 것은 이 함수 하나다**
 * (`listRequest` 와 같은 이유 - 그 주석의 "왜 조각조각 부르지 않는가").
 *
 * ## 쿼리는 **`include` 하나뿐이다** (R-8 실측)
 *
 * 단건 URL 은 `include` 말고 **어떤 쿼리 파라미터도 받지 않는다.**
 * `?page[size]=2` 조차 `400 INVALID_PAGE` 다. 그래서 이 함수는 `searchParams`
 * 를 인자로 받지 않는다 - 받으면 목록처럼 그대로 넘기고 싶어지고, 그러면 남의
 * 파라미터가 붙은 주소로 들어온 사람마다 상세가 배너로 바뀐다. 목록의
 * `listQuery` 가 URL 의 쿼리를 옮기는 것과 **정반대**이고, 그 차이가 이
 * 계약에서는 옳다.
 *
 * `buildQuery` 를 쓰는 것도 같은 판단이다 - 빈 입력에서 시작해 `include` 만
 * 얹으므로, 다른 파라미터가 섞일 자리 자체가 없다.
 *
 * ## `include` 를 **반드시** 싣는다 (R-10②)
 *
 * `listQuery` 와 같은 이유이고 **증상도 같다** - 그 함수의 표를 봐라. 정본에서
 * 빼면 분류·태그 배지가 이름 대신 **UUID** 가 되고(이름은 `included` 에만
 * 있다), NestJS 에서 빼면 linkage 자체가 없어 조용히 **"없음"** 이 된다.
 * 층 구분도 같다(`listQuery` 의 그 표) - **이 함수가 `include` 를 얹는 줄은
 * 단위가 잡고**(아래 `detailRequest` 절이 나가는 쿼리를 고정한다), **화면이
 * 그 쿼리를 실제로 태워 보내는가**는 E2E 가 잡는다(뮤턴트 M8 - `page.tsx` 가
 * `plan.options` 대신 `{}` 를 넘기면 단위 667 은 통과하고 E2E 가 죽는다).
 *
 * ## id 를 이스케이프한다 - 그리고 그 대가를 실측했다
 *
 * `id` 는 URL 세그먼트에서 오는 **사용자 입력**이다. 그대로 이어 붙였을 때
 * `/` 나 `?` 가 섞여 있으면 백엔드 경로가 통째로 달라지거나 쿼리가 주입된다.
 * UUID 만 온다는 전제에 기대지 않는다 - **잘못된 형식의 id 도 정상적으로
 * 404 를 받는 입력이다**(R-8).
 *
 * **실측(2026-09-07, Next 16.3.4 `pnpm dev`):** 이 버전의 `params.id` 는
 * **이미 퍼센트 인코딩된 세그먼트 그대로** 온다 - `/examples/프로브` 로
 * 들어오면 `params.id` 가 `%ED%94%84...` 다(백엔드 접근 로그에 `%25ED%2594...`
 * 로 찍혀서 확인했다: 인코딩이 두 번 일어났고 한 번은 이 줄이다). 즉 이
 * 호출은 UUID 가 아닌 id 에서 **한 번 더 인코딩한다.**
 *
 * 그래도 남긴다. 값이 UUID 인 한(R-2) 인코딩할 글자가 없어 차이가 0 이고,
 * **백엔드에 닿는 비UUID id 는 전부 404 다** - 이중 인코딩이 404 를 다른 것으로
 * 바꾸는 입력을 리뷰 라운드 1 이 찾지 못했다(`%23`·`%00`·400자 id·15 000자
 * 세그먼트까지 전부 404). 잃는 것이 없다. 반대로 이 줄을 빼면 안전성이
 * **문서화되지 않은 Next 의 동작**에 걸린다. 그 동작이 바뀌는 날(이 저장소의
 * `AGENTS.md` 가 "이건 네가 아는 Next 가 아니다" 라고 경고하는 종류의 변화다)
 * 경로 주입이 조용히 열린다.
 *
 * **"비UUID 는 어차피 404" 라고 뭉뚱그리지 마라** - Next 가 세그먼트를
 * 디코드하지 못하는 입력(`/examples/%` · `/examples/%C3%28` 같은 깨진 UTF-8)은
 * **이 함수에 닿기도 전에 평문 HTTP 500** 이 된다(백엔드 요청이 나가지 않고
 * `not-found.tsx` 도 `error.tsx` 도 아니다). 정적 라우트(`/login/%`)에서는 404
 * 인 것을 보면, **동적 라우트를 처음 만든 이 태스크가 그 URL 모양을 처음
 * 열었다.** 프레임워크의 URL 디코딩 단계라 이 템플릿이 손댈 자리가 아니다 -
 * 사실로 기록만 한다.
 */
export function detailRequest(resource: ResourceDefinition, id: string): DetailRequest {
  const query = buildQuery({ include: resource.includes })
  return {
    path: resourcePath(resource, id),
    // 읽기는 완전 공개라 accessToken 을 넣지 않는다(R-9). `listRequest` 와 같다.
    // (template-typescript-expo) Accept-Language 는 `platform/api.ts` 가 싣는다(스펙 9.4).
    options: { query },
  }
}

/**
 * 단건 응답 하나에서 화면 상태를 정한다.
 *
 * ## 오류 갈래 셋을 전부 다룬다
 *
 * 1. **`'transport'`** - 백엔드가 응답조차 주지 못했다. 던져서
 *    `app/error.tsx` 로 보낸다(스펙 9.2, `listView` 와 같은 계약).
 * 2. **`'notFound'`** - `RESOURCE_NOT_FOUND`. **없는 id 와 잘못된 형식의 id 가
 *    완전히 같은 문서라**(R-8: `source` 조차 없다) 구별할 것이 없다. 404 하나만
 *    다루면 된다.
 * 3. **나머지** - 배너. 잘못된 `include` 를 보내면 `400 INVALID_INCLUDE` 가
 *    이리로 온다.
 *
 * `destroySession`·`fieldErrors` 도 이론상 `actionForErrors` 의 답이지만 조회
 * 경로에서는 오지 않는다(R-9: 읽기는 완전 공개라 인증 오류가 없다). 둘을 따로
 * 다루지 않고 배너로 흘려보낸다 - 백엔드가 낸 문구가 그대로 보이므로 무슨 일이
 * 일어났는지는 화면에 남는다.
 *
 * **문구 없는 오류 문서 검사가 404 판정 뒤에 있는 것은 뜻을 적은 것이지 오늘
 * 관측되는 차이가 아니다.** 404 는 문구가 필요 없다 - `app/not-found.tsx` 가
 * 자기 문구를 갖기 때문이다(그 파일 주석). 그런데 **순서를 뒤집어도 지금은
 * 결과가 같다**(뮤턴트 M12 로 실측했다): `actionForErrors` 가 `'notFound'` 를
 * 고르려면 어떤 오류의 `code` 가 `RESOURCE_NOT_FOUND` 여야 하고,
 * `groupErrors` 의 `messageOf` 는 `detail ?? title ?? code` 라 그 `code` 가
 * 그대로 문구가 된다 - 즉 **404 인데 문구가 하나도 없는 오류 배열은 만들 수
 * 없다.**
 *
 * 그래도 이 순서를 둔다. 등가성이 **전제 셋**에 기대고, 셋 중 하나라도 깨지는
 * 날 두 순서가 갈리며 뒤집힌 쪽은 404 를 `error.tsx` 로 보내기 때문이다:
 *
 * 1. **`messageOf` 가 `code` 로 물러선다**(`detail ?? title ?? code`). 사용자에게
 *    `RESOURCE_NOT_FOUND` 라는 날문자를 보여주지 않으려는 이유로 충분히 바뀔 수
 *    있는 자리다.
 * 2. **`notFound` 분류가 `code` 문자열에 걸린다**(`errors.ts` 의 `actionForCode`).
 * 3. **`bannerMessages` 가 `groupErrors` 의 세 통을 전부 편다.** 문서 통만
 *    남기도록 좁히면 `source.pointer` 가 붙은 404 에서 빈 배열이 나온다 - 그
 *    함수의 주석이 *"백엔드가 언젠가 `pointer` 를 붙이는 날"* 이라고 스스로
 *    경고하는 바로 그 변화다.
 *
 * 전제가 깨질 때 옳은 쪽에 서 있으려는 것이다.
 *
 * ## 던지는 자리 넷
 *
 * (template-typescript-expo) `'transport'` 는 던지지 않고 `{ kind: 'unreachable' }` 이다 -
 * `listView` 와 같다(`ListFailure`). 404 판정보다 앞선다(`actionForErrors` 의 우선순위).
 *
 * `listView` 의 셋(transport · 본문 없는 성공 응답 · 문구 없는 오류 문서)에
 * **`data: null`** 이 하나 더 붙는다. 단건 GET 에서 "자원이 없다" 를 말하는
 * 방법은 404 뿐이고(R-8), 200 인데 `data` 가 `null` 인 것은 계약 밖이다. 그것을
 * `notFound` 로 접으면 **깨진 백엔드가 "없는 자원" 으로 위장한다** - 컬렉션의
 * 204 를 빈 목록으로 다루지 않는 것과 같은 판단이다.
 *
 * `document` 를 `status` 가 아니라 `document !== null` 로 좁히는 이유는
 * `listView` 와 같다(`lib/jsonapi/client.ts` 의 실측).
 *
 * ## 요청 계획을 받지 않는다
 *
 * `listView` 는 `ListRequest` 를 받는다 - `filtered` 를 **실제로 나간 쿼리**로
 * 판정해야 뜻이 있기 때문이다. 상세에는 쿼리로 갈리는 상태가 없으므로 받을
 * 이유가 없고, 안 쓰는 인자를 받으면 "요청과 판정이 같은 쿼리를 본다" 는 저쪽의
 * 계약을 흉내만 낸 것이 된다.
 */
export function detailView(
  resource: ResourceDefinition,
  result: JsonApiResult<SingleDocument>,
): DetailView {
  if (!result.ok) {
    if (actionForErrors(result.errors) === 'notFound') return { kind: 'notFound' }
    return failureOf('상세', result.errors)
  }

  if (result.document === null) {
    throw new Error(`상세 요청이 본문 없는 응답을 받았다: ${result.status}`)
  }

  const data = result.document.data
  if (data === null) {
    throw new Error(`상세 요청이 자원 없는 성공 응답을 받았다: ${result.status}`)
  }

  return {
    kind: 'detail',
    heading: displayText(resource, data),
    fields: detailFields(resource, data, result.document.included),
  }
}

/* ------------------------------------------------------------------------- *
 * 참조 자원 - 관계 선택기(D4 Task 4, `components/resource/relationship-picker.tsx`)가
 * 그릴 목록. 계획서 W-11 을 손으로 옮긴 것이다.
 * ------------------------------------------------------------------------- */

/** 선택기의 보기 하나. */
export interface ReferenceOption {
  readonly id: string
  readonly label: string
}

/** 참조 목록 응답 하나에서 선택기가 그릴 것 전부. */
export interface ReferenceList {
  readonly options: readonly ReferenceOption[]
  /** 백엔드가 더 있다고 말하는가. `links.next != null` 이다. */
  readonly truncated: boolean
}

/**
 * 참조 목록 요청의 쪽 크기 상한 - **실측 상한이지 임의의 숫자가 아니다**(W-11).
 *
 * 정본이 실제로 받아들이는 최댓값이다. **101 이상을 보내면 오류가 아니라
 * 조용히 100 으로 깎인다**(실측, `page[size]=0` 은 반대로 `400 INVALID_PAGE`).
 * 깎이면 응답의 `links.next` 가 채워져 `truncated` 가 참이 되고 화면이 "더
 * 있다" 고 말하는데, 실은 **우리가 요청을 잘못 보낸 것**이다 - 이 상수를 100
 * 보다 크게 두면 그 거짓 경고가 상시로 뜬다.
 */
export const REFERENCE_PAGE_SIZE = 100

/** `referenceRequest` 가 만드는 것 - `listRequest`·`detailRequest` 와 같은 모양. */
export interface ReferenceRequest {
  readonly path: string
  readonly query: URLSearchParams
  readonly options: RequestOptions
}

/**
 * 관계 선택기가 부를 요청 하나를 조립한다.
 *
 * ## 왜 `listRequest` 를 그대로 못 쓰는가
 *
 * `listRequest` 는 **화면의 목록**을 위한 것이라 정렬·필터를 URL 이 정한다(쪽은
 * 커서로 따라간다 - 스펙 8.3). 이 함수는 **폼 안의 선택기**를 위한 것이라 그런 조회 상태가 아예
 * 없다 - "지금 존재하는 것 중에서 고른다" 뿐이므로 쪽 크기와 정렬을 고정하고
 * `searchParams` 를 받지 않는다.
 *
 * ## `sort=name` 을 명시한다 - 기본값에 기대지 않는다
 *
 * 정본의 기본 정렬이 이미 `name` 오름차순이다(W-11 실측). 그래도 명시하는
 * 이유는 **기본값에 기대는 코드는 백엔드가 기본을 바꾸는 날 조용히
 * 어긋나기 때문이다** - 명시가 거울이다. 이 값이 백엔드 기본과 달라지는
 * 날(오늘은 같다) 선택기 순서가 그 즉시 눈에 보이게 달라져야지, 아무 표시도
 * 없이 조용히 바뀌면 안 된다.
 *
 * `'name'` 을 리터럴로 박은 것은 `target.sorts`·`target.defaultSort` 에서
 * 가져오지 않았다는 뜻이다 - "참조 자원은 이름 오름차순" 이 오늘 등록된
 * 둘(`exampleCategories`·`exampleTags`)에서는 참이지만, 그것은 **그 두
 * 자원의 우연**이지 참조 자원 일반의 계약이 아니다. 다른 정렬을 쓰는 참조
 * 자원이 생기는 날 이 함수를 `target.defaultSort` 를 읽게 고쳐야 한다(그
 * 전까지는 이 값이 실제 대상의 정렬 선언과 달라도 이 함수 자신은 눈치채지
 * 못한다 - `referenceRequest` 단위 테스트가 `defaultSort` 가 다른 대상으로
 * 이 자리를 잰다).
 *
 * ## `page[size]` 만 있고 `page[number]` 는 없다
 *
 * 선택기는 "첫 쪽" 만 본다 - 쪽 이동 UI 가 없다(W-11 의 귀결: 넘치면 잘림을
 * 알릴 뿐 다음 쪽으로 가는 길을 만들지 않는다). `page[number]` 를 생략하면
 * 백엔드가 1 로 채운다(원본 `pageNumberOf` 주석의 같은 실측 - 이 앱은 그 함수를 뺐다).
 *
 * ## `accessToken` 이 없다 - 공개 읽기다(W-11)
 *
 * 참조 자원 조회는 인증이 필요 없다 - `listRequest`·`detailRequest` 와 같은
 * 이유(R-9)로 넣지 않는다.
 */
export function referenceRequest(target: ResourceDefinition): ReferenceRequest {
  const query = buildQuery({
    sort: [{ name: 'name', descending: false }],
    page: { size: REFERENCE_PAGE_SIZE },
  })
  return {
    path: target.path,
    query,
    // 읽기는 완전 공개라 accessToken 을 넣지 않는다(R-9, W-11).
    // (template-typescript-expo) Accept-Language 는 `platform/api.ts` 가 싣는다(스펙 9.4).
    options: { query },
  }
}

/**
 * 참조 목록 응답 하나 → 선택기가 그릴 값.
 *
 * ## `document` 가 `unknown` 이다 - `JsonApiResult` 로 감싸지 않는다
 *
 * 브리핑의 계약이다. `listView`·`detailView` 와 달리 오류에서 **던지지
 * 않는다** - 참조 목록 하나가 실패하거나 모양이 이상하다고 폼 전체가
 * 죽어서는 안 된다(다른 속성·다른 관계는 여전히 쓸 수 있어야 한다). 그래서
 * 알아볼 수 없는 값은 "고를 것이 없다" 로 조용히 물러선다 - `options: []`,
 * `truncated: false`. 이 자리를 던지게 바꾸면 참조 자원 하나의 결함이 쓰기
 * 화면 전체를 `app/error.tsx` 로 보낸다.
 *
 * ## 잘림 판정은 `nextPageQuery` 와 같은 함수를 공유한다(R-10①)
 *
 * 없는 `next` 를 정본·Rails 는 `null` 로 주고 NestJS 는 키째 지운다 - 위
 * `linkPresent` 주석과 같은 자리다. 판정 규칙이 두 자리로 갈라지면 하나만
 * 고치는 사고가 나므로 새로 만들지 않고 그 함수를 그대로 불렀다.
 *
 * ## 보기 라벨은 `displayText` 와 같은 함수를 공유한다
 *
 * 목록의 관계 칸(`relatedText`)·상세의 제목(`displayText` 자신)이 이미 "이
 * 자원을 한 줄로 뭐라고 부를까" 를 `displayAttribute`(listed 인 첫 속성)로
 * 정해 뒀다. 여기서 `'name'` 을 다시 박으면 세 자리가 서로 다른 규칙으로
 * 갈릴 수 있다 - 관계 배지에는 보이는 이름이 선택기 보기에는 안 보이는
 * 사고가 그렇게 난다.
 */
export function referenceList(target: ResourceDefinition, document: unknown): ReferenceList {
  if (!isCollectionDocument(document)) return { options: [], truncated: false }

  return {
    options: document.data.map((object) => ({
      id: object.id,
      label: displayText(target, object),
    })),
    truncated: linkPresent(document.links?.next),
  }
}
