'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-background/85 backdrop-blur-sm' : 'bg-transparent'
      }`}
    >
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"
        aria-label="Main"
      >
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-lg font-semibold tracking-tight">Rxify</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
            Rx
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="link-underline hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="link-underline hover:text-foreground">
            Features
          </a>
          <a href="#for-doctors" className="link-underline hover:text-foreground">
            For doctors
          </a>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="link-underline text-sm text-muted-foreground hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="gradient-cta rounded-full px-4 py-2 text-sm font-medium"
          >
            Get started
          </Link>
        </div>
      </nav>
      <div className="hairline" />
    </header>
  )
}
