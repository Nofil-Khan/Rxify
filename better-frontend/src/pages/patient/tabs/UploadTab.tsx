import { useState, useRef, useCallback } from 'react';
import {
  Upload, CheckCircle, AlertCircle, Loader, FileImage,
  Pill, Calendar, User, X, RotateCcw
} from 'lucide-react';
import { uploadPrescription, pollJob, type PrescriptionDetail } from '../../../lib/patientApi';

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif';

export default function UploadTab() {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [state, setState]         = useState<UploadState>('idle');
  const [result, setResult]       = useState<PrescriptionDetail | null>(null);
  const [errMsg, setErrMsg]       = useState('');
  const [progress, setProgress]   = useState(0); // 0-100 fake progress
  const [drag, setDrag]           = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const pollRef                   = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = () => {
    setFile(null); setPreview(null); setState('idle');
    setResult(null); setErrMsg(''); setProgress(0);
    if (pollRef.current) clearInterval(pollRef.current);
    if (inputRef.current) inputRef.current.value = '';
  };

  const startUpload = useCallback(async (f: File) => {
    setState('uploading');
    setProgress(10);
    setErrMsg('');
    try {
      const job = await uploadPrescription(f);
      setState('processing');
      setProgress(30);

      // Poll until done
      let ticks = 0;
      pollRef.current = setInterval(async () => {
        ticks++;
        try {
          const status = await pollJob(job.job_id);
          // Fake progress creep up to 90%
          setProgress((p) => Math.min(p + 8, 90));

          if (status.status === 'done') {
            clearInterval(pollRef.current!);
            setProgress(100);
            setResult(status.result ?? null);
            setState('done');
          } else if (status.status === 'error') {
            clearInterval(pollRef.current!);
            setErrMsg(status.error ?? 'OCR failed. Please try again.');
            setState('error');
          } else if (ticks > 40) {
            clearInterval(pollRef.current!);
            setErrMsg('Processing timed out. Please try uploading again.');
            setState('error');
          }
        } catch {
          clearInterval(pollRef.current!);
          setErrMsg('Lost connection while processing. Please try again.');
          setState('error');
        }
      }, 1500);

    } catch (e: any) {
      setErrMsg(e?.message ?? 'Upload failed. Please try again.');
      setState('error');
    }
  }, []);

  const pickFile = (f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) pickFile(f);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="pd-tab-page">
      <div className="pd-tab-header">
        <div>
          <h1 className="pd-tab-title">Upload Prescription</h1>
          <p className="pd-tab-sub">AI extracts all fields automatically</p>
        </div>
      </div>

      <div className="pd-upload-layout">

        {/* ── Drop zone ─────────────────────────────────────────────────── */}
        {(state === 'idle' || state === 'error') && (
          <div
            className={`pd-dropzone ${drag ? 'pd-dropzone--drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop prescription image or click to select"
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              id="upload-file-input"
              type="file"
              accept={ACCEPTED}
              className="pd-file-input"
              onChange={onInputChange}
              aria-hidden="true"
            />

            {preview ? (
              <div className="pd-preview-wrap">
                <img src={preview} alt="Selected prescription preview" className="pd-preview-img" />
                <button
                  id="clear-file-btn"
                  className="pd-clear-btn"
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  aria-label="Remove selected file"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="pd-dropzone-body">
                <div className="pd-dropzone-icon" aria-hidden="true">
                  <FileImage size={36} />
                </div>
                <p className="pd-dropzone-title">Drop your prescription here</p>
                <p className="pd-dropzone-sub">or click to browse · JPG, PNG, WEBP, HEIC supported</p>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {state === 'error' && (
          <div className="pd-alert pd-alert--error" role="alert">
            <AlertCircle size={15} aria-hidden="true" /> {errMsg}
          </div>
        )}

        {/* ── Upload button ─────────────────────────────────────────────── */}
        {file && state === 'idle' && (
          <div className="pd-upload-actions">
            <div className="pd-file-chip">
              <FileImage size={15} aria-hidden="true" />
              <span>{file.name}</span>
              <span className="pd-file-size">({(file.size / 1024).toFixed(0)} KB)</span>
            </div>
            <button
              id="start-upload-btn"
              className="pd-btn-primary pd-btn-primary--full"
              onClick={() => startUpload(file)}
              aria-label="Start uploading and processing"
            >
              <Upload size={17} aria-hidden="true" />
              Upload &amp; Extract Data
            </button>
          </div>
        )}

        {/* ── Progress ─────────────────────────────────────────────────── */}
        {(state === 'uploading' || state === 'processing') && (
          <div className="pd-progress-wrap" role="status" aria-live="polite">
            <div className="pd-progress-icon" aria-hidden="true">
              <Loader size={28} className="pd-spin" />
            </div>
            <p className="pd-progress-label">
              {state === 'uploading' ? 'Uploading…' : 'AI is reading your prescription…'}
            </p>
            <p className="pd-progress-sub">This usually takes 5–15 seconds</p>
            <div
              className="pd-progress-bar-wrap"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${progress}% complete`}
            >
              <div className="pd-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── Result ───────────────────────────────────────────────────── */}
        {state === 'done' && result && (
          <div className="pd-result" role="region" aria-label="Extracted prescription data">
            <div className="pd-result-head">
              <CheckCircle size={22} className="pd-result-check" aria-hidden="true" />
              <div>
                <h2 className="pd-result-title">Prescription Extracted!</h2>
                <p className="pd-result-sub">All fields below were read by AI from your image.</p>
              </div>
              <button
                id="upload-another-btn"
                className="pd-btn-outline"
                onClick={reset}
                aria-label="Upload another prescription"
              >
                <RotateCcw size={15} aria-hidden="true" /> Upload Another
              </button>
            </div>

            {/* Meta grid */}
            <div className="pd-detail-grid">
              {[
                { label: 'Patient',    value: result.patient_name,   icon: <User size={13} /> },
                { label: 'Age',        value: result.patient_age,    icon: null },
                { label: 'Gender',     value: result.patient_gender, icon: null },
                { label: 'Doctor',     value: result.doctor_name ? `Dr. ${result.doctor_name}` : null, icon: null },
                { label: 'Clinic',     value: result.clinic_name,    icon: null },
                { label: 'Address',    value: result.clinic_address, icon: null },
                { label: 'Phone',      value: result.clinic_phone,   icon: null },
                { label: 'Issue Date', value: formatDate(result.issue_date), icon: <Calendar size={13} /> },
                { label: 'Follow-up',  value: formatDate(result.follow_up_date), icon: null },
                { label: 'Diagnosis',  value: result.diagnosis,      icon: null },
              ].map(({ label, value, icon }) =>
                value ? (
                  <div key={label} className="pd-detail-cell">
                    <span className="pd-detail-cell-label">{icon} {label}</span>
                    <span className="pd-detail-cell-value">{value}</span>
                  </div>
                ) : null
              )}
            </div>

            {/* Medications */}
            {result.medications?.length > 0 && (
              <div className="pd-meds">
                <h3 className="pd-meds-title"><Pill size={14} aria-hidden="true" /> Medications</h3>
                <div className="pd-meds-grid">
                  {result.medications.map((m, i) => (
                    <div key={i} className="pd-med-card">
                      <span className="pd-med-name">{m.name ?? '—'}</span>
                      <div className="pd-med-meta">
                        {m.dosage    && <span>{m.dosage}</span>}
                        {m.frequency && <span>{m.frequency}</span>}
                        {m.duration  && <span>{m.duration}</span>}
                      </div>
                      {m.instructions && <p className="pd-med-instructions">{m.instructions}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {result.notes && (
              <div className="pd-detail-notes">
                <span className="pd-detail-cell-label">Notes</span>
                <p>{result.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
