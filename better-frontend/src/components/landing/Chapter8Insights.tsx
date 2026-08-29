import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const METRICS = [
  { label: 'Health Score', value: 92, unit: '/ 100', type: 'circular' },
  { label: 'Blood Pressure', value: '118/75', unit: 'mmHg', type: 'line' },
  { label: 'Resting Heart Rate', value: 68, unit: 'bpm', type: 'bar' },
  { label: 'Medicine Adherence', value: 95, unit: '%', type: 'circular' },
  { label: 'BMI', value: 22.4, unit: '', type: 'line' },
  { label: 'Risk Trend', value: 'Low', unit: '', type: 'bar' },
];

export default function Chapter8Insights() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      /* ── Badge ── */
      gsap.fromTo(
        '.ch8-badge',
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

      /* ── Cards animate in ── */
      gsap.to('.ch8-card', {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.ch8-grid',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      /* ── Charts draw themselves ── */
      gsap.fromTo(
        '.ch8-chart-line',
        { strokeDasharray: 200, strokeDashoffset: 200 },
        {
          strokeDashoffset: 0,
          duration: 1.5,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch8-grid',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      /* ── Circular progress ── */
      const circles = gsap.utils.toArray<SVGPathElement>('.ch8-circular-fill');
      circles.forEach((circle, i) => {
        const value = i === 0 ? 92 : 95; // Health Score vs Adherence
        const circumference = 2 * Math.PI * 36;
        const offset = circumference - (value / 100) * circumference;
        
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${circumference}`;

        gsap.to(circle, {
          strokeDashoffset: offset,
          duration: 1.5,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch8-grid',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        });
      });

      /* ── Bars grow ── */
      const bars = gsap.utils.toArray<SVGRectElement>('.ch8-bar');
      bars.forEach((bar) => {
        const targetHeight = bar.getAttribute('data-height') || '0';
        const targetY = bar.getAttribute('data-y') || '0';
        
        gsap.fromTo(
          bar,
          { height: 0, y: 60 },
          {
            height: targetHeight,
            y: targetY,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: {
              trigger: '.ch8-grid',
              start: 'top 80%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch8-insights">
      <div className="section-badge ch8-badge">Chapter 08 — Insights</div>

      <h2 className="chapter-headline">
        Understand your <span className="accent">body.</span>
      </h2>
      <p className="chapter-subtitle">
        Your data is transformed into beautiful, actionable insights. Track trends, monitor vitals, and predict risks.
      </p>

      <div className="ch8-grid">
        {METRICS.map((metric, i) => (
          <div key={metric.label} className="ch8-card glass-card">
            <div className="ch8-card-label">{metric.label}</div>
            <div className="ch8-card-value">
              {metric.value}
              {metric.unit && <span className="unit">{metric.unit}</span>}
            </div>

            {/* Render different chart types based on metric.type */}
            {metric.type === 'line' && (
              <div className="ch8-chart">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="ch8-chart-area"
                    d={i === 1 ? 'M0,40 L0,20 Q10,10 20,25 T40,15 T60,30 T80,10 T100,20 L100,40 Z' : 'M0,40 L0,30 Q20,20 40,35 T80,25 T100,15 L100,40 Z'}
                  />
                  <path
                    className="ch8-chart-line"
                    d={i === 1 ? 'M0,20 Q10,10 20,25 T40,15 T60,30 T80,10 T100,20' : 'M0,30 Q20,20 40,35 T80,25 T100,15'}
                  />
                </svg>
              </div>
            )}

            {metric.type === 'circular' && (
              <div className="ch8-chart" style={{ height: '80px', display: 'flex', justifyContent: 'center' }}>
                <svg className="ch8-circular" viewBox="0 0 80 80">
                  <circle className="ch8-circular-track" cx="40" cy="40" r="36" />
                  <circle className="ch8-circular-fill" cx="40" cy="40" r="36" />
                </svg>
              </div>
            )}

            {metric.type === 'bar' && (
              <div className="ch8-chart">
                <svg viewBox="0 0 100 60" preserveAspectRatio="none">
                  {[40, 30, 45, 25, 50].map((h, idx) => (
                    <rect
                      key={idx}
                      className="ch8-bar active"
                      x={idx * 20 + 2}
                      width="16"
                      data-height={h}
                      data-y={60 - h}
                    />
                  ))}
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
