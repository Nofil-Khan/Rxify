import { z } from 'zod';

export const PatientSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number().int().positive(),
  gender: z.enum(['Male', 'Female', 'Other']),
  initials: z.string().optional(),
});
export type Patient = z.infer<typeof PatientSchema>;

export const DoctorSchema = z.object({
  id: z.string(),
  name: z.string(),
  specialty: z.string(),
});
export type Doctor = z.infer<typeof DoctorSchema>;

export const MedicineSchema = z.object({
  id: z.string(),
  name: z.string(),
  strength: z.string(),
  form: z.enum(['Capsule', 'Tablet', 'Syrup', 'Inhaler', 'Cup', 'Injection']),
  imageUrl: z.string().optional(),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
});
export type Medicine = z.infer<typeof MedicineSchema>;

export const BatchSchema = z.object({
  batchNumber: z.string(),
  expiryDate: z.string(),
  quantity: z.number().nonnegative(),
});
export type Batch = z.infer<typeof BatchSchema>;

export const InventoryItemSchema = z.object({
  medicineId: z.string(),
  available: z.number().nonnegative(),
  reserved: z.number().nonnegative(),
  reorderLevel: z.number().nonnegative(),
  batches: z.array(BatchSchema),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const PrescriptionItemSchema = z.object({
  medicine: MedicineSchema,
  qty: z.number().int().positive(),
  inStock: z.number().nonnegative().optional(),
  dosage: z.string().optional(),
});
export type PrescriptionItem = z.infer<typeof PrescriptionItemSchema>;

export const PrescriptionSchema = z.object({
  id: z.string(),
  rxNumber: z.string(),
  status: z.enum(['NEW', 'PREPARING', 'PREPARING_RESERVED', 'READY', 'READY_VERIFIED', 'COMPLETED']),
  createdAt: z.string(),
  patient: PatientSchema,
  doctor: DoctorSchema,
  diagnosis: z.string(),
  notes: z.string(),
  items: z.array(PrescriptionItemSchema),
  flagged: z.boolean().default(false),
  timeAgo: z.string().optional(),
});
export type Prescription = z.infer<typeof PrescriptionSchema>;

export type FulfillmentStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'SUBSTITUTED' | 'DECLINED' | 'RECONSULTATION_NEEDED';
export type RequestStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'DISPENSED' | 'CANCELLED' | 'RECONSULTATION_NEEDED';

export interface WorkspaceMedicine {
  id: string;
  name: string;
  strength: string;
  form: 'Capsule' | 'Tablet' | 'Syrup' | 'Inhaler' | 'Cup' | 'Injection';
  genericName?: string;
  brandName?: string;
  prescribedQuantity: number;
  inStockQuantity: number;
  reservedQuantity?: number;
  reorderLevel?: number;
  status: FulfillmentStatus;
  dispensedQuantity?: number;
  dosageInstructions?: string;
  batchNumber?: string;
  expiryDate?: string;
  reconsultationNotes?: string;
  suggestedSubstitute?: string;
}

export interface WorkspacePrescription {
  id: string;
  rxNumber: string;
  patientName: string;
  patientInitials: string;
  patientAge: number;
  patientGender: 'Male' | 'Female' | 'Other';
  date: string;
  doctorName: string;
  doctorSpecialty: string;
  diagnosis: string;
  notes: string;
  status: RequestStatus;
  timeAgo: string;
  createdAt?: string;
  priority?: 'NORMAL' | 'URGENT';
  medicines: WorkspaceMedicine[];
  hasAlert?: boolean;
}

export interface PipelineStats {
  newCount: number;
  preparingCount: number;
  readyCount: number;
  completedCount: number;
}

export const BackendCommandResultSchema = z.object({
  success: z.boolean().default(true),
  message: z.string().default('Success'),
  status: z.string().optional(),
  data: z.unknown().optional(),
  request: z.unknown().optional(),
});
export type BackendCommandResult = z.infer<typeof BackendCommandResultSchema>;

export const DispensaryDashboardStatsSchema = z.object({
  pending_count: z.number().default(0),
  processing_count: z.number().default(0),
  ready_count: z.number().default(0),
  dispensed_today: z.number().default(0),
  revenue: z.number().default(0),
});
export type DispensaryDashboardStats = z.infer<typeof DispensaryDashboardStatsSchema>;
