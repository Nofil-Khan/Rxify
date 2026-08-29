import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Search,
  Cpu,
  Database,
  FileSearch,
  Brain,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const SEARCH_TEXT = 'Show my diabetes reports from last year';

const PIPELINE = [
  { icon: Cpu, label: 'Embedding Created' },
  { icon: Database, label: 'Vector Search' },
  { icon: FileSearch, label: 'Relevant Records Found' },
  { icon: Brain, label: 'Gemini Reads Context' },
  { icon: MessageSquare, label: 'Natural Language Answer' },
];

const RESULTS = [
  { type: 'Lab Report', title: 'HbA1c Test — 5.4%', date: 'Mar 2, 2024' },
  { type: 'Lab Report', title: 'Fasting Glucose — 92 mg/dL', date: 'Sep 15, 2023' },
  { type: 'Prescription', title: 'Metformin 500mg — Review', date: 'Oct 8, 2023' },
];

export default function Chapter7Search() {
  const sectionRef = useRef<HTMLElement>(null);
  const [typedSearch, setTypedSearch] = useState('');

  const startTyping = (text: string) => {
    setTypedSearch('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedSearch(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 45);
    return () => clearInterval(interval);
  };

  useGSAP(
    () => {
      /* ── Badge ── */
      gsap.fromTo(
        '.ch7-badge',
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

      /* ── Search bar with typing ── */
      let cleanup: (() => void) | undefined;
      gsap.to('.ch7-search-bar', {
        opacity: 1,
        y: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: '.ch7-search-bar',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
          onEnter: () => {
            cleanup = startTyping(SEARCH_TEXT);
          },
          onLeaveBack: () => {
            if (cleanup) cleanup();
            setTypedSearch('');
          },
        },
      });

      /* ── Pipeline steps ── */
      const steps = gsap.utils.toArray<HTMLElement>('.ch7-pipe-step');
      const arrows = gsap.utils.toArray<HTMLElement>('.ch7-pipe-arrow');

      steps.forEach((step, i) => {
        gsap.to(step, {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch7-pipeline',
            start: `${i * 6}% 80%`,
            toggleActions: 'play none none reverse',
            onEnter: () => step.classList.add('active'),
            onLeaveBack: () => step.classList.remove('active'),
          },
        });

        if (arrows[i]) {
          gsap.to(arrows[i], {
            opacity: 0.5,
            duration: 0.3,
            scrollTrigger: {
              trigger: '.ch7-pipeline',
              start: `${i * 6 + 3}% 80%`,
              toggleActions: 'play none none reverse',
            },
          });
        }
      });

      /* ── Result cards ── */
      gsap.to('.ch7-result-card', {
        opacity: 1,
        scale: 1,
        stagger: 0.15,
        duration: 0.5,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.ch7-results',
          start: 'top 85%',
          toggleActions: 'play none none reverse',
          onEnter: () => {
            setTimeout(() => {
              document.querySelectorAll('.ch7-result-card').forEach((el) =>
                el.classList.add('glowing')
              );
            }, 600);
          },
          onLeaveBack: () => {
            document.querySelectorAll('.ch7-result-card').forEach((el) =>
              el.classList.remove('glowing')
            );
          },
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch7-search">
      <div className="section-badge ch7-badge">
        Chapter 07 — RAG Search
      </div>

      <h2 className="chapter-headline">
        Ask anything about your <span className="accent">health.</span>
      </h2>
      <p className="chapter-subtitle">
        Search your entire medical history using natural language. The AI
        retrieves relevant records and answers in context.
      </p>

      {/* Search bar */}
      <div className="ch7-search-bar glass-card">
        <Search size={20} className="search-icon" />
        <div className="ch7-search-text">
          {typedSearch}
          {typedSearch.length < SEARCH_TEXT.length && typedSearch.length > 0 && (
            <span className="ch5-cursor-blink" />
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div className="ch7-pipeline">
        {PIPELINE.map(({ icon: Icon, label }, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="ch7-pipe-step">
              <Icon size={14} />
              {label}
            </div>
            {i < PIPELINE.length - 1 && (
              <ChevronRight size={14} className="ch7-pipe-arrow" />
            )}
          </div>
        ))}
      </div>

      {/* Results */}
      <div className="ch7-results">
        {RESULTS.map(({ type, title, date }) => (
          <div key={title} className="ch7-result-card glass-card">
            <div className="ch7-result-type">{type}</div>
            <div className="ch7-result-title">{title}</div>
            <div className="ch7-result-date">{date}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
