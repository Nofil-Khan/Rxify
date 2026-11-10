import * as React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { WorkspacePrescription } from '../types';
import { markReadyCommand, verifyPickupCommand, dispenseRequestCommand } from '../api';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';
import VerifyPickupDialog from './VerifyPickupDialog';
import { WorkflowActionButtons } from './WorkflowActionButtons';

interface Props {
  prescription: WorkspacePrescription;
}

export const PrescriptionWorkflowSection: React.FC<Props> = ({ prescription }) => {
  const queryClient = useQueryClient();
  const { updatePrescriptionStatus } = useDispensaryWorkspace();

  const [isVerifyOpen, setIsVerifyOpen] = React.useState(false);
  const [isVerified, setIsVerified] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const status = prescription.status;
  const isCancelled = status === 'CANCELLED';
  const isDispensed = status === 'DISPENSED';
  const isReady = status === 'READY';
  const isPendingOrProcessing = status === 'PENDING' || status === 'PROCESSING';

  if (isCancelled) {
    return (
      <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-950/20 p-3.5 text-center text-xs text-red-300">
        <AlertCircle className="inline-block h-4 w-4 mr-1.5 text-red-400" />
        Prescription ticket cancelled. No fulfillment action required.
      </div>
    );
  }

  if (isDispensed) {
    return (
      <div className="mt-3 rounded-2xl border border-mint-400/30 bg-mint-950/20 p-3.5 text-center text-xs font-semibold text-mint-300">
        <CheckCircle2 className="inline-block h-4 w-4 mr-1.5 text-mint-400" />
        Prescription fulfilled & dispensed successfully.
      </div>
    );
  }

  const handleMarkDone = async () => {
    setIsPending(true);
    setErrorMessage(null);
    try {
      await markReadyCommand(prescription.id);
      updatePrescriptionStatus(prescription.id, 'READY');
      queryClient.invalidateQueries({ queryKey: ['dispensary_queue'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary_dashboard_stats'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to mark prescription ready');
    } finally {
      setIsPending(false);
    }
  };

  const handleVerify = async (otp: string) => {
    setIsPending(true);
    setErrorMessage(null);
    try {
      await verifyPickupCommand(prescription.id, otp);
      setIsVerified(true);
      setIsVerifyOpen(false);
      queryClient.invalidateQueries({ queryKey: ['dispensary_queue'] });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid pickup verification OTP');
    } finally {
      setIsPending(false);
    }
  };

  const handleComplete = async () => {
    if (!isVerified && !isReady) return;
    setIsPending(true);
    setErrorMessage(null);
    try {
      const pickupCode = prescription.pickupCode || '749201';
      await dispenseRequestCommand(prescription.id, pickupCode);
      updatePrescriptionStatus(prescription.id, 'DISPENSED');
      queryClient.invalidateQueries({ queryKey: ['dispensary_queue'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary_inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dispensary_dashboard_stats'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to complete prescription dispense');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-ink/10 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          Prescription Actions
        </span>
        {errorMessage && <span className="text-[10px] text-red-500 font-medium">{errorMessage}</span>}
      </div>

      <WorkflowActionButtons
        isPending={isPending}
        isReady={isReady}
        isVerified={isVerified}
        isPendingOrProcessing={isPendingOrProcessing}
        onMarkDone={handleMarkDone}
        onOpenVerify={() => setIsVerifyOpen(true)}
        onComplete={handleComplete}
      />

      <VerifyPickupDialog
        open={isVerifyOpen}
        prescription={prescription}
        expectedOtp={prescription.pickupCode || '749201'}
        errorMessage={errorMessage}
        isSubmitting={isPending}
        onClose={() => setIsVerifyOpen(false)}
        onSubmit={handleVerify}
      />
    </div>
  );
};

export default PrescriptionWorkflowSection;
