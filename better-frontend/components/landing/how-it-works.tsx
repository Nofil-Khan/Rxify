'use client'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useRef } from 'react'
import { Reveal } from './reveal'

gsap.registerPlugin(ScrollTrigger)

const steps = [
  {
    n: '01',
    title: 'Photograph it',
    body: 'Snap a picture of any prescription — handwritten scrawl, printed slip, JPG, PNG, WEBP, or HEIC. That is the entire input.',
  },
  {
    n: '02',
    title: 'AI extracts everything',
    body: 'Vision AI reads the image and returns structured data: medications, dosages, frequency, duration, diagnosis, prescriber, clinic, follow-up date.',
  },
  {
    n: '03',
    title: 'Organized in your vault',
    body: 'Every prescription lives in a searchable, filterable digital vault — with the raw scan text kept as a fallback, always.',
  },
]

export function HowItWorks() {
  const pathRef = useRef<SVGPathElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // Scroll-drawn hairline path connecting the steps
  useEffect(() => {
    const path = pathRef.current
    const section = sectionRef.current
    if (!path || !section) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`

    const ctx = gsap.context(() => {
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: 0.6,
        },
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative mx-auto max-w-6xl px-6 py-40"
    >
      <Reveal>
        <p
          data-reveal
          className="font-mono text-xs uppercase tracking-[0.25em] text-primary"
        >
          How it works
        </p>
        <h2
          data-reveal
          className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight md:text-5xl"
        >
          From paper to structured data in three steps.
        </h2>
      </Reveal>

      <div className="relative mt-24">
        {/* scroll-drawn connector path */}
        <svg
          className="pointer-events-none absolute left-[7px] top-2 hidden h-full w-8 md:block"
          viewBox="0 0 32 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            ref={pathRef}
            d="M 16 0 L 16 900"
            stroke="url(#hw-grad)"
            strokeWidth="1"
            fill="none"
          />
          <defs>
            <linearGradient id="hw-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d9488" />
              <stop offset="1" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex flex-col gap-28">
          {steps.map((step, i) => (
            <Reveal
              key={step.n}
              className={`md:w-1/2 ${i % 2 === 1 ? 'md:ml-auto' : 'md:pl-16'}`}
            >
              <div data-reveal className="flex items-baseline gap-4">
                <span className="font-mono text-sm text-primary">{step.n}</span>
                <div className="hairline w-16 self-center" />
              </div>
              <h3
                data-reveal
                className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl"
              >
                {step.title}
              </h3>
              <p
                data-reveal
                className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground"
              >
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
