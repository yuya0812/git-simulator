import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'local' | 'remote' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-orange-400 text-white hover:bg-orange-500 shadow-sm',
  secondary: 'bg-white text-ink border border-stone-300 hover:bg-stone-50',
  local: 'bg-local-500 text-white hover:bg-local-700 shadow-sm',
  remote: 'bg-remote-500 text-white hover:bg-remote-700 shadow-sm',
  ghost: 'text-stone-500 hover:bg-stone-100',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function Panel({
  title,
  badge,
  actions,
  className = '',
  children,
}: {
  title: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`flex min-h-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-center gap-2 border-b border-stone-100 px-4 py-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {badge}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </section>
  )
}

export function Tag({ tone, children }: { tone: 'local' | 'remote' | 'orange' | 'stone'; children: ReactNode }) {
  const tones = {
    local: 'bg-local-100 text-local-700',
    remote: 'bg-remote-100 text-remote-700',
    orange: 'bg-orange-100 text-orange-700',
    stone: 'bg-stone-100 text-stone-600',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

export function Modal({
  title,
  children,
  footer,
  onClose,
  wide = false,
}: {
  title: ReactNode
  children: ReactNode
  footer: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  // Esc キーで閉じられるようにする
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-full overflow-auto rounded-3xl bg-white p-6 shadow-xl ${wide ? 'max-w-4xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        <div className="space-y-3 text-sm leading-relaxed">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  )
}
