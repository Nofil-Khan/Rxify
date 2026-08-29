import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FileText,
  Pill,
  Stethoscope,
  Syringe,
  Activity,
  FlaskConical,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const ENTRIES = [
  {
    year: '2022',
    items: [
      { type: 'Report', title: 'Annual Blood Panel', meta: 'Feb 12 · City Lab', icon: FlaskConical },
      { type: 'Doctor Visit', title: 'Dr. Patel — General Checkup', meta: 'Mar 8 · HealthFirst Clinic', icon: Stethoscope },
    ],
  },
  {
    year: '2023',
    items: [
      { type: 'Prescription', title: 'Amoxicillin 500mg — 7 days', meta: 'Jan 15 · City Care', icon: FileText },
      { type: 'Vaccination', title: 'Influenza Vaccine', meta: 'Oct 22 · District Hospital', icon: Syringe },
      { type: 'Medicine', title: 'Cetirizine 10mg — PRN', meta: 'Nov 3 · Allergy Specialist', icon: Pill },
    ],
  },
  {
    year: '2024',
    items: [
      { type: 'Report', title: 'HbA1c Test — 5.4%', meta: 'Mar 2 · PathLab+', icon: FlaskConical },
      { type: 'Doctor Visit', title: 'Dr. Sharma — Follow-up', meta: 'Jun 18 · City Care', icon: Stethoscope },
      { type: 'Vitals', title: 'BP: 120/80 · HR: 72 bpm', meta: 'Jun 18 · Recorded', icon: Activity },
    ],
  },
  {
    year: 'Today',
    items: [
      { type: 'Prescription', title: 'New Upload — Processing', meta: 'Just now · AI analyzing', icon: FileText },
    ],
  },
];

export default function Chapter6Timeline() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      /* ── Badge ── */
      gsap.fromTo(
        '.ch6-badge',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      /* ── Headline ── */
      gsap.fromTo(
        '.ch6-headline',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: '.ch6-headline',
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      /* ── Center line fill ── */
      gsap.to('.ch6-center-line-fill', {
        height: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: '.ch6-line-container',
          start: 'top 70%',
          end: 'bottom 30%',
          scrub: 1,
        },
      });

      /* ── Entries slide in ── */
      const entries = gsap.utils.toArray<HTMLElement>('.ch6-entry');
      entries.forEach((entry) => {
        gsap.to(entry, {
          opacity: 1,
          x: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: entry,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      /* ── Year badges pop ── */
      gsap.utils.toArray<HTMLElement>('.ch6-year').forEach((yr) => {
        gsap.fromTo(
          yr,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.4,
            ease: 'back.out(1.7)',
            scrollTrigger: {
              trigger: yr,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  /* Flatten entries for rendering */
  const flatEntries: Array<{
    year?: string;
    type: string;
    title: string;
    meta: string;
    icon: typeof FileText;
  }> = [];
  ENTRIES.forEach((group) => {
    group.items.forEach((item, i) => {
      flatEntries.push({
        year: i === 0 ? group.year : undefined,
        ...item,
      });
    });
  });

  return (
    <section ref={sectionRef} className="chapter ch6-timeline">
      <div style={{ textAlign: 'center' }}>
        <div className="section-badge ch6-badge">
          Chapter 06 — Your Health Timeline
        </div>
        <div className="ch6-headline" style={{ opacity: 0 }}>
          <h2 className="chapter-headline">
            Every record. <span className="accent">One timeline.</span>
          </h2>
          <p className="chapter-subtitle">
            Reports, medicines, doctor visits, vaccinations — organized
            automatically into one continuous medical history.
          </p>
        </div>
      </div>

      <div className="ch6-line-container">
        <div className="ch6-center-line">
          <div className="ch6-center-line-fill" />
        </div>

        {flatEntries.map(({ year, type, title, meta, icon: Icon }, i) => (
          <div key={`${title}-${i}`}>
            {year && (
              <div className="ch6-year" style={{ position: 'relative', marginBottom: '2rem' }}>
                {year}
              </div>
            )}
            <div className="ch6-entry">
              <div className="ch6-entry-dot" />
              <div className="ch6-entry-content">
                <div className="ch6-entry-type">
                  <Icon size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {type}
                </div>
                <div className="ch6-entry-title">{title}</div>
                <div className="ch6-entry-meta">{meta}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
