import { ArrowDown, ArrowUp, ArrowUpDown, SlidersHorizontal } from 'lucide-react-native'
import { Pressable, View } from 'react-native'

import { Sheet } from '@/components/app/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import type { SortOption } from '@/lib/resources/view'
import { cn } from '@/lib/utils'

/**
 * 목록 위의 도구 줄과 정렬 메뉴 - 스펙 8.1. 항목과 누르면 갈 주소는 `sortOptions`
 * (lib/resources/view.ts)가 선언에서 정해 왔다. 지금 걸린 항목(`direction` 이 있는 것)은 방향
 * 화살표를 달고, 누르면 방향이 뒤집힌 주소로 간다.
 *
 * 정렬 메뉴와 필터 시트는 오류 상태에서도 연다 - 잘못된 조건의 URL 에서 빠져나갈 수단이다.
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 항목은 `sort-option-<정렬 키>`.
 */
export function ListToolbar({
  sortOptions,
  onFilter,
  onSort,
}: {
  sortOptions: readonly SortOption[]
  onFilter: () => void
  onSort: () => void
}) {
  const current = sortOptions.find((option) => option.direction !== null)

  return (
    <View className="flex-row gap-2 border-b border-border px-4 py-2">
      <Button testID="filter-button" variant="outline" size="sm" onPress={onFilter}>
        <Icon as={SlidersHorizontal} className="size-4" />
        <Text>필터</Text>
      </Button>
      <Button testID="sort-button" variant="outline" size="sm" onPress={onSort}>
        <Icon as={ArrowUpDown} className="size-4" />
        <Text>{current === undefined ? '정렬' : current.label}</Text>
      </Button>
    </View>
  )
}

export function SortSheet({
  open,
  options,
  onPick,
  onClose,
}: {
  open: boolean
  options: readonly SortOption[]
  onPick: (href: string) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} testID="sort-sheet">
      <Text variant="large">정렬</Text>
      {options.map((option) => (
        <Pressable
          key={option.key}
          testID={`sort-option-${option.key}`}
          accessibilityRole="button"
          accessibilityState={{ selected: option.direction !== null }}
          onPress={() => {
            onPick(option.href)
          }}
          className="flex-row items-center justify-between rounded-md px-3 py-3 active:bg-accent"
        >
          <Text className={cn(option.direction !== null && 'font-semibold')}>{option.label}</Text>
          {option.direction === null ? null : (
            <Icon as={option.direction === 'asc' ? ArrowUp : ArrowDown} className="size-4" />
          )}
        </Pressable>
      ))}
    </Sheet>
  )
}
