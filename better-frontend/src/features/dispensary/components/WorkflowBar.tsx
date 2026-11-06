import * as React from 'react';
import { Play, Package, ShoppingBag, QrCode, CheckCircle2, ArrowRight } from 'lucide-react';
import WorkflowStepButton from './WorkflowStepButton';
import ReserveGuardDialog from './ReserveGuardDialog';
import VerifyPickupDialog from './VerifyPickupDialog';
import useWorkflow from '../useWorkflow';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const WorkflowBar: React.FC = () => {
  const { state, dispatch, handleStepClick } = useWorkflow();
  const { openReconsultModal } = useDispensaryWorkspace();

  const stages = [
    { label: 'Process Request', icon: Play },
    { label: 'Reserve Stock', icon: Package },
    { label: 'Mark Ready', icon: ShoppingBag },
    { label: 'Verify Pickup', icon: QrCode },
    { label: 'Complete', icon: CheckCircle2 },
  ];

  const getStepStatus = (idx: number): 'done' | 'active' | 'upcoming' => {
    if (idx < state.activeStepIndex) return 'done';
    if (idx === state.activeStepIndex) return 'active';
    return 'upcoming';
  };

  return (
    <>
      <footer
        className="sticky bottom-0 lg:relative z-30 w-full shrink-0 px-3 lg:px-14 pb-3 lg:pb-5 pt-1.5 bg-bg-0/90 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-t border-mint-400/15 lg:border-t-0"
        data-testid="slot-workflow-bar"
      >
        <div className="mx-auto flex h-16 w-full max-w-[1150px] items-center justify-between rounded-2xl lg:rounded-[32px] border border-mint-400/25 bg-bg-1/80 px-4 lg:px-7 backdrop-blur-2xl shadow-glass-lg overflow-x-auto no-scrollbar">
          <div className="flex min-w-max lg:w-full items-center justify-between gap-3">
            {stages.map((stage, idx) => (
              <React.Fragment key={stage.label}>
                <WorkflowStepButton
                  label={stage.label}
                  icon={stage.icon}
                  status={getStepStatus(idx)}
                  onClick={() => handleStepClick(idx)}
                />

                {idx < stages.length - 1 && (
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-colors select-none ${
                      idx < state.activeStepIndex
                        ? 'text-mint-400/70'
                        : 'text-emerald-200/20'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </footer>

      {/* Unavailable Stock Reservation Guard Dialog */}
      <ReserveGuardDialog
        open={state.isReserveGuardOpen}
        prescription={state.prescription}
        onClose={() => dispatch({ type: 'CLOSE_RESERVE_GUARD' })}
        onPartialReserve={() => dispatch({ type: 'FORCE_PARTIAL_RESERVE' })}
        onSubstitute={(medId, subName) =>
          dispatch({ type: 'SUBSTITUTE_UNAVAILABLE', medicineId: medId, substituteName: subName })
        }
        onNotifyDoctor={() => {
          const unavailable = state.prescription.medicines.find(
            (m) => m.inStockQuantity === 0 || m.status === 'UNAVAILABLE'
          );
          if (unavailable) openReconsultModal(unavailable);
        }}
      />

      {/* Verify Patient Pickup Dialog with QR Code and OTP input */}
      <VerifyPickupDialog
        open={state.isVerifyPickupOpen}
        prescription={state.prescription}
        expectedOtp={state.verificationOtp}
        errorMessage={state.errorMessage}
        onClose={() => dispatch({ type: 'CLOSE_VERIFY_PICKUP' })}
        onVerify={(otp) => dispatch({ type: 'VERIFY_OTP', otp })}
      />
    </>
  );
};

export default WorkflowBar;
