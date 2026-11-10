import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles, X } from 'lucide-react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import OtpInputBoxes from './OtpInputBoxes';

interface DynamicPrescriptionIslandProps {
  forceOpenVerify?: boolean;
  onCloseVerify?: () => void;
}

export const DynamicPrescriptionIsland: React.FC<DynamicPrescriptionIslandProps> = ({
  forceOpenVerify,
  onCloseVerify,
}) => {
  const { prescriptions, selectedPrescriptionId, pickAllMedicines, markReady, completeHandover } =
    useDispensaryWorkspace();

  const rx = prescriptions.find((p) => p.id === selectedPrescriptionId) ?? prescriptions[0];
  const [isVerifyOpen, setIsVerifyOpen] = React.useState(false);
  const [otpValue, setOtpValue] = React.useState('');
  const [isError, setIsError] = React.useState(false);
  const [isConfirmed, setIsConfirmed] = React.useState(false);

  React.useEffect(() => {
    if (forceOpenVerify) setIsVerifyOpen(true);
  }, [forceOpenVerify]);

  const totalItems = rx?.medicines.length || 0;
  const pickedCount = rx?.medicines.filter((m) => m.picked).length || 0;
  const allPicked = totalItems > 0 && pickedCount === totalItems;
  const isReady = rx?.status === 'READY';
  const isDone = rx?.status === 'DISPENSED';

  const handleVerifyOtp = (code: string) => {
    const targetCode = rx?.pickupCode || '749201';
    if (code === targetCode) {
      setIsError(false);
      setIsConfirmed(true);
      setTimeout(() => {
        completeHandover(rx.id);
        setIsConfirmed(false);
        setIsVerifyOpen(false);
        setOtpValue('');
        onCloseVerify?.();
      }, 1000);
    } else {
      setIsError(true);
      setTimeout(() => setIsError(false), 800);
    }
  };

  if (!rx || isDone) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 select-none">
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }}
        className="ti-island rounded-2xl px-5 py-2.5 shadow-2xl flex items-center justify-center"
        style={{ minWidth: 320 }}
      >
        <AnimatePresence mode="wait">
          {/* STATE 4: CONFIRMATION */}
          {isConfirmed ? (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2.5 py-1 font-bold text-xs"
              style={{ color: 'var(--ti-island-text)' }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--ti-sage)' }} />
              <span>✓ Dispensed & Inventory Deducted</span>
              <Sparkles className="h-4 w-4 animate-spin" style={{ color: 'var(--ti-sage)' }} />
            </motion.div>
          ) : isVerifyOpen || isReady ? (
            /* STATE 3: OTP VERIFICATION */
            <motion.div
              key="otp-state"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3 py-2 w-full"
            >
              <div
                className="flex items-center justify-between w-full gap-8 pb-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" style={{ color: 'var(--ti-sage)' }} />
                  <span className="font-serif text-xs font-bold" style={{ color: 'var(--ti-island-text)' }}>
                    Verify Patient Handover · {rx.rxNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsVerifyOpen(false); onCloseVerify?.(); }}
                  aria-label="Close OTP verification"
                  className="rounded-full p-0.5 focus-visible:ring-2 focus-visible:outline-none cursor-pointer"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <OtpInputBoxes value={otpValue} onChange={setOtpValue} isError={isError} onEnter={() => handleVerifyOtp(otpValue)} />

              <div className="flex items-center gap-2 pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => { const c = rx?.pickupCode || '749201'; setOtpValue(c); handleVerifyOtp(c); }}
                  aria-label="Simulate valid OTP"
                  className="rounded-lg px-2.5 py-1 font-mono font-bold border cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
                  style={{ background: 'rgba(74,124,111,0.2)', color: 'var(--ti-sage)', borderColor: 'rgba(74,124,111,0.3)' }}
                >
                  Simulate Valid OTP ({rx?.pickupCode || '749201'})
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpValue('000000'); handleVerifyOtp('000000'); }}
                  aria-label="Test invalid OTP"
                  className="rounded-lg px-2.5 py-1 font-mono font-bold border cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
                  style={{ background: 'rgba(192,57,43,0.2)', color: '#ff8072', borderColor: 'rgba(192,57,43,0.3)' }}
                >
                  Test Invalid OTP
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyOtp(otpValue)}
                  aria-label="Confirm handover"
                  className="rounded-lg px-3 py-1 font-bold text-xs cursor-pointer ml-1 focus-visible:ring-2 focus-visible:outline-none"
                  style={{ background: 'var(--ti-island-text)', color: 'var(--ti-ink)' }}
                >
                  Confirm Handover
                </button>
              </div>
            </motion.div>
          ) : allPicked ? (
            /* STATE 2: PACKAGING READY */
            <motion.div
              key="packaging-ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-4 py-1"
            >
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--ti-sage)' }}>
                <CheckCircle2 className="h-4 w-4" />
                <span>All {totalItems} items picked and ready</span>
              </div>
              <button
                type="button"
                onClick={() => markReady(rx.id)}
                aria-label="Mark prescription ready for pickup"
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer focus-visible:ring-2 focus-visible:outline-none transition-all"
                style={{ background: 'var(--ti-island-text)', color: 'var(--ti-ink)' }}
              >
                <span>Mark Ready for Pickup</span>
                <span className="font-mono text-[10px] opacity-60">(⌘Enter)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ) : (
            /* STATE 1: PICKING */
            <motion.div
              key="picking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 py-1 text-xs"
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full font-mono font-bold text-[10px]"
                  style={{ background: 'rgba(74,124,111,0.25)', color: 'var(--ti-sage)' }}
                >
                  {pickedCount}/{totalItems}
                </div>
                <span className="font-medium" style={{ color: 'var(--ti-island-text)' }}>
                  {pickedCount} of {totalItems} items picked
                </span>
              </div>

              <button
                type="button"
                onClick={pickAllMedicines}
                aria-label="Pick all medicines"
                className="rounded-full px-3 py-1 text-[11px] font-bold cursor-pointer transition-all focus-visible:ring-2 focus-visible:outline-none"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--ti-island-text)' }}
              >
                Pick All Items
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DynamicPrescriptionIsland;
