import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  X, Copy, Check, Download, ShieldCheck, User, Stethoscope,
  Building2, Package, Share2, Link as LinkIcon, Clock, Sparkles
} from 'lucide-react';
import { encodeQrPayload, type QrTargetType } from '../../lib/qrProtocol';
import { createShareToken } from '../../lib/patientApi';

export interface ShareIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'patient' | 'doctor' | 'hospital' | 'dispensary';
  code: string; // The formatted identifier, e.g. RXF-P-ABCDE, RXF-D-1, etc.
  name?: string | null;
  subtitle?: string;
  details?: { label: string; value: string }[];
  allowShareToken?: boolean; // For patient medical history tokens
}

export default function ShareIdModal({
  isOpen,
  onClose,
  role,
  code,
  name,
  subtitle,
  details = [],
  allowShareToken = false,
}: ShareIdModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'id' | 'shareToken'>('id');

  /* Share token generator state */
  const [shareExpiry, setShareExpiry] = useState<number | null>(7);
  const [shareLabel, setShareLabel] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const qrPayload = encodeQrPayload(role as QrTargetType, code);

  /* Render QR Code to canvas */
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !code) return;
    QRCode.toCanvas(
      canvasRef.current,
      qrPayload,
      {
        width: 220,
        margin: 2,
        color: {
          dark: '#03172e',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      },
      (err) => {
        if (err) console.error('QR code render error:', err);
      }
    );
  }, [isOpen, code, qrPayload, activeTab]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}-qr-code.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerateShareToken = async () => {
    setTokenLoading(true);
    setTokenError('');
    try {
      const res = await createShareToken(shareLabel.trim() || 'Medical Record Share', shareExpiry);
      setGeneratedToken(res.token.token);
    } catch (err: any) {
      setTokenError(err?.message ?? 'Failed to create share token.');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!generatedToken) return;
    const link = `${window.location.origin}/share/${generatedToken}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const getRoleIcon = () => {
    switch (role) {
      case 'doctor': return <Stethoscope size={20} className="text-emerald-400" />;
      case 'hospital': return <Building2 size={20} className="text-sky-400" />;
      case 'dispensary': return <Package size={20} className="text-amber-400" />;
      default: return <User size={20} className="text-indigo-400" />;
    }
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'doctor': return 'PHYSICIAN ID';
      case 'hospital': return 'HOSPITAL ORG ID';
      case 'dispensary': return 'DISPENSARY ORG ID';
      default: return 'PATIENT HEALTH ID';
    }
  };

  return (
    <div className="rx-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="rx-modal-card" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="rx-modal-header">
          <div className="rx-header-info">
            <div className="rx-role-pill">
              {getRoleIcon()}
              <span>{getRoleBadge()}</span>
            </div>
            <h3 className="rx-modal-title">{name || 'Your Rxify Identity'}</h3>
            <p className="rx-modal-subtitle">
              {subtitle || 'Share this ID or QR code for instant lookup and secure connection.'}
            </p>
          </div>
          <button className="rx-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Optional Sub-tab (Patient only: ID vs Medical Token) */}
        {allowShareToken && (
          <div className="rx-modal-tabs">
            <button
              className={`rx-tab-btn ${activeTab === 'id' ? 'rx-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('id')}
            >
              <ShieldCheck size={16} />
              <span>Public Patient ID</span>
            </button>
            <button
              className={`rx-tab-btn ${activeTab === 'shareToken' ? 'rx-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('shareToken')}
            >
              <Share2 size={16} />
              <span>Medical Share Link</span>
            </button>
          </div>
        )}

        {/* Tab 1: Primary ID Card & QR */}
        {activeTab === 'id' && (
          <div className="rx-id-content">
            {/* Holographic ID Badge */}
            <div className="rx-badge-container">
              <div className="rx-badge-chip">
                <span className="rx-chip-glow" />
                <span className="rx-badge-code">{code}</span>
                <button
                  className="rx-copy-chip-btn"
                  onClick={handleCopyCode}
                  title="Copy ID Code"
                >
                  {copiedCode ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* QR Visual Canvas */}
            <div className="rx-qr-frame">
              <div className="rx-qr-box">
                <canvas ref={canvasRef} className="rx-qr-canvas" />
                <div className="rx-qr-overlay-logo">
                  <Sparkles size={14} className="text-indigo-600" />
                </div>
              </div>
              <p className="rx-qr-caption">Scan with any Rxify app or mobile camera</p>
            </div>

            {/* Details List */}
            {details.length > 0 && (
              <div className="rx-details-grid">
                {details.map((d, i) => (
                  <div key={i} className="rx-detail-row">
                    <span className="rx-detail-label">{d.label}</span>
                    <span className="rx-detail-val">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="rx-modal-actions">
              <button className="rx-btn-secondary" onClick={handleCopyCode}>
                {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedCode ? 'Copied to Clipboard' : 'Copy ID Code'}</span>
              </button>
              <button className="rx-btn-primary" onClick={handleDownloadQr}>
                <Download size={16} />
                <span>Download QR Code (PNG)</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Patient Medical Record Sharing (Public Link) */}
        {activeTab === 'shareToken' && (
          <div className="rx-share-token-content">
            <div className="rx-share-token-desc">
              <p>Generate a secure, temporary web link that allows any doctor or family member to view your prescription history without logging in.</p>
            </div>

            <div className="rx-token-form">
              <label className="rx-form-label">Note / Purpose (Optional)</label>
              <input
                type="text"
                className="rx-form-input"
                placeholder="e.g. Dr. Martinez Consultation"
                value={shareLabel}
                onChange={(e) => setShareLabel(e.target.value)}
              />

              <label className="rx-form-label">Link Valid For</label>
              <div className="rx-expiry-options">
                {[
                  { label: '24 Hours', val: 1 },
                  { label: '7 Days', val: 7 },
                  { label: '30 Days', val: 30 },
                  { label: 'Permanent', val: null },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    className={`rx-expiry-btn ${shareExpiry === opt.val ? 'rx-expiry-btn--active' : ''}`}
                    onClick={() => setShareExpiry(opt.val)}
                  >
                    <Clock size={13} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              {tokenError && <p className="rx-token-error">{tokenError}</p>}

              <button
                className="rx-generate-token-btn"
                onClick={handleGenerateShareToken}
                disabled={tokenLoading}
              >
                {tokenLoading ? 'Generating...' : 'Generate New Share Link'}
              </button>
            </div>

            {/* Generated Link Result */}
            {generatedToken && (
              <div className="rx-token-result-box">
                <p className="rx-token-result-label">Your Shareable Link:</p>
                <div className="rx-token-link-row">
                  <input
                    type="text"
                    readOnly
                    className="rx-token-link-input"
                    value={`${window.location.origin}/share/${generatedToken}`}
                  />
                  <button className="rx-copy-link-btn" onClick={handleCopyShareLink}>
                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
