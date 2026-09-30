import { TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import type { LucideIcon, LucideProps } from 'lucide-react-native'
import * as React from 'react'
import { withUniwind } from 'uniwind'

type IconProps = LucideProps & {
  as: LucideIcon
} & React.RefAttributes<LucideIcon>

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />
}

const StyledIcon = withUniwind(IconImpl, {
  size: {
    fromClassName: 'className',
    styleProperty: 'width',
  },
  color: {
    fromClassName: 'className',
    styleProperty: 'color',
  },
})

// 원본과 다른 곳: 아래 예시의 아이콘 import 를 통(`from 'lucide-react-native'`)에서 깊은 import 로 바꿨다 - 통을
// 값으로 받으면 Metro 가 아이콘 전부를 번들에 싣고, eslint.config.js 가 그 import 를 막는다(루트 AGENTS.md 의
// "React Native Reusables 컴포넌트").
/**
 * A wrapper component for Lucide icons with Uniwind `className` support via `withUniwind`.
 *
 * This component allows you to render any Lucide icon while applying utility classes
 * using `uniwind`. It avoids the need to wrap or configure each icon individually.
 *
 * @component
 * @example
 * ```tsx
 * import ArrowRight from 'lucide-react-native/icons/arrow-right';
 * import { Icon } from '@/registry/uniwind/registry/components/ui/icon';
 *
 * <Icon as={ArrowRight} className="text-red-500 size-4" />
 * ```
 *
 * @param {LucideIcon} as - The Lucide icon component to render.
 * @param {string} className - Utility classes to style the icon using Uniwind.
 * @param {number} size - Icon size (overrides the size class).
 * @param {...LucideProps} ...props - Additional Lucide icon props passed to the "as" icon.
 */
function Icon({ as: IconComponent, className, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext)
  return (
    <StyledIcon
      as={IconComponent}
      className={cn('text-foreground size-5', textClass, className)}
      {...props}
    />
  )
}

export { Icon }
