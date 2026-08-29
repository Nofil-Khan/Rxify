import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Lock } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export default function Chapter9Privacy() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      /* ── Darken background and show cube ── */
      gsap.fromTo(
        '.ch9-privacy',
        { backgroundColor: 'transparent' },
        {
          backgroundColor: '#020508',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 50%',
            end: 'center center',
            scrub: 1,
          },
        }
      );

      gsap.fromTo(
        '.ch9-cube-container',
        { opacity: 0, scale: 0.5 },
        {
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 60%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      /* ── Text reveal ── */
      gsap.fromTo(
        '.ch9-text',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch9-text',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch9-privacy">
      <div className="ch9-cube-container">
        <div className="ch9-cube">
          <div className="ch9-face ch9-face-front"><Lock className="ch9-lock" size={32} /></div>
          <div className="ch9-face ch9-face-back"><Lock className="ch9-lock" size={32} /></div>
          <div className="ch9-face ch9-face-left"><Lock className="ch9-lock" size={32} /></div>
          <div className="ch9-face ch9-face-right"><Lock className="ch9-lock" size={32} /></div>
          <div className="ch9-face ch9-face-top"><Lock className="ch9-lock" size={32} /></div>
          <div className="ch9-face ch9-face-bottom"><Lock className="ch9-lock" size={32} /></div>
        </div>
        
        {/* Animated encryption scan lines */}
        <div className="ch9-shield-lines">
          <div className="ch9-shield-line" />
          <div className="ch9-shield-line" />
          <div className="ch9-shield-line" />
          <div className="ch9-shield-line" />
        </div>
      </div>

      <div className="ch9-text">
        <h2 className="chapter-headline">
          Your data belongs to <span className="accent">you.</span>
        </h2>
        <p className="chapter-subtitle" style={{ maxWidth: '500px', margin: '1rem auto' }}>
          Fully encrypted. Completely private. Share securely with your doctors, and revoke access at any time.
        </p>
      </div>
    </section>
  );
}
