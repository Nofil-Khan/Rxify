import * as React from 'react';
import { useDispensaryWorkspace } from './useDispensaryWorkspace';

export interface PipelineStageCounts {
  newCount: number;
  preparingCount: number;
  readyCount: number;
  completedCount: number;
}

export function usePipelineCounts(): PipelineStageCounts {
  const { prescriptions, pipelineStats } = useDispensaryWorkspace();

  return React.useMemo(() => {
    let pendingCount = 0;
    let processingCount = 0;
    let readyCount = 0;
    let completedCount = 0;

    for (const rx of prescriptions) {
      if (rx.status === 'PENDING') pendingCount += 1;
      else if (rx.status === 'PROCESSING') processingCount += 1;
      else if (rx.status === 'READY') readyCount += 1;
      else if (rx.status === 'DISPENSED') completedCount += 1;
    }

    return {
      newCount: Math.max(pipelineStats.newCount, pendingCount),
      preparingCount: Math.max(pipelineStats.preparingCount, processingCount),
      readyCount: Math.max(pipelineStats.readyCount, readyCount),
      completedCount: Math.max(pipelineStats.completedCount, completedCount),
    };
  }, [prescriptions, pipelineStats]);
}

export default usePipelineCounts;

