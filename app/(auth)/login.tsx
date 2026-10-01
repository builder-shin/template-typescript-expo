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
import { LOGIN_MUTATION_KEY, useLoginMutation } from '@/queries/auth'

/**
 * 로그인 화면(스펙 7.4). `next` 는 경로 가드가 붙인 원래 경로다 - 값을 검사하지 않고 그대로
 * 넘긴다. 검사는 decideAfterLogin 안의 safeRedirectTarget 한 곳에서만 한다(lib/auth/flow.ts) -
 * 딥링크로 들어온 외부 URL 은 거기서 홈으로 바뀐다. 가드가 보낸 이 화면에서 뒤로 가면 홈이다
 * (useBackToHome - 가드가 루트를 이 화면 하나로 바꿔 끼운다).
 */
export default function LoginScreen() {
  const rawNext = useLocalSearchParams()[LOGIN_REDIRECT_PARAM]
  const login = useLoginMutation(rawNext)
  const [state, setState] = useState<AuthFormState>(IDLE_AUTH_FORM_STATE)
  useBackToHome()
  // authLinkHref 는 런타임에 만든 앱 안 경로다 - 타입드 라우트가 모르는 문자열이라 단언한다. 단언은
  // 변수에 담는다: prop·인자 자리에 두면 타입드 라우트를 만들기 전(새 체크아웃)의 lint 가 받는 쪽이
  // string 을 받는다며 "불필요한 단언"으로 본다.
  const registerLink = authLinkHref('/register', rawNext, LOGIN_REDIRECT_PARAM) as Href

  return (
    <>
      <Stack.Screen options={{ title: '로그인' }} />
      <CredentialsForm
        testID="login-screen"
        heading="로그인"
        submitLabel="로그인"
        passwordAutoComplete="current-password"
        state={state}
        pending={login.isPending}
        mutationKey={LOGIN_MUTATION_KEY}
        onSubmit={(credentials) => {
          login.mutate(credentials, {
            onSuccess: (plan) => {
              if (plan.kind === 'state') {
                setState(plan.state)
                return
              }
              // plan.to 는 safeRedirectTarget 을 지난 앱 안의 경로다(단언은 위와 같은 이유로 변수에).
              // dismissTo 는 그 화면이 스택에 있으면 거기까지 닫고, 없으면 지금 화면을 바꾼다. withAnchor 를
              // 준다 - 경로 가드의 Redirect 는 루트의 (app) 을 로그인 화면으로 바꿔 끼우므로 복귀할 때 (app) 이
              // 새로 만들어진다. 앵커를 싣지 않으면 (app) 이 복귀한 화면 하나로 시작해 뒤로 가기가 앱을 닫는다
              // (test/e2e/flows/guard-return.yaml 이 잰다).
              const target = plan.to as Href
              router.dismissTo(target, { withAnchor: true })
            },
            onError: () => {
              setState(unusableResponseState({ email: credentials.email, accountCreated: false }))
            },
          })
        }}
        footer={
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-sm text-muted-foreground">계정이 없으신가요?</Text>
            <Link href={registerLink} replace asChild>
              <Text testID="register-link" className="text-sm text-primary underline">
                가입하기
              </Text>
            </Link>
          </View>
        }
      />
    </>
  )
}
