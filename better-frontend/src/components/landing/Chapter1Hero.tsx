import { useRef, useEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FileText,
  FlaskConical,
  Pill,
  ScanLine,
  Syringe,
  Heart,
  ClipboardList,
  Stethoscope,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);


export default function Chapter1Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sphereRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMouse({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const content = contentRef.current;
      const sphere = sphereRef.current;
      const scrollIndicator = scrollIndicatorRef.current;
      if (!section || !content || !sphere || !scrollIndicator) return;

      /* ── Text reveal (entrance, not scroll-driven) ── */
      gsap.fromTo(
        '.ch1-line',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.2,
          ease: 'power3.out',
          delay: 0.3,
        }
      );

      /* ── Sphere entrance ── */
      gsap.fromTo(
        sphere,
        { opacity: 0, scale: 0.7 },
        { opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out', delay: 0.1 }
      );

      /* ── Scroll: fade out content and sphere together ── */
      const scrollOutTL = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '50% top',
          scrub: 1.5,
        },
      });

      scrollOutTL
        .to(content, { y: -80, opacity: 0, scale: 0.96, ease: 'none' }, 0)
        .to(sphere, { y: -140, opacity: 0, scale: 0.85, ease: 'none' }, 0);

      /* ── Scroll indicator fades immediately ── */
      gsap.to(scrollIndicator, {
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '15% top',
          scrub: 1,
        },
        opacity: 0,
        y: 16,
        ease: 'none',
      });
    },
    { scope: sectionRef }
  );

  const rotateX = (mouse.y - 0.5) * 15;
  const rotateY = (mouse.x - 0.5) * 15;

  return (
    <section ref={sectionRef} className="chapter ch1-hero">
      {/* Cursor glow */}
      <div
        className="ch1-cursor-glow"
        style={
          {
            '--glow-x': `${mouse.x * 100}%`,
            '--glow-y': `${mouse.y * 100}%`,
          } as React.CSSProperties
        }
      />

      {/* Sphere */}
      <div
        ref={sphereRef}
        className="ch1-sphere-container"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="ch1-sphere-glow" />
        <div className="ch1-core" />

        {/* Orbit 1 */}
        <div className="ch1-orbit ch1-orbit-1">
          <div className="ch1-orbit-item">
            <FileText size={22} />
          </div>
          <div className="ch1-orbit-item">
            <FlaskConical size={22} />
          </div>
          <div className="ch1-orbit-item">
            <ScanLine size={22} />
          </div>
        </div>

        {/* Orbit 2 */}
        <div className="ch1-orbit ch1-orbit-2">
          <div className="ch1-orbit-item">
            <Pill size={22} />
          </div>
          <div className="ch1-orbit-item">
            <Syringe size={22} />
          </div>
          <div className="ch1-orbit-item">
            <Heart size={22} />
          </div>
        </div>

        {/* Orbit 3 */}
        <div className="ch1-orbit ch1-orbit-3">
          <div className="ch1-orbit-item">
            <ClipboardList size={22} />
          </div>
          <div className="ch1-orbit-item">
            <Stethoscope size={22} />
          </div>
        </div>
      </div>

      {/* Headline */}
      <div ref={contentRef} className="ch1-content">
        <div className="ch1-headline">
          <h1>
            <span className="ch1-line">Healthcare isn't broken.</span>
            <span className="ch1-line accent">It's disconnected.</span>
          </h1>
        </div>
      </div>

      {/* Scroll indicator */}
      <div ref={scrollIndicatorRef} className="ch1-scroll-indicator">
        <span>Scroll to explore</span>
        <div className="ch1-scroll-line" />
      </div>
    </section>
  );
}
