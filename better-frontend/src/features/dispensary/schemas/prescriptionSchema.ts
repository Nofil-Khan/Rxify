import { z } from 'zod';

export const FulfillmentStatusSchema = z.enum([
  'AVAILABLE',
  'PARTIAL',
  'UNAVAILABLE',
  'SUBSTITUTED',
  'DECLINED',
  'RECONSULTATION_NEEDED',
]);

export const RequestStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'PARTIALLY_AVAILABLE',
  'UNAVAILABLE',
  'DISPENSED',
  'CANCELLED',
  'RECONSULTATION_NEEDED',
]);

export const WorkspaceMedicineSchema = z.object({
  id: z.string(),
  name: z.string(),
  strength: z.string(),
  form: z.enum(['Capsule', 'Tablet', 'Syrup', 'Inhaler', 'Cup', 'Injection']),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  prescribedQuantity: z.number().nonnegative(),
  inStockQuantity: z.number().nonnegative(),
  reservedQuantity: z.number().optional(),
  reorderLevel: z.number().optional(),
  status: FulfillmentStatusSchema,
  dispensedQuantity: z.number().optional(),
  dosageInstructions: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  reconsultationNotes: z.string().optional(),
  suggestedSubstitute: z.string().optional(),
});

export const WorkspacePrescriptionSchema = z.object({
  id: z.string(),
  rxNumber: z.string(),
  patientName: z.string(),
  patientInitials: z.string(),
  patientAge: z.number(),
  patientGender: z.enum(['Male', 'Female', 'Other']),
  date: z.string(),
  doctorName: z.string(),
  doctorSpecialty: z.string(),
  diagnosis: z.string(),
  notes: z.string(),
  status: RequestStatusSchema,
  timeAgo: z.string(),
  createdAt: z.string().optional(),
  priority: z.enum(['NORMAL', 'URGENT']).optional(),
  medicines: z.array(WorkspaceMedicineSchema),
  hasAlert: z.boolean().optional(),
});

export type ValidatedMedicine = z.infer<typeof WorkspaceMedicineSchema>;
export type ValidatedPrescription = z.infer<typeof WorkspacePrescriptionSchema>;

export function resolveStockStatus(
  inStock: number,
  prescribed: number
): 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' {
  if (inStock >= prescribed) return 'AVAILABLE';
  if (inStock > 0 && inStock < prescribed) return 'PARTIAL';
  return 'UNAVAILABLE';
}

