import { cn } from '@/lib/utils'

/** Nhãn phím tắt hiện trên nút (NFR-01) */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'border-current/25 bg-current/8 inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px] leading-none font-semibold',
        className
      )}
    >
      {children}
    </kbd>
  )
}
