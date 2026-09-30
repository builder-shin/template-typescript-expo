import { router, Stack, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { FilterSheet } from '@/components/resource/filter-sheet'
import { ResourceListView } from '@/components/resource/resource-list'
import { ListToolbar, SortSheet } from '@/components/resource/sort-sheet'
import { EXAMPLE } from '@/lib/resources'
import { listRouteParams } from '@/lib/resources/route-params'
import { clearFiltersHref, filterFields, filterHref, sortOptions } from '@/lib/resources/view'
import { useResourceList } from '@/queries/resources'

/**
 * Example 목록 - 스펙 8.1·8.2·8.3. 라우트 파라미터가 곧 쿼리다: 딥링크 하나로 같은 목록이
 * 재현되고, 조건을 바꾸면 새 목록 화면을 쌓아 뒤로 가기가 이전 조건을 되살린다(`router.push`).
 *
 * 이 파일에는 훅 호출과 JSX 만 있다(스펙 8.4) - 쿼리 조립·행 변환·오류 갈래는
 * lib/resources/view.ts, 요청과 캐시는 queries/resources.ts 가 한다.
 */

/** 이 화면의 주소. 필터·정렬을 바꾼 주소는 이 경로에 쿼리를 붙인 것이다. */
const LIST_PATH = '/examples' satisfies Href

export default function ExamplesScreen() {
  // 목록이 읽는 JSON:API 파라미터만 남긴다 - 이동이 싣는 값(로그인 뒤 복귀의 initial 등)이 섞여 온다.
  const params = listRouteParams(useLocalSearchParams())
  const list = useResourceList(EXAMPLE, params)
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null)
  const fields = filterFields(EXAMPLE, params)
  const options = sortOptions(EXAMPLE, LIST_PATH, params)
  // lib 가 만든 앱 안 주소다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은 변수에 담는다
  // (D2 의 login.tsx 와 같은 이유 - prop 자리의 단언은 새 체크아웃의 lint 가 막는다).
  const clearHref = clearFiltersHref(LIST_PATH, params) as Href

  const go = (href: string) => {
    setSheet(null)
    const target = href as Href
    router.push(target)
  }

  return (
    <View testID="examples-screen" className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Example' }} />
      <ListToolbar
        sortOptions={options}
        onFilter={() => {
          setSheet('filter')
        }}
        onSort={() => {
          setSheet('sort')
        }}
      />
      <ResourceListView
        list={list}
        clearFiltersHref={clearHref}
        onOpen={(id) => {
          router.push({ pathname: '/examples/[id]', params: { id } })
        }}
      />
      <FilterSheet
        open={sheet === 'filter'}
        fields={fields}
        onApply={(values) => {
          go(filterHref(LIST_PATH, fields, params, values))
        }}
        onClear={() => {
          go(clearFiltersHref(LIST_PATH, params))
        }}
        onClose={() => {
          setSheet(null)
        }}
      />
      <SortSheet
        open={sheet === 'sort'}
        options={options}
        onPick={go}
        onClose={() => {
          setSheet(null)
        }}
      />
    </View>
  )
}
