import { CtaFooter } from '@/components/landing/cta-footer'
import { Features } from '@/components/landing/features'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Nav } from '@/components/landing/nav'
import { PrescriptionSpecimen } from '@/components/landing/prescription-specimen'
import { LandingScene } from '@/components/landing/scene'
import { ShareTrust } from '@/components/landing/share-trust'
import { SmoothScroll } from '@/components/landing/smooth-scroll'

export default function Page() {
  return (
    <SmoothScroll>
      <LandingScene />
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <PrescriptionSpecimen />
        <ShareTrust />
        <CtaFooter />
      </main>
    </SmoothScroll>
  )
}
