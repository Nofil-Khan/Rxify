import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera, Upload, Keyboard, X, Check, AlertCircle, RefreshCw,
  User, Stethoscope, Building2, Package, ArrowRight, FileText, Sparkles
} from 'lucide-react';
import { parseQrCode, type ParsedQrPayload } from '../../lib/qrProtocol';
import { lookupDoctor, requestDoctor } from '../../lib/patientApi';
import { lookupPatientByCode, connectPatient } from '../../lib/doctorApi';
import { affiliateDoctorToHospital, lookupPatient } from '../../lib/hospitalApi';
import { lookupDispensaryCode } from '../../lib/dispensaryApi';

export interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'patient' | 'doctor' | 'hospital' | 'dispensary';
  onSuccessAction?: (actionType: string, payload: any) => void;
}

type ScanMode = 'camera' | 'upload' | 'manual';

export default function QrScannerModal({
  isOpen,
  onClose,
  role,
  onSuccessAction,
}: QrScannerModalProps) {
  const [mode, setMode] = useState<ScanMode>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  /* Manual Code State */
  const [manualCode, setManualCode] = useState('');

  /* Scanned / Matched Result State */
  const [detectedPayload, setDetectedPayload] = useState<ParsedQrPayload | null>(null);
  const [resolvedData, setResolvedData] = useState<any | null>(null);
  const [resolving, setResolving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'rx-qr-reader-container';

  /* Reset on open / close */
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setDetectedPayload(null);
      setResolvedData(null);
      setActionSuccess(null);
      setActionError(null);
      setManualCode('');
    }
  }, [isOpen]);

  /* Start Camera when mode is camera and modal is open */
  useEffect(() => {
    if (isOpen && mode === 'camera' && !detectedPayload) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, facingMode, detectedPayload]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      setIsScanning(true);
      await scannerRef.current.start(
        { facingMode },
        {
          fps: 12,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // ignore frame errors
        }
      );
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setIsScanning(false);
      setCameraError(err?.message || 'Unable to access camera. Please allow camera permissions or upload an image.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsScanning(false);
  };

  /* Handle Detected QR Payload */
  const handleCodeDetected = async (rawText: string) => {
    await stopCamera();
    const parsed = parseQrCode(rawText);
    setDetectedPayload(parsed);
    resolveScannedPayload(parsed);
  };

  /* Drag & Drop File Upload */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('rx-file-temp-scanner', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleCodeDetected(decodedText);
    } catch (err: any) {
      setActionError('Could not find a valid QR code in this image. Try another photo or enter code manually.');
    }
  };

  /* Manual Code Submit */
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const parsed = parseQrCode(manualCode.trim());
    setDetectedPayload(parsed);
    resolveScannedPayload(parsed);
  };

  /* Contextual API Resolver */
  const resolveScannedPayload = async (payload: ParsedQrPayload) => {
    setResolving(true);
    setActionError(null);
    setActionSuccess(null);
    setResolvedData(null);

    try {
      // 1. Patient scanned Doctor
      if (role === 'patient' && (payload.type === 'doctor' || payload.type === 'unknown')) {
        const doc = await lookupDoctor(payload.id);
        setResolvedData({ type: 'doctor', data: doc });
      }
      // 2. Doctor scanned Patient
      else if (role === 'doctor' && (payload.type === 'patient' || payload.id.startsWith('RXF-P-'))) {
        const pt = await lookupPatientByCode(payload.id);
        setResolvedData({ type: 'patient', data: pt });
      }
      // 3. Hospital scanned Patient
      else if (role === 'hospital' && (payload.type === 'patient' || payload.id.startsWith('RXF-P-'))) {
        const pt = await lookupPatient(payload.id);
        setResolvedData({ type: 'hospital_patient', data: pt });
      }
      // 4. Hospital scanned Doctor
      else if (role === 'hospital' && (payload.type === 'doctor' || payload.id.startsWith('RXF-D-') || payload.numericId)) {
        const doc = await lookupDoctor(payload.id);
        setResolvedData({ type: 'hospital_doctor', data: doc });
      }
      // 5. Dispensary scanned Patient or Prescription
      else if (role === 'dispensary') {
        const dispRes = await lookupDispensaryCode(payload.id);
        setResolvedData({ type: 'dispensary_lookup', data: dispRes });
      }
      // 6. Generic or Share Token
      else {
        setResolvedData({ type: 'generic', data: payload });
      }
    } catch (err: any) {
      setActionError(err?.message || `Could not resolve data for ${payload.label}`);
    } finally {
      setResolving(false);
    }
  };

  /* Action Handler (e.g. Connect, Affiliate, Dispense, etc.) */
  const handleExecuteAction = async () => {
    if (!resolvedData) return;
    setActionLoading(true);
    setActionError(null);

    try {
      // Patient -> Connect Doctor
      if (role === 'patient' && resolvedData.type === 'doctor') {
        const doc = resolvedData.data;
        const res = await requestDoctor(doc.id);
        setActionSuccess(res.message || 'Connection request sent to doctor!');
        onSuccessAction?.('patient_connected_doctor', doc);
      }
      // Doctor -> Connect Patient
      else if (role === 'doctor' && resolvedData.type === 'patient') {
        const pt = resolvedData.data;
        const res = await connectPatient(pt.patient_code);
        setActionSuccess(res.message || 'Patient successfully added to your care directory!');
        onSuccessAction?.('doctor_connected_patient', pt);
      }
      // Hospital -> Affiliate Doctor
      else if (role === 'hospital' && resolvedData.type === 'hospital_doctor') {
        const doc = resolvedData.data;
        await affiliateDoctorToHospital(doc.id, 'General Practice');
        setActionSuccess(`Dr. ${doc.display_name || doc.username} affiliated with hospital!`);
        onSuccessAction?.('hospital_affiliated_doctor', doc);
      }
      // Hospital -> View Patient
      else if (role === 'hospital' && resolvedData.type === 'hospital_patient') {
        const pt = resolvedData.data;
        setActionSuccess(`Loaded records for patient ${pt.full_name}`);
        onSuccessAction?.('hospital_view_patient', pt);
        onClose();
      }
      // Dispensary -> Process or open request
      else if (role === 'dispensary' && resolvedData.type === 'dispensary_lookup') {
        const disp = resolvedData.data;
        setActionSuccess(`Located ${disp.total} dispensary request(s)!`);
        onSuccessAction?.('dispensary_open_requests', disp);
        onClose();
      }
      // Generic share token
      else if (detectedPayload?.type === 'share_token') {
        window.open(`/share/${detectedPayload.id}`, '_blank');
        onClose();
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to complete connection.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="rx-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rx-modal-card rx-scanner-card" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="rx-modal-header">
          <div className="rx-header-info">
            <div className="rx-role-pill">
              <Camera size={18} className="text-cyan-400" />
              <span>SCAN QR & CONNECT</span>
            </div>
            <h3 className="rx-modal-title">Universal Scanner</h3>
            <p className="rx-modal-subtitle">
              Scan any Rxify Patient, Doctor, Hospital, or Dispensary QR code to connect instantly.
            </p>
          </div>
          <button className="rx-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Scan Mode Toggle */}
        {!detectedPayload && (
          <div className="rx-scanner-tabs">
            <button
              className={`rx-scan-tab ${mode === 'camera' ? 'rx-scan-tab--active' : ''}`}
              onClick={() => setMode('camera')}
            >
              <Camera size={16} />
              <span>Live Camera</span>
            </button>
            <button
              className={`rx-scan-tab ${mode === 'upload' ? 'rx-scan-tab--active' : ''}`}
              onClick={() => setMode('upload')}
            >
              <Upload size={16} />
              <span>Image / File</span>
            </button>
            <button
              className={`rx-scan-tab ${mode === 'manual' ? 'rx-scan-tab--active' : ''}`}
              onClick={() => setMode('manual')}
            >
              <Keyboard size={16} />
              <span>Enter Code</span>
            </button>
          </div>
        )}

        {/* ── Active Scanning View ── */}
        {!detectedPayload && (
          <div className="rx-scanner-viewport-wrap">
            {mode === 'camera' && (
              <div className="rx-camera-viewport">
                <div id={scannerContainerId} className="rx-html5-camera-box" />

                {/* Cyberpunk HUD overlay */}
                <div className="rx-hud-reticle">
                  <div className="rx-hud-corner rx-hud-tl" />
                  <div className="rx-hud-corner rx-hud-tr" />
                  <div className="rx-hud-corner rx-hud-bl" />
                  <div className="rx-hud-corner rx-hud-br" />
                  <div className="rx-hud-laser" />
                </div>

                {cameraError ? (
                  <div className="rx-camera-error-banner">
                    <AlertCircle size={18} />
                    <span>{cameraError}</span>
                    <button className="rx-cam-fallback-btn" onClick={() => setMode('upload')}>
                      Upload File Instead
                    </button>
                  </div>
                ) : (
                  <div className="rx-camera-controls">
                    <button
                      className="rx-cam-flip-btn"
                      onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                      title="Flip camera"
                    >
                      <RefreshCw size={15} />
                      <span>Flip Cam</span>
                    </button>
                    <span className="rx-cam-guide-text">Align QR code within the frame</span>
                  </div>
                )}
              </div>
            )}

            {mode === 'upload' && (
              <div className="rx-upload-dropzone">
                <div id="rx-file-temp-scanner" style={{ display: 'none' }} />
                <label className="rx-dropzone-label">
                  <Upload size={36} className="text-cyan-400 mb-2" />
                  <span className="rx-dropzone-title">Upload QR Code Image</span>
                  <span className="rx-dropzone-hint">PNG, JPG, or Screenshot of any Rxify QR</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="rx-file-hidden-input"
                  />
                  <span className="rx-browse-btn">Browse Device</span>
                </label>
              </div>
            )}

            {mode === 'manual' && (
              <form className="rx-manual-code-form" onSubmit={handleManualSubmit}>
                <label className="rx-manual-label">Enter Rxify ID / Code:</label>
                <div className="rx-manual-input-wrap">
                  <input
                    type="text"
                    className="rx-manual-input"
                    placeholder="e.g. RXF-P-ABCD1, RXF-D-1, RXF-H-1, RXF-DISP-1"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="rx-manual-submit-btn">
                    <span>Look Up</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className="rx-manual-examples">
                  <span>Supported:</span>
                  <code>RXF-P-XXXXX</code>
                  <code>RXF-D-1</code>
                  <code>RXF-H-1</code>
                  <code>RXF-DISP-1</code>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Detected Code & Contextual Action Preview ── */}
        {detectedPayload && (
          <div className="rx-detected-preview">
            <div className="rx-detected-header">
              <span className="rx-detected-tag">QR CODE DETECTED</span>
              <span className="rx-detected-code">{detectedPayload.id}</span>
            </div>

            {resolving && (
              <div className="rx-resolving-spinner">
                <RefreshCw size={24} className="animate-spin text-cyan-400" />
                <span>Verifying credentials with Rxify network...</span>
              </div>
            )}

            {actionError && (
              <div className="rx-action-alert rx-action-alert--error">
                <AlertCircle size={18} />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="rx-action-alert rx-action-alert--success">
                <Check size={18} />
                <span>{actionSuccess}</span>
              </div>
            )}

            {resolvedData && !resolving && (
              <div className="rx-result-card">
                {/* Result Type 1: Doctor Profile */}
                {resolvedData.type === 'doctor' && (
                  <div className="rx-result-doctor">
                    <div className="rx-res-icon-wrap bg-emerald-500/10 text-emerald-400">
                      <Stethoscope size={28} />
                    </div>
                    <div className="rx-res-body">
                      <h4>Dr. {resolvedData.data.display_name || resolvedData.data.username}</h4>
                      <p className="rx-res-spec">{resolvedData.data.specialty || 'General Practitioner'}</p>
                      <p className="rx-res-sub">Code: {resolvedData.data.doctor_code || `RXF-D-${resolvedData.data.id}`}</p>
                    </div>
                    <button
                      className="rx-res-action-btn"
                      onClick={handleExecuteAction}
                      disabled={actionLoading || Boolean(actionSuccess)}
                    >
                      {actionLoading ? 'Connecting...' : actionSuccess ? 'Connected!' : 'Connect with Doctor'}
                    </button>
                  </div>
                )}

                {/* Result Type 2: Patient Profile (Doctor View) */}
                {resolvedData.type === 'patient' && (
                  <div className="rx-result-patient">
                    <div className="rx-res-icon-wrap bg-indigo-500/10 text-indigo-400">
                      <User size={28} />
                    </div>
                    <div className="rx-res-body">
                      <h4>{resolvedData.data.full_name}</h4>
                      <p className="rx-res-spec">Patient Code: {resolvedData.data.patient_code}</p>
                      <div className="rx-res-chips">
                        {resolvedData.data.blood_group && <span>Blood: {resolvedData.data.blood_group}</span>}
                        <span>Prescriptions: {resolvedData.data.total_prescriptions}</span>
                        <span className={`rx-status-tag ${resolvedData.data.connection_status === 'active' ? 'rx-status-tag--active' : ''}`}>
                          {resolvedData.data.connection_status ? resolvedData.data.connection_status.toUpperCase() : 'NEW PATIENT'}
                        </span>
                      </div>
                    </div>
                    <button
                      className="rx-res-action-btn"
                      onClick={handleExecuteAction}
                      disabled={actionLoading || Boolean(actionSuccess)}
                    >
                      {actionLoading ? 'Saving...' : actionSuccess ? 'Added!' : 'Add to My Care Directory'}
                    </button>
                  </div>
                )}

                {/* Result Type 3: Hospital Patient Lookup */}
                {resolvedData.type === 'hospital_patient' && (
                  <div className="rx-result-hospital-patient">
                    <div className="rx-res-icon-wrap bg-sky-500/10 text-sky-400">
                      <Building2 size={28} />
                    </div>
                    <div className="rx-res-body">
                      <h4>{resolvedData.data.full_name}</h4>
                      <p className="rx-res-spec">Verified Patient Code: {resolvedData.data.patient_code}</p>
                      <p className="rx-res-sub">Blood Group: {resolvedData.data.blood_group || 'Not recorded'}</p>
                    </div>
                    <button
                      className="rx-res-action-btn"
                      onClick={handleExecuteAction}
                    >
                      View Medical Records & History
                    </button>
                  </div>
                )}

                {/* Result Type 4: Hospital Doctor Affiliation */}
                {resolvedData.type === 'hospital_doctor' && (
                  <div className="rx-result-hospital-doctor">
                    <div className="rx-res-icon-wrap bg-teal-500/10 text-teal-400">
                      <Stethoscope size={28} />
                    </div>
                    <div className="rx-res-body">
                      <h4>Dr. {resolvedData.data.display_name || resolvedData.data.username}</h4>
                      <p className="rx-res-spec">Specialty: {resolvedData.data.specialty || 'General'}</p>
                      <p className="rx-res-sub">Affiliate to Hospital Roster</p>
                    </div>
                    <button
                      className="rx-res-action-btn"
                      onClick={handleExecuteAction}
                      disabled={actionLoading || Boolean(actionSuccess)}
                    >
                      {actionLoading ? 'Affiliating...' : actionSuccess ? 'Affiliated!' : 'Confirm Affiliation'}
                    </button>
                  </div>
                )}

                {/* Result Type 5: Dispensary Request Matched */}
                {resolvedData.type === 'dispensary_lookup' && (
                  <div className="rx-result-dispensary">
                    <div className="rx-res-icon-wrap bg-amber-500/10 text-amber-400">
                      <Package size={28} />
                    </div>
                    <div className="rx-res-body">
                      <h4>Prescription Queue Orders</h4>
                      <p className="rx-res-spec">Found {resolvedData.data.total} order(s) for {resolvedData.data.patient_code || detectedPayload.id}</p>
                      {resolvedData.data.requests?.[0] && (
                        <p className="rx-res-sub">
                          Status: <strong>{resolvedData.data.requests[0].status}</strong> (ETA: {resolvedData.data.requests[0].estimated_ready_at || 'Pending'})
                        </p>
                      )}
                    </div>
                    <button
                      className="rx-res-action-btn"
                      onClick={handleExecuteAction}
                    >
                      Open Queue / Dispense Now
                    </button>
                  </div>
                )}

                {/* Result Type 6: Generic or Share Token */}
                {resolvedData.type === 'generic' && (
                  <div className="rx-result-generic">
                    <div className="rx-res-icon-wrap bg-slate-500/10 text-slate-400">
                      <FileText size={28} />
                    </div>
                    <div className="rx-res-body">
                      <h4>{detectedPayload.label}</h4>
                      <p className="rx-res-sub">Type: {detectedPayload.type.toUpperCase()}</p>
                    </div>
                    {detectedPayload.type === 'share_token' && (
                      <button className="rx-res-action-btn" onClick={handleExecuteAction}>
                        View Shared Medical Record
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Scan Another Button */}
            <div className="rx-scan-again-row">
              <button
                className="rx-scan-again-btn"
                onClick={() => {
                  setDetectedPayload(null);
                  setResolvedData(null);
                  setActionSuccess(null);
                  setActionError(null);
                }}
              >
                <RefreshCw size={14} />
                <span>Scan Another Code</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
