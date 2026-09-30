import { useState, type ReactNode } from 'react'
import { ScrollView, View } from 'react-native'

import { FieldError } from '@/components/form/field-error'
import { FormBanner } from '@/components/form/form-banner'
import { SubmitButton } from '@/components/form/submit-button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import type { Credentials } from '@/lib/auth/credentials'
import { EMAIL_FIELD, PASSWORD_FIELD, type AuthFormState } from '@/lib/auth/form-state'
import { cn } from '@/lib/utils'

interface CredentialsFormProps {
  /** 화면 전체의 testID(login-screen · register-screen) - E2E 플로가 찾는다. */
  testID: string
  heading: string
  submitLabel: string
  /** 로그인은 current-password, 가입은 new-password - 비밀번호 관리자에게 주는 힌트다. */
  passwordAutoComplete: 'current-password' | 'new-password'
  state: AuthFormState
  pending: boolean
  onSubmit: (credentials: Credentials) => void
  footer: ReactNode
  /** 가입에서만 쓴다 - 계정은 만들어졌는데 이어지는 로그인이 실패했을 때의 안내. */
  notice?: ReactNode
}

/**
 * 가입과 로그인이 함께 쓰는 자격증명 폼. 백엔드가 두 엔드포인트에 같은 attributes 스키마를 쓴다
 * (lib/auth/credentials.ts 머리말) - 두 화면이 갈라지는 날은 그 스키마가 갈라지는 날이다.
 *
 * 오류의 자리는 이 컴포넌트가 정하지 않는다 - `state` 가 이미 나눠 온다(lib/auth/flow.ts 의
 * authFormStateFromErrors, 스펙 9.1). 입력 값은 오류가 나도 지우지 않는다. 입력 검증은 백엔드가
 * 한다 - 여기서 빈 칸이나 길이를 막으면 백엔드 규칙이 반쪽만 복제된다.
 *
 * 키보드가 떠 있어도 제출 버튼이 한 번에 눌리게 keyboardShouldPersistTaps 를 준다.
 * testID 는 E2E 플로(test/e2e/)가 찾는 이름이다 - 바꾸면 플로도 함께 바꾼다.
 */
export function CredentialsForm({
  testID,
  heading,
  submitLabel,
  passwordAutoComplete,
  state,
  pending,
  onSubmit,
  footer,
  notice,
}: CredentialsFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailErrors = state.fieldErrors[EMAIL_FIELD] ?? []
  const passwordErrors = state.fieldErrors[PASSWORD_FIELD] ?? []

  return (
    <ScrollView
      testID={testID}
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-6"
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="h3">{heading}</Text>
      {notice}
      <FormBanner messages={state.documentErrors} />

      <View className="gap-1.5">
        <Text className="text-sm font-medium">이메일</Text>
        <Input
          testID="email-input"
          accessibilityLabel="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          className={cn(emailErrors.length > 0 && 'border-destructive')}
        />
        <FieldError testID="email-error" messages={emailErrors} />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium">비밀번호</Text>
        <Input
          testID="password-input"
          accessibilityLabel="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={passwordAutoComplete}
          textContentType={passwordAutoComplete === 'new-password' ? 'newPassword' : 'password'}
          className={cn(passwordErrors.length > 0 && 'border-destructive')}
        />
        <FieldError testID="password-error" messages={passwordErrors} />
      </View>

      <SubmitButton
        testID="submit-button"
        label={submitLabel}
        pending={pending}
        onPress={() => {
          onSubmit({ email, password })
        }}
      />
      {footer}
    </ScrollView>
  )
}
