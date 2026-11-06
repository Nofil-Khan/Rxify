import * as React from 'react';
import { useDispensaryWorkspace } from '../hooks/useDispensaryWorkspace';

export const AriaLiveRegion: React.FC = () => {
  const { prescriptions, selectedPrescriptionId, statusFilter, workflowStep } =
    useDispensaryWorkspace();

  const [announcement, setAnnouncement] = React.useState<string>('Dispensary workspace ready');
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const currentRx = prescriptions.find((p) => p.id === selectedPrescriptionId);
    if (currentRx) {
      setAnnouncement(
        `Selected prescription ${currentRx.rxNumber} for patient ${currentRx.patientName}. Status: ${currentRx.status}`
      );
    }
  }, [selectedPrescriptionId, prescriptions]);

  React.useEffect(() => {
    if (isInitialMount.current) return;
    setAnnouncement(`Pipeline stage filter changed to ${statusFilter || 'All'}`);
  }, [statusFilter]);

  React.useEffect(() => {
    if (isInitialMount.current) return;
    const stepNames = ['Process Request', 'Reserve Stock', 'Mark Ready', 'Verify Pickup', 'Complete'];
    const stepName = stepNames[workflowStep] || `Step ${workflowStep + 1}`;
    setAnnouncement(`Workflow advanced to ${stepName}`);
  }, [workflowStep]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="aria-live-region"
    >
      {announcement}
    </div>
  );
};

export default AriaLiveRegion;

