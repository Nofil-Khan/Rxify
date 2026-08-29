import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Upload,
  ScanLine,
  FileText,
  Tag,
  CalendarCheck,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { icon: Upload, title: 'Upload', desc: 'Drop a prescription image' },
  { icon: ScanLine, title: 'OCR Scan', desc: 'Gemini Vision reads every word' },
  { icon: FileText, title: 'Text Extraction', desc: 'Characters recognized and parsed' },
  { icon: Tag, title: 'Medical Entities', desc: 'Medicines, dosages, diagnoses identified' },
  { icon: CalendarCheck, title: 'Timeline Created', desc: 'Organized into your health history' },
];

export default function Chapter3Upload() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      /* ── Prescription card entrance ── */
      gsap.fromTo(
        '.ch3-rx-card',
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch3-rx-card',
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      /* ── Steps animate as they enter viewport ── */
      const steps = gsap.utils.toArray<HTMLElement>('.ch3-step');
      const connectors = gsap.utils.toArray<HTMLElement>('.ch3-connector');

      steps.forEach((step, i) => {
        // Animate step in when IT enters the viewport
        gsap.fromTo(
          step,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: step,
              start: 'top 80%',
              toggleActions: 'play none none reverse',
              onEnter: () => step.classList.add('active'),
              onLeaveBack: () => step.classList.remove('active'),
            },
          }
        );

        // Connector fills after step is visible
        if (connectors[i]) {
          ScrollTrigger.create({
            trigger: step,
            start: 'top 75%',
            onEnter: () => connectors[i].classList.add('active'),
            onLeaveBack: () => connectors[i].classList.remove('active'),
          });
        }
      });

      /* ── Badge reveal ── */
      gsap.fromTo(
        '.ch3-badge',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch3-upload">
      <div className="ch3-inner">
        <div className="section-badge ch3-badge">Chapter 03 — The Upload</div>

        {/* Prescription card */}
        <div className="ch3-rx-card glass-card">
          <div className="ch3-rx-header">
            <div className="ch3-rx-icon">
              <FileText size={20} />
            </div>
            <div>
              <div className="ch3-rx-title">Dr. Ananya Sharma</div>
              <div className="ch3-rx-meta">City Care Clinic · 24 Jan 2025</div>
            </div>
          </div>
          <div className="ch3-rx-body">
            <span className="highlight">Rx:</span> Amoxicillin 500mg — 1-0-1 × 5 days
            <br />
            <span className="highlight">Dx:</span> Upper Respiratory Tract Infection
            <br />
            <span className="highlight">F/U:</span> 29 Jan 2025
            <br />
            <span className="highlight">Note:</span> Avoid cold drinks. Rest advised.
          </div>
        </div>

        {/* Pipeline */}
        <div className="ch3-pipeline">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title}>
              <div className="ch3-step">
                <div className="ch3-step-node">
                  <Icon size={22} />
                </div>
                <div className="ch3-step-content">
                  <div className="ch3-step-title">{title}</div>
                  <div className="ch3-step-desc">{desc}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="ch3-connector">
                  <div className="ch3-connector-fill" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
