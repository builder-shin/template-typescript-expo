import type { NativeIntent } from 'expo-router'

import { appPathFromDeepLink } from '@/lib/navigation/deep-link'
import { appSchemes } from '@/platform/config'

/**
 * Expo Router 의 특별 파일이다(라우트가 아니다) - 밖에서 들어온 링크가 라우터에 닿기 전에 지난다. 켜진 앱에 온
 * 링크와 콜드 스타트의 첫 주소가 모두 여기를 지난다.
 *
 * 이 빌드의 scheme 으로 들어온 링크를 앱 안 주소(`/examples?…`)로 바꿔 넘긴다 - 딥링크가 앱 안의 이동
 * (`router.push`)과 같은 해석을 지나 값의 `+`·`&`·`#` 이 그대로 닿는다(스펙 8.2). 판단과 그 이유는
 * lib/navigation/deep-link.ts 에 있다. 여기서는 잇기만 한다.
 */
export const redirectSystemPath: NonNullable<NativeIntent['redirectSystemPath']> = ({ path }) =>
  appPathFromDeepLink(path, appSchemes())
