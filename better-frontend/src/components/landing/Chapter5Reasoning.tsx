import { useRef, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const SYMPTOMS = ['Fever', 'Headache', 'Fatigue', 'Body Pain'];

const DISEASES = [
  { name: 'Influenza', confidence: 87 },
  { name: 'Dengue Fever', confidence: 42 },
  { name: 'Common Cold', confidence: 28 },
];

const AI_QUESTION = 'Do you also have chills? How many days have you had the fever?';

export default function Chapter5Reasoning() {
  const sectionRef = useRef<HTMLElement>(null);
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);

  /* Typing effect triggered by GSAP callback */
  const startTyping = (text: string) => {
    setShowCursor(true);
    setTypedText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 35);
    return () => clearInterval(interval);
  };

  useGSAP(
    () => {
      /* ── Badge ── */
      gsap.fromTo(
        '.ch5-badge',
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

      /* ── Symptoms flow in ── */
      const symptoms = gsap.utils.toArray<HTMLElement>('.ch5-symptom');
      const arrows = gsap.utils.toArray<HTMLElement>('.ch5-arrow');

      symptoms.forEach((symptom, i) => {
        gsap.to(symptom, {
          opacity: 1,
          x: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: `${25 + i * 8}% center`,
            toggleActions: 'play none none reverse',
          },
        });

        if (arrows[i]) {
          gsap.to(arrows[i], {
            opacity: 0.5,
            duration: 0.4,
            scrollTrigger: {
              trigger: sectionRef.current,
              start: `${28 + i * 8}% center`,
              toggleActions: 'play none none reverse',
            },
          });
        }
      });

      /* ── Disease cards ── */
      gsap.to('.ch5-disease-card', {
        opacity: 1,
        y: 0,
        stagger: 0.15,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.ch5-diseases',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
          onEnter: () => {
            setTimeout(() => {
              document.querySelectorAll('.ch5-confidence-fill').forEach((el) => {
                const target = el.getAttribute('data-value') || '0';
                (el as HTMLElement).style.width = `${target}%`;
              });
            }, 300);
          },
          onLeaveBack: () => {
            document.querySelectorAll('.ch5-confidence-fill').forEach((el) => {
              (el as HTMLElement).style.width = '0%';
            });
          },
        },
      });

      /* ── AI question with typing effect ── */
      let cleanup: (() => void) | undefined;
      gsap.to('.ch5-ai-question', {
        opacity: 1,
        duration: 0.5,
        scrollTrigger: {
          trigger: '.ch5-ai-question',
          start: 'top 85%',
          toggleActions: 'play none none reverse',
          onEnter: () => {
            cleanup = startTyping(AI_QUESTION);
          },
          onLeaveBack: () => {
            if (cleanup) cleanup();
            setTypedText('');
            setShowCursor(false);
          },
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch5-reasoning">
      <div className="section-badge ch5-badge">
        Chapter 05 — Intelligent Reasoning
      </div>

      <h2
        className="chapter-headline"
        style={{ marginBottom: '1rem' }}
      >
        AI connects the dots.
      </h2>
      <p className="chapter-subtitle">
        Instead of jumping to conclusions, the AI reasons through symptoms and
        asks intelligent follow-up questions.
      </p>

      {/* Symptoms flow */}
      <div className="ch5-flow">
        {SYMPTOMS.map((symptom, i) => (
          <div key={symptom}>
            <div className="ch5-symptom">
              <span className="ch5-symptom-dot" />
              {symptom}
            </div>
            {i < SYMPTOMS.length - 1 && <div className="ch5-arrow" />}
          </div>
        ))}
      </div>

      {/* Possible diseases */}
      <div className="ch5-diseases">
        {DISEASES.map(({ name, confidence }) => (
          <div key={name} className="ch5-disease-card glass-card">
            <div className="ch5-disease-name">{name}</div>
            <div className="ch5-confidence-bar">
              <div
                className="ch5-confidence-fill"
                data-value={confidence}
              />
            </div>
            <div className="ch5-confidence-value">{confidence}%</div>
          </div>
        ))}
      </div>

      {/* AI Question */}
      <div className="ch5-ai-question glass-card">
        <p>
          {typedText}
          {showCursor && <span className="ch5-cursor-blink" />}
        </p>
      </div>
    </section>
  );
}
