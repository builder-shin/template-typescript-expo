import { describe, expect, it } from 'vitest'
import { actionForErrors, groupErrors, placeError } from '@/lib/jsonapi/errors'
import {
  ERROR_AUTHENTICATION_REQUIRED,
  ERROR_INVALID_FILTER,
  ERROR_NOT_FOUND,
  ERROR_VALIDATION,
} from '../../fixtures/documents'

describe('placeError', () => {
  it('/data/attributes/<name> 는 속성 필드 오류다', () => {
    expect(placeError({ source: { pointer: '/data/attributes/title' } })).toEqual({
      kind: 'attribute',
      field: 'title',
    })
  })

  it('/data/relationships/<name> 는 관계 필드 오류다', () => {
    expect(placeError({ source: { pointer: '/data/relationships/category' } })).toEqual({
      kind: 'relationship',
      field: 'category',
    })
  })

  it('source.parameter 는 문서 오류다', () => {
    expect(placeError({ source: { parameter: 'filter[nope]' } })).toEqual({ kind: 'document' })
  })

  it('source.header 는 문서 오류다', () => {
    expect(placeError({ source: { header: 'Authorization' } })).toEqual({ kind: 'document' })
  })

  it('source 가 아예 없으면 문서 오류다', () => {
    expect(placeError({ code: 'RESOURCE_NOT_FOUND' })).toEqual({ kind: 'document' })
  })

  it('/data 나 /data/attributes 처럼 필드 이름이 없으면 문서 오류다', () => {
    expect(placeError({ source: { pointer: '/data' } })).toEqual({ kind: 'document' })
    expect(placeError({ source: { pointer: '/data/attributes' } })).toEqual({ kind: 'document' })
    expect(placeError({ source: { pointer: '/data/attributes/' } })).toEqual({ kind: 'document' })
  })

  it('최상위가 data 가 아니면 attributes/relationships 모양이어도 문서 오류다', () => {
    // JSON:API 오류의 source.pointer 는 요청 문서를 가리키므로 스펙상
    // /data 아래여야 하지만, ErrorObject.source.pointer 는 그냥 string 이라
    // 타입이 이걸 강제하지 않는다. 세 번째·네 번째 세그먼트가 우연히
    // attributes/필드 이름 모양이어도(예: 최상위가 meta 인 경우) 두 번째
    // 세그먼트가 data 가 아니면 그 모양을 무시하고 문서 오류로 떨어져야
    // 폼이 존재하지도 않는 필드에 오류를 붙이지 않는다.
    expect(placeError({ source: { pointer: '/meta/attributes/title' } })).toEqual({
      kind: 'document',
    })
  })

  it('중첩 포인터는 첫 세그먼트를 필드로 본다', () => {
    // 백엔드가 /data/attributes/meta/nested 같은 포인터를 낼 수 있다.
    // 폼은 최상위 필드에만 입력이 있으므로 거기에 붙인다.
    expect(placeError({ source: { pointer: '/data/attributes/meta/nested' } })).toEqual({
      kind: 'attribute',
      field: 'meta',
    })
  })

  it('JSON 포인터의 ~1 과 ~0 을 푼다', () => {
    // RFC 6901: ~1 은 '/', ~0 은 '~'.
    expect(placeError({ source: { pointer: '/data/attributes/a~1b' } })).toEqual({
      kind: 'attribute',
      field: 'a/b',
    })
  })

  it('~1 을 먼저 풀고 ~0 을 나중에 풀어야 한다', () => {
    // RFC 6901 4장: "~1 을 먼저 '/'로, 그 다음 ~0 을 '~'로" 순서가 고정이다.
    // 순서를 뒤집으면 'a~01' 이 '~0'을 먼저 풀어 'a~1'을 만들고, 그 결과를
    // 다시 '~1' 로 오인해 '/'로 풀어버려 'a/'가 된다. 원래 순서로 풀면
    // 'a~01' 에는 '~1' 부분 문자열이 없어(먼저 검사) 'a~0' + '1' 로 남고,
    // 그 다음 '~0'만 '~'로 풀려 'a~1'(문자 그대로의 물결표+1)이 된다.
    expect(placeError({ source: { pointer: '/data/attributes/a~01' } })).toEqual({
      kind: 'attribute',
      field: 'a~1',
    })
  })

  it('attributes·relationships 가 아닌 버킷(예: meta)은 문서 오류다', () => {
    // JSON:API 리소스 객체는 attributes·relationships 외에 meta 도 가질 수
    // 있다. 백엔드가 리소스 meta 를 검증해 /data/meta/<key> 포인터를 낼
    // 가능성을 열어 둬야 하는데, attributes·relationships 두 버킷만 실측
    // 픽스처에 있어서 그 밖의 버킷이 문서 오류로 떨어지는지는 아직 아무
    // 테스트도 구별하지 못했다.
    expect(placeError({ source: { pointer: '/data/meta/nested' } })).toEqual({ kind: 'document' })
  })
})

