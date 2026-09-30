import { cn } from '@/lib/utils'
import { Platform, TextInput } from 'react-native'

// 원본과 다른 곳 둘: 원본은 placeholderClassName 을 구조 분해해 버린다. 그 prop 은 NativeWind 의 것이라
// Uniwind 의 TextInputProps(uniwind/types.d.ts)에 없어 타입 검사가 실패한다 - 받지 않는다. 그리고
// 640dp·768dp 이상의 변형을 뺐다 - button.tsx 의 같은 주석(Uniwind 1.12.0).
function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' }),
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className,
      )}
      {...props}
    />
  )
}

export { Input }
