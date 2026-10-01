import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { NotFoundView } from '@/components/app/not-found-view'
import { Skeleton } from '@/components/ui/skeleton'
import { formAttributes, type ResourceDefinition } from '@/lib/resources/define'
import { initialFormValues, type ResourceFormValues } from '@/lib/resources/form'
import type { ResourceDetailState } from '@/queries/resources'

import { DetailFailure } from './resource-detail'

/** 폼을 그리기 전의 자리 - 글자 없이 항목 모양만(스펙 8.7). 줄 수는 선언이 정한다. */
export function FormSkeleton({ resource }: { resource: ResourceDefinition }) {
  const rows = formAttributes(resource).length + Object.keys(resource.relationships).length
  return (
    <View testID="form-skeleton" className="gap-5 p-6">
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} className="gap-1.5">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
        </View>
      ))}
    </View>
  )
}

/**
 * 수정 폼의 자리 - 고칠 자원의 상세를 받아 폼의 첫 값을 만든다(`initialFormValues`, 상세 화면과
 * 같은 응답). 받기 전에는 스켈레톤이고, 상세를 그리지 못하는 셋 - 없는 id(not-found, 스펙 9.2)·닿지 못함(앱 문구와
 * "다시 시도")·백엔드의 거절(그 문구, 첫 조회가 판정하지 않은 응답이면 "다시 시도" 도) - 은 상세 화면과 같은 한 곳이
 * 그린다(`DetailFailure`). 저장이 "그 자원이 없다" 를 받았으면(`gone`) not-found 다.
 *
 * 첫 값은 **처음 받은 상세 하나로 고정한다.** 상세는 상세 화면과 같은 캐시라 앱 복귀·무효화로 다시
 * 불릴 수 있는데, 그 결과로 폼을 다시 만들면 고치던 입력이 사라진다. 고정한 뒤의 재조회가 닿지 못해도 폼은
 * 그대로다(재조회의 실패는 폼을 그리는 동안 보이지 않는다 - 저장이 닿지 못하면 폼 배너가 알린다).
 */
export function ResourceEditGate({
  resource,
  detail,
  gone,
  children,
}: {
  resource: ResourceDefinition
  detail: ResourceDetailState
  gone: boolean
  children: (initialValues: ResourceFormValues) => ReactNode
}) {
  const [fixed, setFixed] = useState<ResourceFormValues | null>(null)
  const { screen, result } = detail
  const current =
    fixed ??
    (screen.kind === 'detail' && result !== null ? initialFormValues(resource, result) : null)
  // 렌더 중의 조건부 상태 갱신 - React 가 권하는 "이전 렌더의 정보를 저장하기" 모양이다.
  if (fixed === null && current !== null) setFixed(current)

  if (gone) return <NotFoundView />
  if (current !== null) return children(current)

  return screen.kind === 'loading' ? (
    <FormSkeleton resource={resource} />
  ) : (
    <DetailFailure detail={detail} />
  )
}
