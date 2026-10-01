import { Link, Stack, router, useLocalSearchParams, type Href } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useBackToHome } from '@/components/app/back-to-home'
import { CredentialsForm } from '@/components/form/credentials-form'
import { Text } from '@/components/ui/text'
import { authLinkHref } from '@/lib/auth/flow'
import {
  IDLE_AUTH_FORM_STATE,
  unusableResponseState,
  type AuthFormState,
} from '@/lib/auth/form-state'
import { LOGIN_REDIRECT_PARAM } from '@/lib/auth/protected-paths'
import { REGISTER_MUTATION_KEY, useRegisterMutation } from '@/queries/auth'

/**
 * 가입 화면(스펙 7.4) - register 다음 login 을 부르고 세션을 세운 뒤 `next` 로 간다. `next` 를
 * 이어받는다 - 로그인 화면에서 "가입하기"로 온 사용자도 가입한 뒤 원래 가려던 곳으로 간다. 로그인
 * 화면을 바꿔 끼우고 들어오므로(Link replace) 뒤로 가면 홈이다(useBackToHome).
 */
export default function RegisterScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const register = useRegisterMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
  useBackToHome()
  // authLinkHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은
  // 변수에 담는다(login.tsx 와 같은 이유 - prop 자리의 단언은 새 체크아웃의 lint 가 막는다).
  const loginLink = authLinkHref('/login', rawNext, LOGIN_REDIRECT_PARAM) as Href

  return (
    <>
      <Stack.Screen options={{ title: '가입' }} />
      <CredentialsForm
        testID="register-screen"
        heading="가입"
        submitLabel="가입하기"
        passwordAutoComplete="new-password"
        state={state}
        pending={register.isPending}
        mutationKey={REGISTER_MUTATION_KEY}
        onSubmit={(credentials) => {
          register.mutate(credentials, {
            onSuccess: (plan) => {
              if (plan.kind === 'state') {
                setState(plan.state)
                return
              }
              // withAnchor 는 login.tsx 와 같은 이유다 - 가드가 바꿔 끼운 (app) 을 새로 만들 때 홈을 아래에 깐다.
              const target = plan.to as Href
              router.dismissTo(target, { withAnchor: true })
            },
            onError: () => {
              setState(unusableResponseState({ email: credentials.email, accountCreated: false }))
            },
          })
        }}
        notice={
          state.accountCreated ? (
            // 두 번째 호출(login)만 실패한 상태다. 이 폼을 다시 제출하면 409 가 나는 막다른 길이라
            // 쓸모 있는 행동 하나(로그인으로 가기)를 준다.
            <View
              testID="account-created-notice"
              className="gap-1 rounded-lg border border-border bg-muted p-3"
            >
              <Text className="text-sm">
                계정은 만들어졌습니다. 자동 로그인만 실패했으니 로그인에서 다시 시도해 주세요.
              </Text>
              <Link href={loginLink} replace asChild>
                <Text className="text-sm text-primary underline">로그인하기</Text>
              </Link>
            </View>
          ) : null
        }
        footer={
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-sm text-muted-foreground">이미 계정이 있으신가요?</Text>
            <Link href={loginLink} replace asChild>
              <Text testID="login-link" className="text-sm text-primary underline">
                로그인
              </Text>
            </Link>
          </View>
        }
      />
    </>
  )
}
