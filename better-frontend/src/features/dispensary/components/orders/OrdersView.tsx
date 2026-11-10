import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchDispensaryQueue, QueueItemSummary } from '@/lib/dispensaryApi';
import OrdersFilterBar from './OrdersFilterBar';
import OrdersList from './OrdersList';
import { useDispensaryWorkspace } from '../../hooks/useDispensaryWorkspace';

export const OrdersView: React.FC = () => {
  const navigate = useNavigate();
  const { selectPrescription } = useDispensaryWorkspace();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('ALL');

  const { data: queue = [], isLoading } = useQuery<QueueItemSummary[]>({
    queryKey: ['dispensary_queue'],
    queryFn: () => fetchDispensaryQueue(),
    staleTime: 15000,
  });

  const filteredOrders = React.useMemo(() => {
    return queue.filter((ord) => {
      const q = search.toLowerCase();
      const matchSearch =
        ord.patient_name.toLowerCase().includes(q) ||
        (ord.patient_code && ord.patient_code.toLowerCase().includes(q)) ||
        (ord.prescription_id && String(ord.prescription_id).includes(q)) ||
        String(ord.request_id).includes(q);

      const matchStatus =
        statusFilter === 'ALL' ||
        ord.status.toUpperCase() === statusFilter.toUpperCase() ||
        (statusFilter === 'PROCESSING' && (ord.status === 'CONFIRMED' || ord.status === 'PROCESSING'));

      return matchSearch && matchStatus;
    });
  }, [queue, search, statusFilter]);

  const counts = React.useMemo(() => {
    const res: Record<string, number> = { ALL: queue.length };
    for (const ord of queue) {
      const s = ord.status.toUpperCase();
      res[s] = (res[s] || 0) + 1;
      if (s === 'CONFIRMED') {
        res['PROCESSING'] = (res['PROCESSING'] || 0) + 1;
      }
    }
    return res;
  }, [queue]);

  const handleSelectOrder = (order: QueueItemSummary) => {
    selectPrescription(String(order.request_id));
    navigate({ to: '/workspace' });
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <div className="flex items-center gap-3 text-mint-300 font-sans text-sm animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-mint-400 border-t-transparent animate-spin" />
          <span>Loading prescription queue orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1440px] mx-auto pb-10">
      {/* Eyebrow & Title */}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.35em] text-cream-to/50">
          DISPENSARY PRESCRIPTION TICKETS
        </span>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-cream-from">
          Fulfillment Orders
        </h1>
        <p className="text-xs text-cream-to/60 max-w-xl">
          Manage patient medicine requests, verify pickup QR codes, and advance fulfillment pipeline states.
        </p>
      </div>

      {/* Filter bar */}
      <OrdersFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        counts={counts}
      />

      {/* Orders List */}
      <OrdersList
        orders={filteredOrders}
        onSelectOrder={handleSelectOrder}
      />
    </div>
  );
};

export default OrdersView;

