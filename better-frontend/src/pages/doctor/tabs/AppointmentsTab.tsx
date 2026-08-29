import { useState, useEffect } from 'react';
import {
  Calendar, Clock, CheckCircle2, XCircle, Check,
  User, Building2, Plus, Filter, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  getDoctorAppointments, updateAppointmentStatus, getDoctorSlots,
  createDoctorSlot, getDoctorClinics,
  AppointmentItem, AppointmentCounts, AvailabilitySlot, ClinicOption, getInitials
} from '../../../lib/doctorApi';

export default function AppointmentsTab() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [counts, setCounts]             = useState<AppointmentCounts>({ booked: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0, upcoming: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading]           = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Slots & Clinic modal state
  const [slots, setSlots]               = useState<AvailabilitySlot[]>([]);
  const [clinics, setClinics]           = useState<ClinicOption[]>([]);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [creatingSlot, setCreatingSlot]   = useState(false);

  // Slot Form
  const [slotClinicId, setSlotClinicId]   = useState<number>(1);
  const [slotDate, setSlotDate]           = useState<string>('');
  const [slotStartTime, setSlotStartTime] = useState<string>('09:00');
  const [slotEndTime, setSlotEndTime]     = useState<string>('12:00');
  const [slotMaxPatients, setSlotMaxPatients] = useState<number>(5);

  const loadData = async () => {
    setLoading(true);
    const [apptRes, slotsData, clinicsData] = await Promise.all([
      getDoctorAppointments(statusFilter),
      getDoctorSlots(),
      getDoctorClinics(),
    ]);
    setAppointments(apptRes.appointments ?? []);
    setCounts(apptRes.counts);
    setSlots(slotsData ?? []);
    setClinics(clinicsData ?? []);
    if (clinicsData && clinicsData.length > 0 && !slotClinicId) {
      setSlotClinicId(clinicsData[0].clinic_id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleStatusChange = async (appointmentId: number, newStatus: string, patientName: string) => {
    // Optimistic update
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus as any } : a))
    );
    setActionNotice(`Updated appointment for ${patientName} to ${newStatus}`);
    setTimeout(() => setActionNotice(null), 3500);

    await updateAppointmentStatus(appointmentId, newStatus);
    // Reload counts in background
    const apptRes = await getDoctorAppointments(statusFilter);
    setCounts(apptRes.counts);
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotDate || !slotStartTime || !slotEndTime) return;

    setCreatingSlot(true);
    const newSlot = await createDoctorSlot({
      clinic_id: slotClinicId || (clinics[0]?.clinic_id ?? 1),
      slot_date: slotDate,
      start_time: slotStartTime + ':00',
      end_time: slotEndTime + ':00',
      max_patients: slotMaxPatients,
    });
    setCreatingSlot(false);

    if (newSlot) {
      setSlots((prev) => [...prev, newSlot]);
      setShowSlotModal(false);
      setActionNotice('Availability slot created successfully!');
      setTimeout(() => setActionNotice(null), 3500);
    }
  };

  return (
    <div className="dd-bento-grid">
      {/* Action Toast */}
      {actionNotice && (
        <div
          className="dd-span-12"
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--dd-emerald-bg)',
            border: '1px solid var(--dd-emerald)',
            color: 'var(--dd-emerald)',
            fontSize: '0.88rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* ── 4 STAT CARDS ─────────────────────────────────────────── */}
      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--teal">
          <Calendar size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{counts.upcoming}</span>
          <span className="dd-stat-lbl">Upcoming Consults</span>
          <span className="dd-stat-sub">Booked & Confirmed</span>
        </div>
      </div>

      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--amber">
          <Clock size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{counts.booked}</span>
          <span className="dd-stat-lbl">Pending Confirmation</span>
          <span className="dd-stat-sub" style={{ color: 'var(--dd-amber)' }}>Requires Doctor Action</span>
        </div>
      </div>

      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--indigo">
          <CheckCircle2 size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{counts.confirmed}</span>
          <span className="dd-stat-lbl">Confirmed Visits</span>
          <span className="dd-stat-sub">Ready for consultation</span>
        </div>
      </div>

      <div className="dd-bento-card dd-span-3 dd-stat-card">
        <div className="dd-stat-icon dd-stat-icon--emerald">
          <Check size={22} />
        </div>
        <div className="dd-stat-body">
          <span className="dd-stat-val">{counts.completed}</span>
          <span className="dd-stat-lbl">Completed</span>
          <span className="dd-stat-sub">Past Consultations</span>
        </div>
      </div>

      {/* ── APPOINTMENTS LIST (Span 8) ─────────────────────────────────── */}
      <div className="dd-bento-card dd-span-8">
        <div className="dd-card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="dd-card-title">
            <Calendar size={18} className="dd-card-title-icon" />
            Patient Appointments
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--dd-text-muted)' }} />
              <select
                className="dd-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '4px 10px', fontSize: '0.82rem' }}
                aria-label="Filter status"
              >
                <option value="all">All Appointments</option>
                <option value="booked">Booked (Pending)</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button className="dd-btn-outline" onClick={loadData} title="Refresh list" style={{ padding: '6px' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '1rem' }}>
            <div className="dd-skeleton" style={{ height: '70px' }} />
            <div className="dd-skeleton" style={{ height: '70px' }} />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--dd-text-muted)' }}>
            <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <p>No appointments found under this filter.</p>
          </div>
        ) : (
          <div className="dd-list">
            {appointments.map((apt) => {
              const statusColors: Record<string, { bg: string; color: string }> = {
                BOOKED:    { bg: 'var(--dd-amber-bg)', color: 'var(--dd-amber)' },
                CONFIRMED: { bg: 'var(--dd-indigo-bg)', color: 'var(--dd-indigo)' },
                COMPLETED: { bg: 'var(--dd-emerald-bg)', color: 'var(--dd-emerald)' },
                CANCELLED: { bg: 'var(--dd-rose-bg)', color: 'var(--dd-rose)' },
                NO_SHOW:   { bg: 'var(--dd-bg-card-sub)', color: 'var(--dd-text-muted)' },
              };
              const theme = statusColors[apt.status] || { bg: 'var(--dd-bg-card-sub)', color: 'var(--dd-text-muted)' };

              return (
                <div key={apt.id} className="dd-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="dd-item-left">
                      <div className="dd-avatar">
                        {getInitials(apt.patient_name)}
                      </div>
                      <div className="dd-item-meta">
                        <span className="dd-item-title">{apt.patient_name || 'Patient'}</span>
                        <span className="dd-item-sub dd-item-mono">{apt.patient_email}</span>
                      </div>
                    </div>

                    <span
                      className="dd-doctor-badge"
                      style={{
                        background: theme.bg,
                        color: theme.color,
                        borderColor: theme.color,
                      }}
                    >
                      {apt.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.82rem', color: 'var(--dd-text-sub)', background: 'var(--dd-bg-card)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={13} style={{ color: 'var(--dd-teal)' }} />
                      <span className="dd-item-mono">{apt.slot_date ?? 'Unscheduled'}</span>
                    </div>

                    {(apt.start_time || apt.end_time) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={13} style={{ color: 'var(--dd-indigo)' }} />
                        <span className="dd-item-mono">
                          {apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)}
                        </span>
                      </div>
                    )}

                    {apt.clinic_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Building2 size={13} />
                        <span>{apt.clinic_name}</span>
                      </div>
                    )}
                  </div>

                  {apt.reason_for_visit && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--dd-text-main)', paddingLeft: '4px' }}>
                      <strong>Reason:</strong> {apt.reason_for_visit}
                    </div>
                  )}

                  {/* Actions depending on status */}
                  <div className="dd-actions-row" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
                    {apt.status === 'BOOKED' && (
                      <>
                        <button
                          className="dd-btn-reject"
                          onClick={() => handleStatusChange(apt.id, 'CANCELLED', apt.patient_name)}
                        >
                          <XCircle size={13} /> Cancel
                        </button>
                        <button
                          className="dd-btn-accept"
                          onClick={() => handleStatusChange(apt.id, 'CONFIRMED', apt.patient_name)}
                        >
                          <CheckCircle2 size={13} /> Confirm Appointment
                        </button>
                      </>
                    )}

                    {apt.status === 'CONFIRMED' && (
                      <>
                        <button
                          className="dd-btn-reject"
                          onClick={() => handleStatusChange(apt.id, 'CANCELLED', apt.patient_name)}
                        >
                          <XCircle size={13} /> Cancel
                        </button>
                        <button
                          className="dd-btn-accept"
                          onClick={() => handleStatusChange(apt.id, 'COMPLETED', apt.patient_name)}
                        >
                          <Check size={13} /> Mark Completed
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── AVAILABILITY SLOTS (Span 4) ───────────────────────────────── */}
      <div className="dd-bento-card dd-span-4">
        <div className="dd-card-header">
          <h3 className="dd-card-title">
            <Clock size={18} className="dd-card-title-icon" style={{ color: 'var(--dd-teal)' }} />
            Availability Slots
          </h3>
          <button className="dd-btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setShowSlotModal(true)}>
            <Plus size={14} /> Add Slot
          </button>
        </div>

        <p className="dd-item-sub" style={{ marginBottom: '10px' }}>
          Configured time windows when patients can book consultations.
        </p>

        {slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--dd-text-muted)', fontSize: '0.85rem' }}>
            <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p>No availability slots defined yet.</p>
            <button
              className="dd-btn-outline"
              style={{ marginTop: '10px', width: '100%' }}
              onClick={() => setShowSlotModal(true)}
            >
              <Plus size={14} /> Create Availability Window
            </button>
          </div>
        ) : (
          <div className="dd-list">
            {slots.map((s) => (
              <div key={s.slot_id} className="dd-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="dd-item-title" style={{ fontSize: '0.88rem' }}>
                    {s.slot_date}
                  </span>
                  <span className="dd-badge-count" style={{ fontSize: '0.72rem' }}>
                    {s.booked_count} / {s.max_patients} Booked
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--dd-teal)' }} className="dd-item-mono">
                  <Clock size={12} /> {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                </div>

                {s.clinic_name && (
                  <span className="dd-item-sub" style={{ fontSize: '0.75rem' }}>
                    {s.clinic_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE SLOT MODAL ────────────────────────────────────────── */}
      {showSlotModal && (
        <div className="dd-modal-backdrop" onClick={() => setShowSlotModal(false)}>
          <div className="dd-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="dd-modal-header">
              <h3 className="dd-card-title">
                <Plus size={18} className="dd-card-title-icon" />
                Add Practice Availability Slot
              </h3>
              <button className="dd-icon-btn" onClick={() => setShowSlotModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSlot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem 0' }}>
              <div>
                <label className="dd-stat-lbl" style={{ display: 'block', marginBottom: '6px' }}>Clinic / Hospital Location</label>
                <select
                  className="dd-select"
                  style={{ width: '100%' }}
                  value={slotClinicId}
                  onChange={(e) => setSlotClinicId(Number(e.target.value))}
                  required
                >
                  {clinics.map((c) => (
                    <option key={c.clinic_id} value={c.clinic_id}>
                      {c.name} {c.address ? `(${c.address})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="dd-stat-lbl" style={{ display: 'block', marginBottom: '6px' }}>Slot Date</label>
                <input
                  type="date"
                  className="dd-input"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="dd-stat-lbl" style={{ display: 'block', marginBottom: '6px' }}>Start Time</label>
                  <input
                    type="time"
                    className="dd-input"
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="dd-stat-lbl" style={{ display: 'block', marginBottom: '6px' }}>End Time</label>
                  <input
                    type="time"
                    className="dd-input"
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="dd-stat-lbl" style={{ display: 'block', marginBottom: '6px' }}>Max Patients Capacity</label>
                <input
                  type="number"
                  className="dd-input"
                  min="1"
                  max="50"
                  value={slotMaxPatients}
                  onChange={(e) => setSlotMaxPatients(Number(e.target.value))}
                  required
                />
              </div>

              <div className="dd-modal-footer" style={{ borderTop: '1px solid var(--dd-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="dd-btn-outline" onClick={() => setShowSlotModal(false)}>Cancel</button>
                <button type="submit" className="dd-btn-primary" disabled={creatingSlot}>
                  {creatingSlot ? 'Creating...' : 'Create Availability Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

