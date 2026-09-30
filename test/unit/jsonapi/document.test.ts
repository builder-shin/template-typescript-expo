import { describe, expect, it } from 'vitest'
import { isCollectionDocument, isErrorDocument, isSingleDocument } from '@/lib/jsonapi/document'
import {
  AUTH_TOKENS,
  COLLECTION_EMPTY,
  ERROR_NOT_FOUND,
  ERROR_VALIDATION,
  MIXED_ERROR_AND_DATA,
  SINGLE_CREATED,
} from '../../fixtures/documents'

describe('isErrorDocument', () => {
  it('실측된 오류 문서를 오류로 판별한다', () => {
    expect(isErrorDocument(ERROR_VALIDATION)).toBe(true)
    expect(isErrorDocument(ERROR_NOT_FOUND)).toBe(true)
  })

  it('데이터 문서를 오류로 판별하지 않는다', () => {
    expect(isErrorDocument(SINGLE_CREATED)).toBe(false)
    expect(isErrorDocument(COLLECTION_EMPTY)).toBe(false)
  })

  it('errors가 배열이 아니면 오류 문서가 아니다', () => {
    expect(isErrorDocument({ errors: 'boom' })).toBe(false)
    expect(isErrorDocument({ errors: {} })).toBe(false)
  })

  it('errors가 빈 배열이면 오류 문서가 아니다', () => {
    // JSON:API 는 errors 를 비어 있지 않은 배열로 규정한다. 빈 배열을 오류로
    // 받아들이면 "오류인데 무엇이 잘못됐는지 아무도 모르는" 상태가 만들어진다.
    expect(isErrorDocument({ errors: [] })).toBe(false)
  })

  it('null 과 원시값을 견딘다', () => {
    expect(isErrorDocument(null)).toBe(false)
    expect(isErrorDocument(undefined)).toBe(false)
    expect(isErrorDocument('errors')).toBe(false)
    expect(isErrorDocument(42)).toBe(false)
  })

  it('errors 원소가 레코드가 아니면 오류 문서로 판별하지 않는다', () => {
    // 실측(T4→T8 접합부 결함): 이 검사가 없으면 {"errors":[null]}이 이 술어를
    // 통과해 client.ts 가 [null]을 ErrorObject[]로 그대로 돌려주고, 곧바로
    // groupErrors/actionForErrors 가 null.detail·null.code 를 읽다가 TypeError 로
    // 던진다. null 뿐 아니라 문자열·숫자·배열도 ErrorObject 가 아니므로 같이 막는다.
    expect(isErrorDocument({ errors: [null] })).toBe(false)
    expect(isErrorDocument({ errors: ['x'] })).toBe(false)
    expect(isErrorDocument({ errors: [42] })).toBe(false)
    expect(isErrorDocument({ errors: [[]] })).toBe(false)
    expect(isErrorDocument({ errors: [true] })).toBe(false)
  })

  it('원소 하나만 깨져도 문서 전체를 오류 문서로 판별하지 않는다', () => {
    // 부분적으로만 올바른 배열을 통과시키면 호출자가 나머지 원소만 믿고
    // 인덱스를 놓치는 문제가 생길 수 있다 - 하나라도 깨지면 전체를 거절한다.
    expect(isErrorDocument({ errors: [{ code: 'X' }, null] })).toBe(false)
  })

  it('필드가 없는 레코드는 유효한 오류 객체로 받아들인다', () => {
    // ErrorObject 의 모든 필드가 선택이라 {}도 구조적으로는 유효하다(actionForErrors·
    // groupErrors 둘 다 {} 를 이미 안전하게 다룬다 - errors.test.ts 참고). 이 술어가
    // 보장해야 할 것은 "다운스트림이 던지지 않는다"이지 "필드가 채워졌다"가 아니다.
    expect(isErrorDocument({ errors: [{}] })).toBe(true)
  })
})

describe('isCollectionDocument / isSingleDocument', () => {
  it('data 가 배열이면 컬렉션이다', () => {
    expect(isCollectionDocument(COLLECTION_EMPTY)).toBe(true)
    expect(isSingleDocument(COLLECTION_EMPTY)).toBe(false)
  })

  it('data 가 자원 객체면 단일 문서다', () => {
    expect(isSingleDocument(SINGLE_CREATED)).toBe(true)
    expect(isCollectionDocument(SINGLE_CREATED)).toBe(false)
    expect(isSingleDocument(AUTH_TOKENS)).toBe(true)
  })

  it('data.id 가 문자열이 아니면 단일 문서가 아니다', () => {
    // JSON:API 는 id 를 문자열로 규정한다. 숫자로 보내는 백엔드를 만나면
    // 여기서 걸러야 이후 계층이 `${type}:${id}` 색인에서 조용히 어긋나지 않는다.
    expect(isSingleDocument({ data: { type: 'x', id: 123 } })).toBe(false)
  })

  it('data 에 id 가 없으면 단일 문서가 아니다', () => {
    expect(isSingleDocument({ data: { type: 'x' } })).toBe(false)
  })

  it('data 가 null 이어도 단일 문서다', () => {
    // 비어 있는 to-one 관계를 related 로 따라가면 data: null 이 온다.
    expect(isSingleDocument({ data: null, jsonapi: { version: '1.1' } })).toBe(true)
  })

  it('오류 문서는 어느 쪽도 아니다', () => {
    expect(isCollectionDocument(ERROR_VALIDATION)).toBe(false)
    expect(isSingleDocument(ERROR_VALIDATION)).toBe(false)
  })

  it('data 키가 없으면 어느 쪽도 아니다', () => {
    expect(isCollectionDocument({ jsonapi: { version: '1.1' } })).toBe(false)
    expect(isSingleDocument({ jsonapi: { version: '1.1' } })).toBe(false)
  })

  it('data 와 errors 가 함께 있어도(스펙 위반) 오류로 판별하고 컬렉션/단일로 오판하지 않는다', () => {
    // JSON:API 스펙은 data 와 errors 의 공존을 금지하지만, 서버가 이를
    // 어기는 경우에도 오류 판별이 우선해야 한다.
    expect(isErrorDocument(MIXED_ERROR_AND_DATA)).toBe(true)
    expect(isCollectionDocument(MIXED_ERROR_AND_DATA)).toBe(false)
    expect(isSingleDocument(MIXED_ERROR_AND_DATA)).toBe(false)
  })
})
