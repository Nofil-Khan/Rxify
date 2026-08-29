import { useRef, useMemo } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Cpu, Database, Network, Sparkles, Activity, FileSearch, ShieldCheck } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface NodeData {
  id: number;
  x: number;
  y: number;
  r: number;
  label?: string;
  category: 'core' | 'processor' | 'entity' | 'signal';
  icon?: any;
}

interface EdgeData {
  id: string;
  d: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  length: number;
}

export default function Chapter4AIBrain() {
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Generate structured, sophisticated brain network layout with curved synapses
  const { nodes, edges, pulses, coreModules } = useMemo(() => {
    const coreX = 450;
    const coreY = 230;

    const nodeList: NodeData[] = [
      { id: 0, x: coreX, y: coreY, r: 28, category: 'core', label: 'Gemini Medical Core', icon: Brain },
    ];

    // Inner processing ring (5 nodes around core)
    const innerModules = [
      { name: 'Vision OCR Engine', icon: FileSearch },
      { name: 'Entity Normalizer', icon: Cpu },
      { name: 'Knowledge Graph', icon: Network },
      { name: 'Vector RAG Index', icon: Database },
      { name: 'Safety Guardrails', icon: ShieldCheck },
    ];

    const innerRadius = 140;
    innerModules.forEach((mod, i) => {
      const angle = (i / innerModules.length) * Math.PI * 2 - Math.PI / 2;
      nodeList.push({
        id: i + 1,
        x: coreX + Math.cos(angle) * innerRadius,
        y: coreY + Math.sin(angle) * innerRadius * 0.85,
        r: 16,
        category: 'processor',
        label: mod.name,
        icon: mod.icon,
      });
    });

    // Outer peripheral knowledge nodes (18 organic nodes forming a brain cortex outline)
    const outerRadiusX = 360;
    const outerRadiusY = 200;
    const outerCount = 18;

    for (let i = 0; i < outerCount; i++) {
      const angle = (i / outerCount) * Math.PI * 2;
      // Slight organic distortion for brain silhouette
      const radiusVariation = Math.sin(i * 1.7) * 25;
      const rx = outerRadiusX + radiusVariation;
      const ry = outerRadiusY + radiusVariation * 0.6;
      
      nodeList.push({
        id: innerModules.length + 1 + i,
        x: coreX + Math.cos(angle) * rx,
        y: coreY + Math.sin(angle) * ry,
        r: 5 + (i % 3) * 2,
        category: 'entity',
      });
    }

    // Build organic curved Bezier edges (no straight lines!)
    const edgeList: EdgeData[] = [];
    const pulseList: { pathD: string; delay: number; duration: number }[] = [];

    // Connect core to inner processors
    for (let i = 1; i <= innerModules.length; i++) {
      const n = nodeList[i];
      const cx = (coreX + n.x) / 2 + (i % 2 === 0 ? 25 : -25);
      const cy = (coreY + n.y) / 2 + (i % 2 === 0 ? -20 : 20);
      const d = `M ${coreX} ${coreY} Q ${cx} ${cy} ${n.x} ${n.y}`;

      edgeList.push({
        id: `c-in-${i}`,
        d,
        fromX: coreX,
        fromY: coreY,
        toX: n.x,
        toY: n.y,
        length: Math.hypot(n.x - coreX, n.y - coreY) * 1.15,
      });

      pulseList.push({
        pathD: d,
        delay: i * 0.4,
        duration: 2.2 + (i % 3) * 0.4,
      });
    }

    // Connect inner processors to outer cortex nodes (multiple curves per processor)
    const processorCount = innerModules.length;
    for (let p = 1; p <= processorCount; p++) {
      const proc = nodeList[p];
      // Each processor connects to 3-4 outer nodes
      for (let offset = -1; offset <= 2; offset++) {
        const outerIndex = (p * 3 + offset + outerCount) % outerCount;
        const outerNode = nodeList[processorCount + 1 + outerIndex];
        
        // Control point for smooth curved synapse
        const midX = (proc.x + outerNode.x) / 2;
        const midY = (proc.y + outerNode.y) / 2;
        const perpX = -(outerNode.y - proc.y) * 0.25;
        const perpY = (outerNode.x - proc.x) * 0.25;
        const cx = midX + perpX;
        const cy = midY + perpY;

        const d = `M ${proc.x} ${proc.y} Q ${cx} ${cy} ${outerNode.x} ${outerNode.y}`;

        edgeList.push({
          id: `in-out-${p}-${outerIndex}`,
          d,
          fromX: proc.x,
          fromY: proc.y,
          toX: outerNode.x,
          toY: outerNode.y,
          length: Math.hypot(outerNode.x - proc.x, outerNode.y - proc.y) * 1.2,
        });

        if (offset % 2 === 0) {
          pulseList.push({
            pathD: d,
            delay: 1.5 + (p + offset) * 0.3,
            duration: 2.8 + (offset + 2) * 0.5,
          });
        }
      }
    }

    // Cross-cortex inter-synapses (adds high-tech mesh feel)
    for (let i = 0; i < outerCount; i += 2) {
      const n1 = nodeList[processorCount + 1 + i];
      const n2 = nodeList[processorCount + 1 + ((i + 3) % outerCount)];
      const cx = coreX + (Math.random() - 0.5) * 80;
      const cy = coreY + (Math.random() - 0.5) * 80;
      const d = `M ${n1.x} ${n1.y} Q ${cx} ${cy} ${n2.x} ${n2.y}`;

      edgeList.push({
        id: `cross-${i}`,
        d,
        fromX: n1.x,
        fromY: n1.y,
        toX: n2.x,
        toY: n2.y,
        length: Math.hypot(n2.x - n1.x, n2.y - n1.y) * 1.3,
      });
    }

    return {
      nodes: nodeList,
      edges: edgeList,
      pulses: pulseList,
      coreModules: innerModules,
    };
  }, []);

  const ENTITIES = [
    { label: 'Symptoms & Vitals', icon: Activity },
    { label: 'Rx & Active Ingredients', icon: Sparkles },
    { label: 'Diagnoses & Conditions', icon: Brain },
    { label: 'Drug-Drug Interactions', icon: ShieldCheck },
    { label: 'Lab Biomarkers', icon: Database },
    { label: 'Dosage Timelines', icon: Cpu },
  ];

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      /* ── Timeline for Brain Activation ── */
      const brainTL = gsap.timeline({
        scrollTrigger: {
          trigger: '.ch4-network',
          start: 'top 75%',
          end: 'bottom 40%',
          scrub: 1,
        },
      });

      // 1. Central core ignites & scales up
      brainTL.fromTo(
        '.ch4-core-group',
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' },
        0
      );

      // 2. Curved Synapse paths draw out smoothly
      const pathEls = gsap.utils.toArray<SVGPathElement>('.ch4-synapse-path');
      pathEls.forEach((path) => {
        const len = path.getTotalLength();
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len}`;
      });

      brainTL.to(
        pathEls,
        {
          strokeDashoffset: 0,
          stagger: 0.02,
          duration: 1.5,
          ease: 'power2.inOut',
        },
        0.3
      );

      // 3. Processor nodes reveal
      brainTL.fromTo(
        '.ch4-proc-node',
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'back.out(1.5)' },
        0.5
      );

      // 4. Cortex outer nodes pop in
      brainTL.fromTo(
        '.ch4-cortex-node',
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, stagger: 0.03, duration: 0.5, ease: 'power2.out' },
        0.8
      );

      // 5. Signal pulses light up along curved paths
      brainTL.to(
        '.ch4-pulse-dot',
        { opacity: 1, duration: 0.4 },
        1.2
      );

      // 6. Entity cards reveal at bottom
      gsap.fromTo(
        '.ch4-entity-card',
        { opacity: 0, y: 25, scale: 0.92 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch4-entities',
            start: 'top 82%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      // 7. Headline reveal
      gsap.fromTo(
        '.ch4-headline',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.ch4-headline',
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="chapter ch4-brain">
      <div className="section-badge ch4-badge">Chapter 04 — The AI Brain</div>

      {/* Headline Header */}
      <div className="ch4-header">
        <h2 className="chapter-headline">
          Multimodal AI Neural <span className="accent">Knowledge Engine</span>
        </h2>
        <p className="chapter-subtitle">
          Gemini Vision & RAG parse unstructured medical records into a dynamic 3D clinical graph.
        </p>
      </div>

      {/* Advanced Neural Brain Visualization */}
      <div className="ch4-network">
        <svg ref={svgRef} viewBox="0 0 900 460" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradient definition for neural connections */}
            <linearGradient id="synapseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.8" />
              <stop offset="50%" stopColor="var(--blue)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--teal-light)" stopOpacity="0.2" />
            </linearGradient>

            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.25" />
              <stop offset="70%" stopColor="var(--blue)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Concentric Cortex Rings */}
          <circle cx="450" cy="230" r="220" className="ch4-cortex-ring ring-outer" />
          <circle cx="450" cy="230" r="140" className="ch4-cortex-ring ring-mid" />
          <circle cx="450" cy="230" r="70" className="ch4-cortex-ring ring-inner" />

          {/* Curved Bezier Synapse Lines */}
          <g className="ch4-synapses">
            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                className="ch4-synapse-path"
              />
            ))}
          </g>

          {/* Flowing Data Signal Pulses */}
          <g className="ch4-pulses">
            {pulses.map((pulse, idx) => (
              <circle key={`pulse-${idx}`} r="3.5" className="ch4-pulse-dot">
                <animateMotion
                  path={pulse.pathD}
                  dur={`${pulse.duration}s`}
                  repeatCount="indefinite"
                  begin={`${pulse.delay}s`}
                />
              </circle>
            ))}
          </g>

          {/* Outer Cortex Nodes */}
          <g className="ch4-cortex-nodes">
            {nodes
              .filter((n) => n.category === 'entity')
              .map((node) => (
                <g key={`node-${node.id}`} className="ch4-cortex-node" transform={`translate(${node.x}, ${node.y})`}>
                  <circle r={node.r + 3} className="ch4-node-halo" />
                  <circle r={node.r} className="ch4-node-dot" />
                </g>
              ))}
          </g>

          {/* Inner Processor Modules */}
          <g className="ch4-processors">
            {nodes
              .filter((n) => n.category === 'processor')
              .map((node) => {
                const IconComponent = node.icon;
                return (
                  <g key={`proc-${node.id}`} className="ch4-proc-node" transform={`translate(${node.x}, ${node.y})`}>
                    <rect x="-24" y="-24" width="48" height="48" rx="14" className="ch4-proc-bg" />
                    <foreignObject x="-14" y="-14" width="28" height="28">
                      <div className="ch4-proc-icon-wrap">
                        {IconComponent && <IconComponent size={18} />}
                      </div>
                    </foreignObject>
                    <text y="38" className="ch4-proc-label">
                      {node.label}
                    </text>
                  </g>
                );
              })}
          </g>

          {/* Central Neural Brain Core */}
          <g className="ch4-core-group" transform="translate(450, 230)">
            <circle r="75" fill="url(#coreGlow)" />
            <circle r="42" className="ch4-core-ring-pulse" />
            <rect x="-32" y="-32" width="64" height="64" rx="20" className="ch4-core-box" />
            <foreignObject x="-20" y="-20" width="40" height="40">
              <div className="ch4-core-icon">
                <Brain size={28} />
              </div>
            </foreignObject>
          </g>
        </svg>
      </div>

      {/* Extracted Medical Entity Cards */}
      <div className="ch4-entities">
        {ENTITIES.map(({ label, icon: Icon }) => (
          <div key={label} className="ch4-entity-card glass-card">
            <div className="ch4-entity-icon">
              <Icon size={18} />
            </div>
            <span className="ch4-entity-text">{label}</span>
          </div>
        ))}
      </div>

      {/* Bottom Punchline */}
      <div className="ch4-headline" style={{ opacity: 0 }}>
        <h3 className="chapter-headline" style={{ fontSize: '1.8rem', marginTop: '3rem' }}>
          Scattered health records transformed into structured <span className="accent">Medical Intelligence.</span>
        </h3>
      </div>
    </section>
  );
}