describe('actionForErrors', () => {
  it('인증 관련 코드는 세션을 파기한다', () => {
    for (const code of [
      'AUTHENTICATION_REQUIRED',
      'INVALID_TOKEN',
      'TOKEN_EXPIRED',
      'TOKEN_REVOKED',
    ]) {
      expect(actionForErrors([{ code }])).toBe('destroySession')
    }
  })

  it('RESOURCE_NOT_FOUND 는 notFound 다', () => {
    expect(actionForErrors(ERROR_NOT_FOUND.errors)).toBe('notFound')
  })

  it('VALIDATION_ERROR 는 필드 오류로 되돌린다', () => {
    expect(actionForErrors(ERROR_VALIDATION.errors)).toBe('fieldErrors')
  })

  it('그 밖의 코드는 배너다', () => {
    expect(actionForErrors(ERROR_INVALID_FILTER.errors)).toBe('banner')
    expect(actionForErrors([{ code: 'INTERNAL_SERVER_ERROR' }])).toBe('banner')
    expect(actionForErrors([{}])).toBe('banner')
  })

  it('빈 배열은 배너다', () => {
    expect(actionForErrors([])).toBe('banner')
  })

  it('여러 오류가 섞이면 세션 파기가 가장 세다', () => {
    // 로그인으로 보내야 하는 상황에서 폼에 필드 오류를 그리면 사용자가
    // 고칠 수 없는 폼을 붙들게 된다.
    const mixed = [{ code: 'VALIDATION_ERROR' }, { code: 'TOKEN_EXPIRED' }]
    expect(actionForErrors(mixed)).toBe('destroySession')
  })

  it('notFound 는 fieldErrors 보다 세다', () => {
    expect(actionForErrors([{ code: 'VALIDATION_ERROR' }, { code: 'RESOURCE_NOT_FOUND' }])).toBe(
      'notFound',
    )
  })
})

describe('actionForErrors — transport(합성 오류, D2 Task 4)', () => {
  // client.ts 가 실제로 합성하는 세 코드. 이 테스트들의 요점은 문자열 자체가
  // 아니라 meta.synthetic 표시로 판정되는지다 - 바로 아래 테스트가 반대쪽
  // (표시 없이 문자열만으로는 안 된다)을 확인한다.
  const SYNTHETIC_CODES = ['NETWORK_ERROR', 'NON_JSONAPI_RESPONSE', 'REQUEST_ASSEMBLY_FAILED']

  it('client.ts 가 합성하는 세 코드는 표시(meta.synthetic)가 있으면 transport 다', () => {
    for (const code of SYNTHETIC_CODES) {
      expect(actionForErrors([{ code, meta: { synthetic: true } }])).toBe('transport')
    }
  })

  it('같은 코드 문자열이어도 표시가 없으면 transport 가 아니다', () => {
    // 판정 수단이 code 문자열이 아니라 meta.synthetic 표시라는 것을 고정한다 -
    // 이 테스트가 없으면 actionForCode 를 코드 문자열 Set 검사로 바꿔도(예:
    // SYNTHETIC_CODES.has(code)) 위 테스트가 여전히 green 이라 두 구현이
    // 구별되지 않는다.
    for (const code of SYNTHETIC_CODES) {
      expect(actionForErrors([{ code }])).toBe('banner')
    }
  })

  it('meta.synthetic 이 true 가 아니면(문자열 등) transport 가 아니다', () => {
    // meta 는 Record<string, unknown> 이라 백엔드가 우연히 이 키를 다른 값으로
    // 채워 보낼 수 있다 - 엄격한 true 비교(=== true)를 truthy 검사로 바꿔도
    // 이 테스트가 아니면 아무것도 깨지지 않는다.
    expect(actionForErrors([{ code: 'NETWORK_ERROR', meta: { synthetic: 'yes' } }])).toBe('banner')
  })

  it('meta 자체가 없어도 던지지 않고 배너로 떨어진다', () => {
    // isSyntheticError 가 error.meta?.synthetic 로 옵셔널 체이닝하지 않으면
    // meta 가 없는 대다수의 실제 오류에서 TypeError 로 던진다 - 이 저장소
    // 전역 계약(분류 함수도 던지지 않아야 한다)을 지킨다.
    expect(() => actionForErrors([{ code: 'SOME_CODE' }])).not.toThrow()
  })

  it('표시가 있으면 code 값과 무관하게 transport 다', () => {
    // isSyntheticError 를 code 매칭보다 먼저 검사하는지 고정한다 - 이론상
    // 합성 오류의 code 가 우연히 RESOURCE_NOT_FOUND 등과 같아도 확실한 표시
    // (합성됐다는 사실)가 추측(code 매칭)보다 이겨야 한다.
    expect(actionForErrors([{ code: 'RESOURCE_NOT_FOUND', meta: { synthetic: true } }])).toBe(
      'transport',
    )
  })

  it('여러 오류가 섞이면 transport 가 세션 파기보다 세다', () => {
    // 실제로 client.ts 는 합성 오류를 항상 단독 배열로 돌려주므로(백엔드
    // 오류와 섞이지 않는다) 이 조합은 오늘 실전에서 나오지 않는다 - 그래도
    // actionForErrors 는 임의의 배열에 정의된 답을 내야 하는 일반 함수이므로
    // ACTION_RANK 의 transport:4 가 실제로 가장 센지 고정해 둔다.
    const mixed = [{ code: 'TOKEN_EXPIRED' }, { code: 'NETWORK_ERROR', meta: { synthetic: true } }]
    expect(actionForErrors(mixed)).toBe('transport')
  })
})

