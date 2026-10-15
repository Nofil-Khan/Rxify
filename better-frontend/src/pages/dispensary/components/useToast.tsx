/** Toast notification hook */
import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

export type ToastVariant = 'ok' | 'err' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

let _id = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, variant: ToastVariant = 'ok') => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, push };
}

export function ToastStack({ toasts }: { toasts: ReturnType<typeof useToast>['toasts'] }) {
  if (!toasts.length) return null;
  return (
    <div className="disp-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`disp-toast disp-toast--${t.variant}`}>
          {t.variant === 'ok'  && <CheckCircle2 size={15} />}
          {t.variant === 'err' && <XCircle size={15} />}
          {t.variant === 'info'&& <Info size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
