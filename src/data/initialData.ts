import { Specialty, Doctor, Appointment, ClinicConfig } from '../types';
import { DEFAULT_PIN_HASH } from '../utils/pinSecurity';

export const initialClinicConfig: ClinicConfig = {
  name: 'Mi Consultorio Médico',
  tagline: 'Gestión y Reserva Médica',
  phone: '',
  whatsappCountryCode: '',
  whatsappNumber: '',
  address: '',
  city: '',
  currencySymbol: '$',
  welcomeMessage: 'Te damos la bienvenida a nuestro sistema de reservas por WhatsApp. Selecciona tu especialidad y horario para agendar tu cita.',
  openDaysText: 'Lunes a Sábado',
  adminPin: DEFAULT_PIN_HASH,
  defaultSlotDurationMinutes: 30,
};

// Start with completely blank data to test from scratch
export const initialSpecialties: Specialty[] = [];

export const initialDoctors: Doctor[] = [];

export const initialAppointments: Appointment[] = [];
