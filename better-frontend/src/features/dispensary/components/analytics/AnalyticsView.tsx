import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDispensaryAnalytics } from '@/lib/dispensaryApi';
import AnalyticsKPIHeader from './AnalyticsKPIHeader';
import TopMedicinesLeaderboard from './TopMedicinesLeaderboard';
import CategoryDistributionCard from './CategoryDistributionCard';
import OrderVelocityCard from './OrderVelocityCard';

export const AnalyticsView: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['dispensary_analytics'],
    queryFn: () => fetchDispensaryAnalytics(30),
    staleTime: 60000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <div className="flex items-center gap-3 text-mint-300 font-sans text-sm animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-mint-400 border-t-transparent animate-spin" />
          <span>Loading operational dispensary analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto pb-10">
      {/* Eyebrow & Title */}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-cream-to/50">
          DISPENSARY INTELLIGENCE & TELEMETRY
        </span>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-cream-from">
          Prescription & Stock Analytics
        </h1>
        <p className="text-xs text-cream-to/60 max-w-xl">
          Real-time prescription volume, demand velocity, and inventory turnover across your dispensary catalog.
        </p>
      </div>

      {/* KPI Stats Row */}
      <AnalyticsKPIHeader kpis={data.kpis} />

      {/* Main Analytics Grid: Top Medicines Leaderboard on left, Category & Velocity on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <TopMedicinesLeaderboard medicines={data.top_medicines} />

        <div className="flex flex-col gap-6 justify-between">
          <OrderVelocityCard
            trend={data.order_trend}
            avgPrepMinutes={data.kpis.avg_prep_time_minutes}
            fulfillmentRate={data.kpis.fulfillment_rate}
          />
          <CategoryDistributionCard categories={data.categories} />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;