describe('groupErrors', () => {
  it('실측된 세 개짜리 검증 오류를 필드별로 나눈다', () => {
    const grouped = groupErrors(ERROR_VALIDATION.errors)
    expect(Object.keys(grouped.attributes).sort()).toEqual(['score', 'status', 'title'])
    expect(grouped.attributes.title).toEqual(['요청 값이 유효성 검사를 통과하지 못했습니다.'])
    expect(grouped.relationships).toEqual({})
    expect(grouped.document).toEqual([])
  })

  it('같은 필드에 오류가 둘이면 둘 다 담는다', () => {
    const grouped = groupErrors([
      { detail: '너무 짧다', source: { pointer: '/data/attributes/title' } },
      { detail: '금지어가 있다', source: { pointer: '/data/attributes/title' } },
    ])
    expect(grouped.attributes.title).toEqual(['너무 짧다', '금지어가 있다'])
  })

  it('문서 오류는 document 로 간다', () => {
    const grouped = groupErrors(ERROR_AUTHENTICATION_REQUIRED.errors)
    expect(grouped.document).toEqual(['이 요청에는 인증이 필요합니다.'])
    expect(grouped.attributes).toEqual({})
    expect(grouped.relationships).toEqual({})
  })

  it('관계 필드 오류는 attributes 가 아니라 relationships 로 간다', () => {
    // SINGLE_CREATED 픽스처의 category 처럼 관계도 검증 대상이다. attributes
    // 만 캡처한 실측 픽스처(ERROR_VALIDATION)로는 이 분기가 실제로 두 버킷을
    // 가르는지 구별할 수 없어서 별도로 구성한다.
    const grouped = groupErrors([
      { detail: '카테고리가 존재하지 않는다', source: { pointer: '/data/relationships/category' } },
    ])
    expect(grouped.relationships).toEqual({ category: ['카테고리가 존재하지 않는다'] })
    expect(grouped.attributes).toEqual({})
  })

  it('detail 이 없으면 title 을, 그것도 없으면 code 를 쓴다', () => {
    expect(
      groupErrors([{ title: '제목만', source: { pointer: '/data/attributes/a' } }]).attributes.a,
    ).toEqual(['제목만'])
    expect(groupErrors([{ code: 'ONLY_CODE' }]).document).toEqual(['ONLY_CODE'])
  })

  it('아무 문구도 없으면 빈 문자열이 아니라 항목을 만들지 않는다', () => {
    // 빈 배너를 그리면 사용자에게 빈 빨간 상자가 보인다.
    expect(groupErrors([{}]).document).toEqual([])
  })
})
