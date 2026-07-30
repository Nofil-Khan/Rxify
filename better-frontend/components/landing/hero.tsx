import Link from 'next/link'
import { Reveal } from './reveal'

export function Hero() {
  return (
    <section className="relative flex min-h-svh items-center">
      <Reveal className="mx-auto w-full max-w-6xl px-6 pt-24">
        <p
          data-reveal
          className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-primary"
        >
          Prescription intelligence
        </p>
        <h1
          data-reveal
          className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl"
        >
          Your prescriptions, <span className="gradient-ink">digitized by AI.</span>
        </h1>
        <p
          data-reveal
          className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          Photograph any prescription — handwritten or printed. Rxify reads it,
          structures every field, and keeps it in a private vault you can share
          with anyone. No account required on their side.
        </p>
        <div data-reveal className="mt-10 flex flex-wrap items-center gap-6">
          <Link
            href="/signup"
            className="gradient-cta rounded-full px-7 py-3.5 text-base font-medium"
          >
            Digitize your first prescription
          </Link>
          <a
            href="#how-it-works"
            className="link-underline text-sm text-muted-foreground hover:text-foreground"
          >
            See how it works
          </a>
        </div>

        <div data-reveal className="mt-24 max-w-xl">
          <div className="hairline mb-5" />
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            {[
              ['9', 'structured fields per scan'],
              ['7-day', 'expiring share links'],
              ['HD', 'doctor video calls'],
            ].map(([stat, label]) => (
              <div key={label}>
                <div className="text-2xl font-semibold tracking-tight">
                  {stat}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
