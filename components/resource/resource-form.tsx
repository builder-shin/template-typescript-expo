import type { MutationKey } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Keyboard, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import {
  formAttributes,
  isRequiredAttribute,
  type AttributeDefinition,
  type ResourceDefinition,
} from '@/lib/resources/define'
import {
  withAttribute,
  withRelationshipChoice,
  type ResourceFormState,
  type ResourceFormValues,
} from '@/lib/resources/form'
import { cn } from '@/lib/utils'
import type { RelationshipReference } from '@/queries/resources'
import { useSubmitOnce } from '@/queries/submit-once'

import { RelationshipPicker } from './relationship-picker'

/** 폼의 여백(`p-6`). 아래쪽에는 시스템 막대의 높이가 더해진다. */
const CONTENT_PADDING = 24

/**
 * 자원 선언을 읽어 그리는 쓰기 폼 - 생성과 수정이 함께 쓴다(스펙 8.1). 두 화면의 차이는 첫 값·제출
 * 라벨·제출할 때 할 일뿐이다. 수정 폼의 첫 값을 기다리는 자리는 `resource-edit-gate.tsx` 다.
 *
 * 입력 값은 이 컴포넌트가 들고 있다(`initialValues` 는 첫 값일 뿐이다) - 값을 고치는 것은
 * `withAttribute`·`withRelationshipChoice`(lib/resources/form.ts)다. 오류의 자리는 `state` 가 이미
 * 나눠 왔다(`formStateFromErrors`, 스펙 9.1): 문서 오류는 위 배너, 속성 오류는 그 입력 아래, 관계
 * 오류는 그 선택기 아래. 실패해도 입력은 지우지 않는다. 입력을 검증하지 않는다 - 정본 검증자는
 * 백엔드다(필수 칸이 비면 422 가 그 칸 아래 뜬다).
 *
 * 문서 오류가 새로 오면 폼을 맨 위로 굴려 배너가 보이게 한다 - 제출 버튼을 누른 아래쪽에서는 배너가 화면 밖이라 폼이
 * 아무 말 없이 멈춘 것으로 보인다. 속성·관계 오류는 굴리지 않는다(그 칸의 자리를 폼이 재지 않는다 - 높이가 큰 폼에서는
 * 화면 밖일 수 있다).
 *
 * 자원 이름으로 분기하지 않는다 - 입력의 종류는 속성의 `kind`(구조)가 정한다.
 *
 * | kind       | 입력                                   |
 * | ---------- | -------------------------------------- |
 * | `string`   | 한 줄 입력                             |
 * | `text`     | 여러 줄 입력                           |
 * | `enum`     | 보기 칩(하나만 고른다)                 |
 * | `int`      | 숫자 자판의 한 줄 입력                 |
 * | `datetime` | 그리지 않는다 - 오늘 선언의 datetime 은 전부 읽기 전용이라 `formAttributes` 가 뺀다 |
 *
 * 알려진 한계(원본과 같다): enum 칩에는 "선택 안 함" 이 없다 - nullable 인 enum 속성이 생기면 고른 값을
 * 되돌릴 방법이 없다. 오늘 선언에는 그런 속성이 없다(`EXAMPLE.status` 는 필수라 첫 값으로 시작한다 -
 * `newFormValues`). 생기는 날 빈 칩을 더한다. int 입력의 자판은 `number-pad` 라 음수를 칠 수 없다 - 오늘 선언의
 * int(`EXAMPLE.score`)는 최소가 0 이다. 음수를 받는 int 가 생기는 날 필터의 범위 입력처럼 `min` 으로 자판을 가른다.
 *
 * 제출은 한 번에 하나다 - 쓰기 훅의 `mutationKey` 로 진행 중인 쓰기를 본다(queries/submit-once.ts).
 *
 * testID(E2E 플로가 찾는다): 폼 `resource-form`, 라벨 `field-label-<속성>`, 입력 `field-input-<속성>`, 칩
 * `field-choice-<속성>-<값>`, 필드 오류 `field-error-<속성>`, 제출 `submit-button`. 관계 선택기의
 * 것은 `relationship-picker.tsx`. 라벨을 누르면 키보드가 내려간다(`Keyboard.dismiss`). 플로는 아래쪽 요소를
 * 누르기 전에 제목 라벨을 누른다 - 키보드가 아래쪽 요소를 가리고 있으면 그 자리를 누른 것이 키보드로 간다.
 *
 * 끝 여백: 마지막 요소(수정 화면의 삭제 버튼)가 시스템 내비게이션 막대 밑으로 들어가지 않게 아래 여백만큼
 * 띄운다(`useSafeAreaInsets` - Android(SDK 57)는 화면 끝까지 그린다. 상세·목록·시트와 같다). iOS 는 키보드가
 * 올라오면 입력이 가려지지 않게 스크롤 안쪽 여백을 늘린다(`automaticallyAdjustKeyboardInsets` - 자격증명 폼과
 * 같다. Android 는 이 prop 을 모른다).
 */
