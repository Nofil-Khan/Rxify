import Link from 'next/link'
import { Reveal } from './reveal'

export function CtaFooter() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-40 text-center">
        <Reveal>
          <p
            data-reveal
            className="font-mono text-xs uppercase tracking-[0.25em] text-primary"
          >
            Get started
          </p>
          <h2
            data-reveal
            className="mx-auto mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-6xl"
          >
            Stop losing <span className="gradient-ink">prescriptions.</span>
          </h2>
          <p
            data-reveal
            className="mx-auto mt-6 max-w-md text-pretty leading-relaxed text-muted-foreground"
          >
            One photo is all it takes. Your first extraction takes under a
            minute.
          </p>
          <div data-reveal className="mt-10">
            <Link
              href="/signup"
              className="gradient-cta inline-block rounded-full px-8 py-4 text-base font-medium"
            >
              Create your vault
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-12">
        <div className="hairline" />
        <div className="flex flex-col items-start justify-between gap-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold tracking-tight text-foreground">
              Rxify
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              Rx
            </span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <a href="#how-it-works" className="link-underline hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="link-underline hover:text-foreground">
              Features
            </a>
            <Link href="/login" className="link-underline hover:text-foreground">
              Log in
            </Link>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-widest">
            &copy; 2026 Rxify
          </p>
        </div>
      </footer>
    </>
  )
}
