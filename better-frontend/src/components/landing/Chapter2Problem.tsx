import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FileText,
  FlaskConical,
  Pill,
  CalendarX,
  ScanLine,
  ClipboardList,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const ITEMS = [
  { icon: FileText, label: 'Prescriptions', desc: 'Scattered across clinics' },
  { icon: FlaskConical, label: 'Lab Reports', desc: 'Lost in email chains' },
  { icon: ScanLine, label: 'Scans', desc: 'Buried in hospital portals' },
  { icon: Pill, label: 'Medicines', desc: 'Reminders forgotten' },
  { icon: CalendarX, label: 'Appointments', desc: 'Disconnected calendars' },
  { icon: ClipboardList, label: 'Records', desc: 'Locked in paper files' },
];

export default function Chapter2Problem() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const items = gsap.utils.toArray<HTMLElement>('.ch2-item');

      /* ── Unified scatter + vignette timeline ── */
      const scatterTL = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 10%',
          end: '60% top',
          scrub: 1.5,
        },
      });

      items.forEach((item, i) => {
        const angle = (i / items.length) * Math.PI * 2;
        const distance = 100 + i * 25;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const rot = (i % 2 === 0 ? 1 : -1) * (15 + i * 5);

        scatterTL.to(
          item,
          { x: tx, y: ty, rotation: rot, opacity: 0, scale: 0.65, ease: 'power2.in' },
          0 // all start simultaneously
        );
      });

      /* vignette synced to same trigger */
      scatterTL.to('.ch2-vignette', { opacity: 1, ease: 'none' }, 0);

      /* ── Headline reveals only after scatter window ends ── */
      gsap.fromTo(
        '.ch2-headline-block',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch2-headline-block',
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch2-problem">
      <div className="ch2-vignette" />

      <div className="section-badge">Chapter 02 — The Problem</div>

      <div className="ch2-items-grid">
        {ITEMS.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="ch2-item glass-card">
            <div className="ch2-item-icon">
              <Icon size={24} />
            </div>
            <span className="ch2-item-label">{label}</span>
            <span className="ch2-item-desc">{desc}</span>
          </div>
        ))}
      </div>

      <div className="ch2-headline-block">
        <h2 className="chapter-headline">
          Your medical history is everywhere…
          <br />
          <span className="accent">except where you need it.</span>
        </h2>
      </div>
    </section>
  );
}
