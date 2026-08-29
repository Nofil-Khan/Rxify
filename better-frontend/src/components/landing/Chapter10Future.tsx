import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Hospital,
  Stethoscope,
  FlaskConical,
  ActivitySquare,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

gsap.registerPlugin(ScrollTrigger);

const NODES = [
  { icon: Hospital, label: 'Hospitals', angle: 0 },
  { icon: Stethoscope, label: 'Doctors', angle: 60 },
  { icon: FlaskConical, label: 'Labs', angle: 120 },
  { icon: ActivitySquare, label: 'Wearables', angle: 180 },
  { icon: ShieldCheck, label: 'Insurance', angle: 240 },
  { icon: Bot, label: 'Personal AI', angle: 300 },
];

export default function Chapter10Future() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      /* ── Ecosystem nodes ── */
      const nodes = gsap.utils.toArray<HTMLElement>('.ch10-node');
      const lines = gsap.utils.toArray<HTMLElement>('.ch10-connection');

      nodes.forEach((node, i) => {
        gsap.to(node, {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: 'back.out(1.5)',
          scrollTrigger: {
            trigger: '.ch10-ecosystem',
            start: 'top 60%',
            toggleActions: 'play none none reverse',
          },
          delay: i * 0.1,
        });

        if (lines[i]) {
          gsap.to(lines[i], {
            opacity: 1,
            width: 'calc(50% - 45px)', // connect to center hub
            duration: 0.5,
            scrollTrigger: {
              trigger: '.ch10-ecosystem',
              start: 'top 60%',
              toggleActions: 'play none none reverse',
            },
            delay: i * 0.1,
          });
        }
      });

      /* ── Text & CTA ── */
      gsap.fromTo(
        '.ch10-headline',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch10-headline',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      gsap.fromTo(
        '.ch10-cta',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          delay: 0.2,
          scrollTrigger: {
            trigger: '.ch10-headline',
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch10-future">
      <div className="section-badge">Chapter 10 — The Future</div>

      <div className="ch10-ecosystem">
        {/* Center Hub */}
        <div className="ch10-center-hub">
          <div className="ch10-hub-label">Rxify<br/>Core</div>
        </div>

        {/* Nodes */}
        {NODES.map(({ icon: Icon, label, angle }, i) => {
          // Calculate position around a circle
          const radius = 160; // distance from center
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;

          return (
            <div key={label}>
              {/* Connection Line */}
              <div
                className="ch10-connection"
                style={{
                  transform: `rotate(${angle}deg)`,
                  width: '0px',
                }}
              />
              {/* Node */}
              <div
                className="ch10-node"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%) scale(0.5)',
                }}
              >
                <Icon className="ch10-node-icon" size={24} />
                <span className="ch10-node-label">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ch10-headline">
        <h2 className="chapter-headline">
          Healthcare that <span className="accent">remembers.</span>
          <br />
          AI that <span className="accent">understands.</span>
        </h2>
      </div>

      <div className="ch10-cta">
        <Link to="/login" className="btn-primary ch10-cta-btn">
          <span>Start Building Your Health Story</span>
        </Link>
      </div>
    </section>
  );
}
