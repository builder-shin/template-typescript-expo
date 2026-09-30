import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import type { ListCell, ListColumn, ListRow } from '@/lib/resources/view'

import { EmptyValue, RelatedBadges } from './values'

/**
 * 목록의 행 하나 - 표의 줄이 아니라 카드다(폰 폭에 열 여섯이 들어가지 않는다). 첫 칸(자원을
 * 대표하는 속성, `displayAttribute`)이 제목이고 나머지 칸은 "이름 값" 으로 잇는다. 관계 칸은
 * 배지다(`kind` 로 가른다 - 자원 이름이 아니라 구조다).
 *
 * 행 전체가 상세로 가는 버튼이다. 주소 규칙은 화면이 갖는다(`onOpen`).
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function ResourceRow({
  columns,
  row,
  onOpen,
}: {
  columns: readonly ListColumn[]
  row: ListRow
  onOpen: (id: string) => void
}) {
  const [title, ...rest] = row.cells
  const labels = new Map(columns.map((column) => [column.key, column.label]))

  return (
    <Pressable
      testID="resource-row"
      accessibilityRole="button"
      onPress={() => {
        onOpen(row.id)
      }}
      className="gap-2 border-b border-border bg-background px-4 py-3 active:bg-accent"
    >
      {title === undefined || title.values.length === 0 ? (
        <EmptyValue />
      ) : (
        <Text testID="resource-row-title" className="text-base font-semibold">
          {title.values.join(' ')}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {rest.map((cell) => (
          <CellEntry key={cell.key} label={labels.get(cell.key) ?? cell.key} cell={cell} />
        ))}
      </View>
    </Pressable>
  )
}

function CellEntry({ label, cell }: { label: string; cell: ListCell }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {cell.values.length === 0 ? (
        <EmptyValue />
      ) : cell.kind === 'relationship' ? (
        <RelatedBadges values={cell.values} />
      ) : (
        <Text className="text-sm">{cell.values.join(' ')}</Text>
      )}
    </View>
  )
}
