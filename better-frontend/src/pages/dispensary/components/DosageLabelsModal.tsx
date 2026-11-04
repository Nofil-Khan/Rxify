import React from "react";
import {
  Printer,
  X,
  Building2,
  User,
  Pill,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import type { RequestDetail } from "../../../lib/dispensaryApi";

interface DosageLabelsModalProps {
  detail: RequestDetail;
  onClose: () => void;
}

export default function DosageLabelsModal({
  detail,
  onClose,
}: DosageLabelsModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const nowTimeStr = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="disp-modal-backdrop"
      onClick={onClose}
      style={{ zIndex: 1100 }}
    >
      <div
        className="disp-modal disp-print-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "850px",
          width: "95%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: "0",
          overflow: "hidden",
          background: "var(--surface-color)",
          borderRadius: "0.85rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* Modal Non-Print Header */}
        <div
          className="disp-no-print"
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface-hover)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Printer size={20} style={{ color: "#0284c7" }} />
            <h3
              style={{
                margin: 0,
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Print Dosage Labels & Handover Receipt
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "0.45rem 0.9rem",
                borderRadius: "0.5rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Printer size={15} />
              <span>Print Document</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                padding: "0.3rem",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Sheet */}
        <div
          id="rx-printable-sheet"
          style={{
            padding: "2rem",
            overflowY: "auto",
            flex: 1,
            color: "#0f172a",
            background: "#ffffff",
          }}
        >
          {/* Dispensary & Order Header */}
          <div
            style={{
              borderBottom: "2px solid #0f172a",
              paddingBottom: "1rem",
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Building2 size={22} style={{ color: "#0284c7" }} />
                <h1
                  style={{
                    fontSize: "1.35rem",
                    fontWeight: 800,
                    margin: 0,
                    color: "#0f172a",
                  }}
                >
                  {detail.dispensary_name}
                </h1>
              </div>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#475569",
                  margin: "0.25rem 0 0",
                }}
              >
                {detail.dispensary_location || "Central Pharmacy Department"} •
                Gwalior, Madhya Pradesh
              </p>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: "0.82rem",
                color: "#475569",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#0284c7",
                }}
              >
                DISPENSE ORDER #{detail.request_id}
              </div>
              <div>Prescription #{detail.prescription_id}</div>
              <div>
                Date: {todayStr} • {nowTimeStr}
              </div>
              {detail.pickup_code && (
                <div
                  style={{
                    fontWeight: 700,
                    color: "#0f172a",
                    marginTop: "0.2rem",
                  }}
                >
                  Pickup Verification:{" "}
                  <span style={{ fontFamily: "monospace" }}>
                    {detail.pickup_code}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Patient & Doctor Meta Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              padding: "0.85rem 1rem",
              background: "#f8fafc",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
              marginBottom: "1.5rem",
              fontSize: "0.83rem",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                Patient Information
              </span>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#0f172a",
                }}
              >
                {detail.patient_name}
              </div>
              <div style={{ color: "#475569" }}>
                ID: {detail.patient_code || `PT-${detail.patient_id}`}
              </div>
              {detail.patient_phone && (
                <div style={{ color: "#475569" }}>
                  Phone: {detail.patient_phone}
                </div>
              )}
              {detail.diagnosis && (
                <div style={{ color: "#475569", marginTop: "0.2rem" }}>
                  Dx: {detail.diagnosis}
                </div>
              )}
            </div>

            <div>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                Prescribing Doctor
              </span>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#0f172a",
                }}
              >
                {detail.doctor_name
                  ? `Dr. ${detail.doctor_name}`
                  : "Attending Physician"}
              </div>
              {detail.doctor_specialty && (
                <div style={{ color: "#475569" }}>
                  Specialty: {detail.doctor_specialty}
                </div>
              )}
              {detail.issue_date && (
                <div style={{ color: "#475569" }}>
                  Rx Issued: {detail.issue_date}
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Printable Pill Box Labels */}
          <div style={{ marginBottom: "2rem" }}>
            <h2
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "0.4rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Pill size={16} style={{ color: "#0284c7" }} />
              Medication Dosage Instruction Labels ({detail.items?.length || 0})
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "1rem",
              }}
            >
              {detail.items?.map((item, idx) => {
                const displayName = item.brand_name
                  ? `${item.brand_name} (${item.generic_name || item.prescribed_medicine_name})`
                  : item.prescribed_medicine_name;

                return (
                  <div
                    key={item.item_id || idx}
                    style={{
                      border: "1.5px dashed #94a3b8",
                      borderRadius: "0.5rem",
                      padding: "0.85rem",
                      background: "#ffffff",
                      position: "relative",
                    }}
                  >
                    {/* Label header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #cbd5e1",
                        paddingBottom: "0.35rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          color: "#0284c7",
                        }}
                      >
                        {detail.dispensary_name}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                        {todayStr}
                      </span>
                    </div>

                    {/* Patient */}
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "#0f172a",
                        marginBottom: "0.2rem",
                      }}
                    >
                      {detail.patient_name}{" "}
                      <span style={{ fontWeight: 400, color: "#64748b" }}>
                        ({detail.patient_code || `PT-${detail.patient_id}`})
                      </span>
                    </div>

                    {/* Drug Name & Strength */}
                    <div
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 800,
                        color: "#0f172a",
                        margin: "0.3rem 0",
                      }}
                    >
                      {displayName} {item.strength ? `• ${item.strength}` : ""}
                    </div>

                    {/* Directions */}
                    <div
                      style={{
                        background: "#f1f5f9",
                        padding: "0.4rem 0.6rem",
                        borderRadius: "0.35rem",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "#1e293b",
                        margin: "0.4rem 0",
                      }}
                    >
                      DIRECTIONS:{" "}
                      {item.instructions ||
                        `${item.dosage || "1 unit"} - ${item.frequency || "As directed"} ${item.duration ? `for ${item.duration}` : ""}`}
                    </div>

                    {/* Qty & Caution */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.72rem",
                        color: "#64748b",
                        marginTop: "0.4rem",
                      }}
                    >
                      <span>
                        Qty: {item.dispensed_quantity || item.required_quantity}{" "}
                        {item.form || "units"}
                      </span>
                      <span style={{ color: "#b45309", fontWeight: 600 }}>
                        ⚠️ KEEP OUT OF REACH OF CHILDREN
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Dispense Handover Receipt */}
          <div
            style={{
              borderTop: "2px solid #0f172a",
              paddingTop: "1.25rem",
            }}
          >
            <h2
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <ShieldCheck size={16} style={{ color: "#10b981" }} />
              Official Pharmacy Handover Record
            </h2>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
                marginBottom: "1.25rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #cbd5e1",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "0.45rem 0.6rem" }}>#</th>
                  <th style={{ padding: "0.45rem 0.6rem" }}>Medication Name</th>
                  <th style={{ padding: "0.45rem 0.6rem" }}>Dosage & Form</th>
                  <th style={{ padding: "0.45rem 0.6rem" }}>Quantity</th>
                  <th style={{ padding: "0.45rem 0.6rem" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.items?.map((item, idx) => (
                  <tr
                    key={item.item_id || idx}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "0.45rem 0.6rem", color: "#64748b" }}>
                      {idx + 1}
                    </td>
                    <td
                      style={{
                        padding: "0.45rem 0.6rem",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      {item.brand_name ||
                        item.generic_name ||
                        item.prescribed_medicine_name}
                      {item.strength ? ` ${item.strength}` : ""}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", color: "#475569" }}>
                      {item.dosage || "Standard"} • {item.form || "Unit"}
                    </td>
                    <td
                      style={{
                        padding: "0.45rem 0.6rem",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    >
                      {item.dispensed_quantity || item.required_quantity}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem" }}>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>
                        VERIFIED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signature & Stamp Footer */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "2rem",
                marginTop: "1.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid #e2e8f0",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <p style={{ color: "#64748b", margin: "0 0 2.5rem" }}>
                  Patient / Representative Acknowledgement:
                </p>
                <div
                  style={{
                    borderTop: "1px solid #94a3b8",
                    width: "80%",
                    paddingTop: "0.25rem",
                    color: "#475569",
                  }}
                >
                  Signature of Recipient
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <p style={{ color: "#64748b", margin: "0 0 0.5rem" }}>
                  Dispensed & Verified by Authorized Pharmacist:
                </p>
                {detail.verification_signature ? (
                  <div style={{ marginBottom: "1rem", textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#047857",
                        fontFamily: "monospace",
                      }}
                    >
                      ✓ DIGITAL SIGNATURE: {detail.verification_signature}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#475569" }}>
                      Signee: {detail.verified_by_name || "Clinical Pharmacist"}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: "2rem" }} />
                )}
                <div
                  style={{
                    borderTop: "1px solid #94a3b8",
                    width: "80%",
                    marginLeft: "auto",
                    paddingTop: "0.25rem",
                    color: "#475569",
                  }}
                >
                  Registered Pharmacist Stamp & Sign
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Print Stylesheet */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #rx-printable-sheet, #rx-printable-sheet * {
              visibility: visible;
            }
            #rx-printable-sheet {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 10mm;
              margin: 0;
              background: #ffffff !important;
              color: #000000 !important;
            }
            .disp-no-print {
              display: none !important;
            }
          }
        `,
          }}
        />
      </div>
    </div>
  );
}
