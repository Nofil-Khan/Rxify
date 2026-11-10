import * as React from 'react';
import { FileText, Package, ShoppingBag, CheckCircle2, ChevronRight } from 'lucide-react';
import GlassPanel from './GlassPanel';
import { usePipelineCounts } from '../hooks/usePipelineCounts';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

interface StageConfig {
  id: string;
  label: string;
  description: string;
  statusFilter: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

export const WorkflowPipelinePanel: React.FC = () => {
  const counts = usePipelineCounts();
  const { statusFilter, setStatusFilter } = useDispensaryWorkspace();

  const stages: StageConfig[] = React.useMemo(
    () => [
      { id: 'new', label: 'New', description: 'Awaiting triage & prep', statusFilter: 'PENDING', icon: FileText, count: counts.newCount },
      { id: 'preparing', label: 'Preparing', description: 'In dispensary fulfillment', statusFilter: 'PROCESSING', icon: Package, count: counts.preparingCount },
      { id: 'ready', label: 'Ready', description: 'Awaiting patient pickup', statusFilter: 'READY', icon: ShoppingBag, count: counts.readyCount },
      { id: 'completed', label: 'Completed', description: 'Dispensed & archived', statusFilter: 'DISPENSED', icon: CheckCircle2, count: counts.completedCount },
    ],
    [counts]
  );

  const activeStageId = React.useMemo(() => {
    if (statusFilter === 'PROCESSING') return 'preparing';
    if (statusFilter === 'READY') return 'ready';
    if (statusFilter === 'DISPENSED') return 'completed';
    return 'new';
  }, [statusFilter]);

  const totalActive = counts.newCount + counts.preparingCount + counts.readyCount;

  return (
    <GlassPanel
      tilt="right"
      tabIndex={0}
      data-testid="slot-pipeline-panel"
      className="relative flex h-full min-w-0 flex-col justify-between p-5 lg:p-6 overflow-hidden border-mint-400/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400"
      aria-label="Workflow Pipeline Stages"
    >
      {/* Top Header */}
      <div className="flex flex-col gap-1 z-20 border-b border-mint-400/15 pb-4">
        <div className="flex items-center justify-between">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-cream-to/70">
            WORKFLOW PIPELINE
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-mint-400/15 text-mint-300 border border-mint-400/20">
            {totalActive} Active
          </span>
        </div>
        <h2 className="font-serif text-2xl font-bold text-cream-from tracking-tight">
          Order Stages
        </h2>
        <p className="text-xs text-cream-to/60">
          Filter dispensary queues by order status.
        </p>
      </div>

      {/* Stage Cards List */}
      <div className="flex flex-col gap-2.5 my-auto z-20 py-2">
        {stages.map((stage) => {
          const isActive = activeStageId === stage.id;
          const Icon = stage.icon;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setStatusFilter(stage.statusFilter)}
              className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-mint-400 focus-visible:outline-none ${
                isActive
                  ? 'border-mint-400/60 bg-mint-950/40 shadow-glow-mint'
                  : 'border-mint-400/15 bg-bg-0/40 hover:border-mint-400/35 hover:bg-bg-0/70'
              }`}
              aria-label={`Filter by ${stage.label} stage (${stage.count} items)`}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    isActive
                      ? 'border-mint-400/40 bg-mint-400/20 text-mint-300'
                      : 'border-mint-400/15 bg-bg-1/60 text-emerald-200/60 group-hover:text-mint-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-cream-from'}`}>
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-cream-to/50 truncate">
                    {stage.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-2 shrink-0">
                <span
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-mint-400 text-bg-0 shadow-sm'
                      : 'bg-bg-1 border border-mint-400/20 text-cream-from/80'
                  }`}
                >
                  {stage.count}
                </span>
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    isActive ? 'text-mint-400 translate-x-0.5' : 'text-cream-to/30 group-hover:text-cream-to/60'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Summary Footer */}
      <div className="border-t border-mint-400/15 pt-3 flex items-center justify-between text-[11px] text-cream-to/50 z-20">
        <span>Click stage to switch queue</span>
        <span className="text-mint-300 font-semibold">{counts.completedCount} Dispensed Today</span>
      </div>
    </GlassPanel>
  );
};

export default WorkflowPipelinePanel;

