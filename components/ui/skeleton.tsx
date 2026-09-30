import { cn } from '@/lib/utils'
import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import * as React from 'react'

const duration = 1000

// 원본과 다른 곳 둘: ref 를 받지 않는다 - 원본의 React.RefAttributes<View> 는 exactOptionalPropertyTypes
// 아래에서 reanimated Animated.View 의 ref 타입과 맞지 않아 타입 검사가 실패한다(스켈레톤에 ref 를 걸
// 자리가 없다). 효과의 의존성에 sv 를 적는다 - 빠지면 react-hooks/exhaustive-deps 경고다.
function Skeleton({ className, ...props }: React.ComponentProps<typeof View>) {
  const sv = useSharedValue(1)

  React.useEffect(() => {
    sv.value = withRepeat(withTiming(0.5, { duration }), -1, true)
  }, [sv])

  const style = useAnimatedStyle(
    () => ({
      opacity: sv.value,
    }),
    [sv],
  )
  return (
    <Animated.View
      style={style}
      className={cn('bg-secondary dark:bg-muted rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
