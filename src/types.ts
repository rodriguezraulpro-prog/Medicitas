export type AppointmentStatus = 'pendiente_whatsapp' | 'confirmada' | 'atendida' | 'cancelada';

export type ConsultationType = 'presencial' | 'teleconsulta';

export interface Specialty {
  id: string;
  name: string;
  description: string;
  iconName: string;
  color: string;
  active: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  specialtyId: string;
  photoUrl: string;
  consultorio: string;
  fee: number;
  rating: number;
  availableDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startHour: string; // "08:00"
  endHour: string; // "18:00"
  slotDurationMinutes: number; // 30
  lunchStart?: string; // "13:00"
  lunchEnd?: string; // "14:00"
  active: boolean;
  phone?: string;
}

export interface Appointment {
  id: string; // e.g. "MC-7842"
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  patientDni?: string;
  reason: string;
  type: ConsultationType;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  doctorId: string;
  doctorName: string;
  specialtyId: string;
  specialtyName: string;
  status: AppointmentStatus;
  createdAt: string; // ISO string
  fee: number;
  consultorio: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: 'paciente' | 'clinica';
  cancelledAt?: string;
}

export interface ClinicConfig {
  name: string;
  tagline: string;
  phone: string;
  whatsappCountryCode: string; // e.g. "+52"
  whatsappNumber: string; // e.g. "5541697820"
  address: string;
  city: string;
  currencySymbol: string;
  welcomeMessage: string;
  openDaysText: string;
  adminPin: string;
  defaultSlotDurationMinutes?: number;
}

export interface BlockedSlot {
  id: string;
  doctorId: string;
  date: string;
  time?: string; // if undefined, blocks whole day
  reason: string;
}