export function ResourceForm({
  resource,
  references,
  initialValues,
  state,
  pending,
  mutationKey,
  submitLabel,
  onSubmit,
  footer,
}: {
  resource: ResourceDefinition
  references: Readonly<Record<string, RelationshipReference>>
  initialValues: ResourceFormValues
  state: ResourceFormState
  pending: boolean
  /** 제출이 부르는 쓰기의 키 - 쓰기 훅의 `mutationKey` 다. */
  mutationKey: MutationKey
  submitLabel: string
  onSubmit: (values: ResourceFormValues) => void
  /** 제출 버튼 아래 - 수정 화면의 삭제 버튼 자리다. */
  footer?: ReactNode
}) {
  const [values, setValues] = useState(initialValues)
  const submitOnce = useSubmitOnce(mutationKey)
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

  // 새 문서 오류가 오면 배너가 있는 맨 위로 - 제출 전의 빈 상태는 같은 빈 배열이라 처음에는 움직이지 않는다.
  useEffect(() => {
    if (state.documentErrors.length > 0) scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [state.documentErrors])

  return (
    <ScrollView
      ref={scrollRef}
      testID="resource-form"
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-6"
      contentContainerStyle={{ paddingBottom: CONTENT_PADDING + insets.bottom }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <FormBanner messages={state.documentErrors} />
      {formAttributes(resource).map(([name, attribute]) => (
        <AttributeField
          key={name}
          name={name}
          attribute={attribute}
          value={values.attributes[name] ?? ''}
          errors={state.fieldErrors[name] ?? []}
          onChange={(raw) => {
            setValues((current) => withAttribute(current, name, raw))
          }}
        />
      ))}
      {Object.entries(resource.relationships).map(([name, relationship]) => (
        <RelationshipPicker
          key={name}
          name={name}
          relationship={relationship}
          reference={references[name]}
          selected={values.relationships[name] ?? []}
          errors={state.relationshipErrors[name] ?? []}
          onChoose={(id) => {
            setValues((current) => withRelationshipChoice(current, name, relationship, id))
          }}
        />
      ))}
      <SubmitButton
        testID="submit-button"
        label={submitLabel}
        pending={pending}
        onPress={() => {
          Keyboard.dismiss()
          submitOnce(() => {
            onSubmit(values)
          })
        }}
      />
      {footer}
    </ScrollView>
  )
}

function AttributeField({
  name,
  attribute,
  value,
  errors,
  onChange,
}: {
  name: string
  attribute: AttributeDefinition
  value: string
  errors: readonly string[]
  onChange: (raw: string) => void
}) {
  // datetime 은 오늘 이 자리에 닿지 않는다 - 위 머리말의 표. 입력이 없는 라벨만 남지 않게 필드째 그리지 않는다.
  if (attribute.kind === 'datetime') return null

  const label = isRequiredAttribute(attribute) ? `${attribute.label} *` : attribute.label
  const invalid = errors.length > 0

  return (
    <View className="gap-1.5">
      <Text
        testID={`field-label-${name}`}
        onPress={Keyboard.dismiss}
        className="text-sm font-medium"
      >
        {label}
      </Text>
      <AttributeControl
        name={name}
        attribute={attribute}
        value={value}
        invalid={invalid}
        onChange={onChange}
      />
      <FieldError testID={`field-error-${name}`} messages={errors} />
    </View>
  )
}

/** 위 kind → 입력 표를 그대로 코드로 옮긴 것. */
function AttributeControl({
  name,
  attribute,
  value,
  invalid,
  onChange,
}: {
  name: string
  attribute: Exclude<AttributeDefinition, { kind: 'datetime' }>
  value: string
  invalid: boolean
  onChange: (raw: string) => void
}) {
  if (attribute.kind === 'enum') {
    return (
      <View
        role="radiogroup"
        accessibilityLabel={attribute.label}
        className="flex-row flex-wrap gap-2"
      >
        {attribute.values.map((entry) => (
          // value 는 백엔드 원값, 글자는 라벨이다 - 라벨을 보내면 422 다(form.ts 머리말의 R7).
          <Pressable
            key={entry.value}
            testID={`field-choice-${name}-${entry.value}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === entry.value }}
            onPress={() => {
              onChange(entry.value)
            }}
            className={cn(
              'rounded-full border px-3 py-1.5',
              value === entry.value
                ? 'border-primary bg-primary'
                : 'border-border bg-background active:bg-accent',
            )}
          >
            <Text className={cn('text-sm', value === entry.value && 'text-primary-foreground')}>
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <Input
      testID={`field-input-${name}`}
      accessibilityLabel={attribute.label}
      value={value}
      onChangeText={onChange}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={attribute.kind === 'int' ? 'number-pad' : 'default'}
      multiline={attribute.kind === 'text'}
      textAlignVertical={attribute.kind === 'text' ? 'top' : 'center'}
      className={cn(
        attribute.kind === 'text' && 'h-auto min-h-24 py-2',
        invalid && 'border-destructive',
      )}
    />
  )
}
