import * as React from 'react';
import { FileText, Package, ShoppingBag, CheckCircle2 } from 'lucide-react';
import PipelineArcCurve from './PipelineArcCurve';
import PipelineArcNode, { PipelineStageConfig } from './PipelineArcNode';
import { usePipelineCounts } from '../hooks/usePipelineCounts';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const PipelineArc: React.FC = () => {
  const counts = usePipelineCounts();
  const { statusFilter, setStatusFilter } = useDispensaryWorkspace();

  const stages: PipelineStageConfig[] = React.useMemo(
    () => [
      { id: 'new', label: 'New', statusFilter: 'PENDING', icon: FileText, count: counts.newCount },
      { id: 'preparing', label: 'Preparing', statusFilter: 'PROCESSING', icon: Package, count: counts.preparingCount },
      { id: 'ready', label: 'Ready', statusFilter: 'READY', icon: ShoppingBag, count: counts.readyCount },
      { id: 'completed', label: 'Completed', statusFilter: 'DISPENSED', icon: CheckCircle2, count: counts.completedCount },
    ],
    [counts]
  );

  const activeStageId = React.useMemo(() => {
    if (statusFilter === 'PROCESSING') return 'preparing';
    if (statusFilter === 'READY') return 'ready';
    if (statusFilter === 'DISPENSED') return 'completed';
    return 'new';
  }, [statusFilter]);

  const handleSelect = (stage: PipelineStageConfig) => {
    setStatusFilter(stage.statusFilter);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = stages.findIndex((s) => s.id === activeStageId);
    let nextIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % stages.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + stages.length) % stages.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = stages.length - 1;
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      handleSelect(stages[nextIndex]);
    }
  };

  return (
    <div
      className="pipeline-arc-container no-scrollbar"
      role="tablist"
      aria-label="Prescription Pipeline Stages"
      onKeyDown={handleKeyDown}
      data-testid="slot-pipeline-arc"
    >
      {/* Background Arc Curve with Glowing Pulse Dots */}
      <PipelineArcCurve />

      {/* 4 Arc Nodes */}
      {stages.map((stage, index) => {
        const isActive = activeStageId === stage.id;
        const verticalArcOffset = index === 0 || index === 3 ? 'arc-offset-bottom' : 'arc-offset-top';

        return (
          <div
            key={stage.id}
            className={`relative flex items-center justify-center transition-transform duration-300 ${verticalArcOffset}`}
          >
            <PipelineArcNode
              stage={stage}
              isActive={isActive}
              onSelect={handleSelect}
            />
          </div>
        );
      })}
    </div>
  );
};

export default PipelineArc;
