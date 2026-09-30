import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 클래스 이름을 합치고 Tailwind 충돌을 뒤쪽 값으로 정리한다(React Native Reusables 의 cn). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
