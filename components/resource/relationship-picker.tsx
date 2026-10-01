import { useState } from 'react'
import { Keyboard, Pressable, ScrollView, View } from 'react-native'

import { FailureBanner, RequestFailed } from '@/components/app/request-failed'
import { Sheet } from '@/components/app/sheet'
import { FieldError } from '@/components/form/field-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { RelationshipDefinition } from '@/lib/resources/define'
import { relationshipChoice, type RelationshipOption } from '@/lib/resources/form'
import { REFERENCE_PAGE_SIZE } from '@/lib/resources/view'
import { cn } from '@/lib/utils'
import type { RelationshipReference } from '@/queries/resources'

/** to-one 의 "관계를 끊는다" 보기. */
const NONE_LABEL = '선택 안 함'

/** 목록 밖 선택의 라벨에 붙는 표시 - 라벨 자리에는 id 가 온다(`relationshipChoice`). */
const UNLISTED_SUFFIX = ' (목록에 없음)'

/** 목록 밖 선택이 하나라도 있을 때의 안내 - 응답을 받은 뒤의 사실이지 로딩 문구가 아니다. */
const UNLISTED_NOTICE =
  '목록에 없는 항목이 선택돼 있습니다. 해제하지 않으면 저장 후에도 그대로 남습니다.'

/**
 * 관계 하나를 고르는 선택기 - 스펙 8.1 의 "분류 단일 선택, 태그 다중 선택(순서 유지)". 폼에는 지금
 * 고른 것을 배지로 그리고(고른 순서 그대로), 누르면 아래 시트에 참조 목록(`referenceRequest`, 이름
 * 순 100건)을 연다. 무엇을 그릴지는 `relationshipChoice`(lib/resources/form.ts)가 정한다 - 목록
 * 밖의 선택(잘렸거나 조회가 실패한 목록)도 끝에 붙여 보이고 안내를 단다.
 *
 * 자원 이름으로 분기하지 않는다 - 컨트롤은 `relationship.cardinality`(구조)로만 갈린다.
 *
 * | cardinality | 시트                         | 누르면                          |
 * | ----------- | ---------------------------- | ------------------------------- |
 * | `'one'`     | "선택 안 함" + 보기          | 그것을 고르고 시트를 닫는다     |
 * | `'many'`    | 보기(고른 것에 표시)         | 켜고 끈다 - 켜면 끝에 붙는다    |
 *
 * 참조 목록을 받기 전에는 스켈레톤이다(스펙 8.7). 조회가 실패하면 보기 위에 그 실패를 그린다 - 조회 화면과 같은
 * 두 갈래다(스펙 9.3): 닿지 못함이면 앱 문구와 "다시 시도", 백엔드가 거절했으면 그 문구이고, 첫 조회가 판정하지
 * 않은 응답(5xx·408·429)을 받았으면(`retryable`) 문구 아래에 "다시 시도" 도 둔다. 보기는 그대로 둔다 - 목록이 비어도
 * "선택 안 함"(to-one)과 지금 고른 목록 밖 선택의 줄은 남는다. 실패한 동안에도 고른 것을 해제할 수 있어야 폼의 안내
 * ("해제하지 않으면 저장 후에도 그대로 남습니다")가 권하는 일을 할 수 있다. 문구가 하나도 없는 거절은 계약 위반이라 이
 * 컴포넌트에 닿기 전 `referenceState` 가 던진다 - 앱 문구로 가리지 않는다. 잘림·읽기 전용 안내는 응답을 받은 뒤의
 * 사실이다.
 *
 * 폼의 자리(누르는 곳)는 스크린 리더에 현재 선택을 값으로 읽힌다(`accessibilityValue`) - 라벨만 달면 자식의 글자가 읽히지
 * 않아 무엇이 골라져 있는지 알 길이 없다.
 *
 * testID(E2E 플로가 찾는다): 폼의 자리 `relationship-open-<관계>`, 고른 배지
 * `relationship-value-<관계>-<위치>`, 시트 `relationship-sheet-<관계>`, 보기의 글자
 * `relationship-option-<관계>`(보기 이름과 함께 찾는다), `relationship-none-<관계>`, 닫기
 * `relationship-done-<관계>`, 오류 `relationship-error-<관계>`, 안내 `relationship-unlisted-<관계>`(목록 밖
 * 선택)·`relationship-truncated-<관계>`(잘린 목록).
 */
