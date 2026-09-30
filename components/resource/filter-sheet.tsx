import { useState } from 'react'
import { Platform, Pressable, ScrollView, View, type KeyboardTypeOptions } from 'react-native'

import { Sheet } from '@/components/app/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import {
  filterFieldsKey,
  filterFormValues,
  type FilterField,
  type FilterFormValues,
  type FilterOption,
} from '@/lib/resources/view'
import { cn } from '@/lib/utils'

/**
 * 필터 시트 - 스펙 8.1. 무엇을 그릴지는 `filterFields`(lib/resources/view.ts)가 선언에서 정해
 * 왔다: 다중 선택(enum + in) · 단일 선택(enum + exact, isNull) · 텍스트(contains·exact) ·
 * 범위(비교 연산자). 자원 이름은 이 파일에 없다.
 *
 * 시트는 URL 의 조건에서 시작하고(`filterFormValues`), "적용" 에서만 URL 을 바꾼다 - 닫으면
 * 적용하지 않은 입력을 버린다. 값 → 주소 변환(`filterHref`)은 화면이 한다. 입력을 검증하지
 * 않는다 - 규칙의 정본은 백엔드다(스펙 9.2).
 *
 * "적용"·"필터 지우기" 는 시트 머리 줄에 둔다 - 입력에 키보드가 올라와도 가리지 않는다.
 *
 * testID 는 선언에서 만든다: 보기 `filter-option-<키>-<연산자>-<값|any>`, 입력
 * `filter-input-<키>-<연산자>`. E2E 플로(test/e2e/)가 찾는 이름이다.
 */
export function FilterSheet({
  open,
  fields,
  onApply,
  onClear,
  onClose,
}: {
  open: boolean
  fields: readonly FilterField[]
  onApply: (values: FilterFormValues) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} testID="filter-sheet">
      {/* 열 때마다 URL 의 값으로 다시 만든다 - 조건이 바뀐 URL 에서는 열쇠도 바뀐다. */}
      {open ? (
        <FilterForm
          key={filterFieldsKey(fields)}
          fields={fields}
          onApply={onApply}
          onClear={onClear}
        />
      ) : null}
    </Sheet>
  )
}

type SetValues = (parameter: string, values: readonly string[]) => void

type RangeField = Extract<FilterField, { kind: 'range' }>

/**
 * 음수를 받는 숫자 범위의 자판 - `number-pad` 는 숫자만 쳐서 빼기 기호가 없다. iOS 는 `numbers-and-punctuation` 이
 * 빼기 기호와 소수점을 주고, Android 는 그 이름을 몰라 기본 글자판으로 떨어지므로(React Native 의 keyboardType
 * 매핑) 부호와 소수점을 주는 `numeric` 을 쓴다.
 */
const SIGNED_NUMBER_KEYBOARD = Platform.select<KeyboardTypeOptions>({
  ios: 'numbers-and-punctuation',
  default: 'numeric',
})

/** 범위 입력의 자판. 음수를 받는 필드(선언의 `min`, `signed`)만 빼기 기호를 친다 - 날짜와 글자는 기본 자판이다. */
function rangeKeyboard(field: RangeField): KeyboardTypeOptions {
  if (field.shape !== 'number') return 'default'
  return field.signed ? SIGNED_NUMBER_KEYBOARD : 'number-pad'
}

function FilterForm({
  fields,
  onApply,
  onClear,
}: {
  fields: readonly FilterField[]
  onApply: (values: FilterFormValues) => void
  onClear: () => void
}) {
  const [values, setValues] = useState<FilterFormValues>(() => filterFormValues(fields))
  const set: SetValues = (parameter, next) => {
    setValues((current) => ({ ...current, [parameter]: next }))
  }

  return (
    <>
      <View className="flex-row items-center gap-2">
        <Text variant="large" className="flex-1">
          필터
        </Text>
        <Button testID="filter-clear" variant="outline" size="sm" onPress={onClear}>
          <Text>필터 지우기</Text>
        </Button>
        <Button
          testID="filter-apply"
          size="sm"
          onPress={() => {
            onApply(values)
          }}
        >
          <Text>적용</Text>
        </Button>
      </View>
      <ScrollView contentContainerClassName="gap-5 pb-2" keyboardShouldPersistTaps="handled">
        {fields.map((field) => (
          <FieldControl key={field.id} field={field} values={values} onChange={set} />
        ))}
      </ScrollView>
    </>
  )
}

function FieldControl({
  field,
  values,
  onChange,
}: {
  field: FilterField
  values: FilterFormValues
  onChange: SetValues
}) {
  if (field.kind === 'select') {
    const chosen = values[field.parameter] ?? []
    return (
      <View className="gap-2">
        <Text className="text-sm font-medium">{field.label}</Text>
        <View className="flex-row flex-wrap gap-2">
          {field.options.map((option) => (
            <OptionChip
              key={option.value}
              testID={`filter-option-${field.key}-${field.operator}-${option.value === '' ? 'any' : option.value}`}
              option={option}
              multiple={field.multiple}
              // 단일 선택의 "전체"(값 '')는 아무것도 고르지 않은 상태다.
              selected={option.value === '' ? chosen.length === 0 : chosen.includes(option.value)}
              onPress={() => {
                if (!field.multiple) {
                  onChange(field.parameter, option.value === '' ? [] : [option.value])
                } else if (chosen.includes(option.value)) {
                  onChange(
                    field.parameter,
                    chosen.filter((value) => value !== option.value),
                  )
                } else {
                  onChange(field.parameter, [...chosen, option.value])
                }
              }}
            />
          ))}
        </View>
      </View>
    )
  }

  if (field.kind === 'text') {
    return (
      <View className="gap-2">
        <Text className="text-sm font-medium">{field.label}</Text>
        <Input
          testID={`filter-input-${field.key}-${field.operator}`}
          accessibilityLabel={field.label}
          value={values[field.parameter]?.[0] ?? ''}
          onChangeText={(text) => {
            onChange(field.parameter, [text])
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    )
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium">{field.label}</Text>
      <View className="flex-row items-center gap-2">
        {(
          [
            ['최소', field.lower],
            ['최대', field.upper],
          ] as const
        ).map(([edge, bound]) =>
          bound === null ? null : (
            <Input
              key={bound.parameter}
              testID={`filter-input-${field.key}-${bound.operator}`}
              accessibilityLabel={`${field.label} ${edge}`}
              // 두 칸 가운데 어느 쪽인지 자리표시자가 말한다. 날짜는 모양도 함께 - 경계 순간으로 바꾸는 것은
              // filterQuery 다.
              placeholder={field.shape === 'date' ? `${edge} YYYY-MM-DD` : edge}
              keyboardType={rangeKeyboard(field)}
              value={values[bound.parameter]?.[0] ?? ''}
              onChangeText={(text) => {
                onChange(bound.parameter, [text])
              }}
              className="flex-1"
            />
          ),
        )}
      </View>
    </View>
  )
}

function OptionChip({
  testID,
  option,
  multiple,
  selected,
  onPress,
}: {
  testID: string
  option: FilterOption
  multiple: boolean
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      className={cn(
        'rounded-full border px-3 py-1.5',
        selected ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent',
      )}
    >
      <Text className={cn('text-sm', selected && 'text-primary-foreground')}>{option.label}</Text>
    </Pressable>
  )
}