export function RelationshipPicker({
  name,
  relationship,
  reference,
  selected,
  errors,
  onChoose,
}: {
  name: string
  relationship: RelationshipDefinition
  /** 이 관계의 참조 목록 - `useRelationshipReferences` 가 준다. 없으면 받기 전과 같다. */
  reference: RelationshipReference | undefined
  selected: readonly string[]
  errors: readonly string[]
  /** to-one 은 고른 id(`null` 이면 비운다), to-many 는 켜고 끌 id. */
  onChoose: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const list = reference?.list ?? null
  const choice = list === null ? null : relationshipChoice(relationship, list, selected)
  // 스크린 리더가 읽을 현재 선택 - 받기 전이면 읽을 것이 없다.
  const chosenLabels = choice === null ? null : choice.chosen.map(labelOf)
  const close = () => {
    setOpen(false)
  }

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{relationship.label}</Text>
      <Pressable
        testID={`relationship-open-${name}`}
        accessibilityRole="button"
        accessibilityLabel={relationship.label}
        accessibilityValue={
          chosenLabels === null
            ? undefined
            : { text: chosenLabels.length === 0 ? NONE_LABEL : chosenLabels.join(', ') }
        }
        onPress={() => {
          // 입력의 키보드가 떠 있으면 시트의 보기를 가린다.
          Keyboard.dismiss()
          setOpen(true)
        }}
        className={cn(
          'min-h-10 flex-row flex-wrap items-center gap-1 rounded-md border px-3 py-2 active:bg-accent',
          errors.length > 0 ? 'border-destructive' : 'border-input',
        )}
      >
        {choice === null ? (
          <Skeleton className="h-5 w-1/2" />
        ) : choice.chosen.length === 0 ? (
          <Text className="text-sm text-muted-foreground">{NONE_LABEL}</Text>
        ) : (
          choice.chosen.map((option, position) => (
            <Badge key={option.id} variant="secondary">
              <Text testID={`relationship-value-${name}-${position}`}>{labelOf(option)}</Text>
            </Badge>
          ))
        )}
      </Pressable>
      {choice?.hasUnlisted === true ? (
        <Text testID={`relationship-unlisted-${name}`} className="text-sm text-muted-foreground">
          {UNLISTED_NOTICE}
        </Text>
      ) : null}
      <FieldError testID={`relationship-error-${name}`} messages={errors} />

      <Sheet open={open} onClose={close} testID={`relationship-sheet-${name}`}>
        <View className="flex-row items-center gap-2">
          <Text variant="large" className="flex-1">
            {relationship.label}
          </Text>
          <Button testID={`relationship-done-${name}`} size="sm" onPress={close}>
            <Text>완료</Text>
          </Button>
        </View>
        <SheetBody
          name={name}
          relationship={relationship}
          reference={reference}
          options={choice?.options ?? null}
          onChoose={(id) => {
            onChoose(id)
            if (relationship.cardinality === 'one') close()
          }}
        />
      </Sheet>
    </View>
  )
}

function labelOf(option: RelationshipOption): string {
  return option.listed ? option.label : `${option.label}${UNLISTED_SUFFIX}`
}

function SheetBody({
  name,
  relationship,
  reference,
  options,
  onChoose,
}: {
  name: string
  relationship: RelationshipDefinition
  reference: RelationshipReference | undefined
  options: readonly RelationshipOption[] | null
  onChoose: (id: string | null) => void
}) {
  if (reference === undefined || options === null) return <OptionsSkeleton />

  const noneSelected = !options.some((option) => option.selected)
  return (
    <ScrollView contentContainerClassName="gap-1 pb-2">
      <SheetFailure reference={reference} />
      {reference.list?.truncated === true ? (
        <Text testID={`relationship-truncated-${name}`} className="text-sm text-muted-foreground">
          목록의 앞 {REFERENCE_PAGE_SIZE}개만 표시했습니다.
        </Text>
      ) : null}
      {reference.writable ? null : (
        <Text className="text-sm text-muted-foreground">
          이 목록은 읽기 전용이라 여기서 새로 만들 수 없습니다.
        </Text>
      )}
      {relationship.cardinality === 'one' ? (
        <OptionRow
          testID={`relationship-none-${name}`}
          label={NONE_LABEL}
          multiple={false}
          selected={noneSelected}
          onPress={() => {
            onChoose(null)
          }}
        />
      ) : null}
      {options.map((option) => (
        <OptionRow
          key={option.id}
          testID={`relationship-option-${name}`}
          label={labelOf(option)}
          multiple={relationship.cardinality === 'many'}
          selected={option.selected}
          onPress={() => {
            onChoose(option.id)
          }}
        />
      ))}
    </ScrollView>
  )
}

/**
 * 참조 조회의 실패 - 보기 위에 그린다. 실패가 아니면 아무것도 그리지 않는다. 실패 중의 `options` 는 목록이 비어 있어
 * 지금 고른 목록 밖 선택뿐이다(`relationshipChoice`) - 그 줄과 "선택 안 함" 은 그대로 둔다(위 머리말).
 */
function SheetFailure({ reference }: { reference: RelationshipReference }) {
  const { failure } = reference
  if (failure?.kind === 'unreachable') {
    return <RequestFailed compact retrying={reference.retrying} onRetry={reference.retry} />
  }
  if (failure?.kind === 'banner') {
    return (
      <View className="pb-2">
        <FailureBanner
          messages={failure.messages}
          retryable={failure.retryable === true}
          retrying={reference.retrying}
          onRetry={reference.retry}
        />
      </View>
    )
  }
  return null
}

/** 참조 목록을 받기 전의 자리 - 글자 없이 보기 모양만(스펙 8.7). */
function OptionsSkeleton() {
  return (
    <View className="gap-2">
      {[0, 1, 2, 3].map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </View>
  )
}

/** 보기 한 줄. testID 는 글자에 단다 - 플로가 testID 와 보기 이름을 함께 찾는다. */
function OptionRow({
  testID,
  label,
  multiple,
  selected,
  onPress,
}: {
  testID: string
  label: string
  multiple: boolean
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      className={cn(
        'rounded-md border px-3 py-3',
        selected ? 'border-primary bg-primary/10' : 'border-transparent active:bg-accent',
      )}
    >
      <Text testID={testID} className={cn('text-base', selected && 'font-semibold')}>
        {label}
      </Text>
    </Pressable>
  )
}
