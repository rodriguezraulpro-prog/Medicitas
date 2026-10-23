import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Appointment, Doctor, Specialty, ClinicConfig, BlockedSlot } from '../types';
import { DEFAULT_PIN_HASH, encodePinForStorage } from '../utils/pinSecurity';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const SUPABASE_STORAGE_KEY = 'medicitas_cloud_config_v3';

// Purge legacy stored credentials so the template starts completely blank
try {
  localStorage.removeItem('medicitas_supabase_config');
  localStorage.removeItem('medicitas_cloud_config_v2');
} catch {
  // Ignore error
}

// 1. Get configuration from custom local configuration (blank by default for clean template)
export function getStoredSupabaseConfig(): SupabaseConfig {
  try {
    const saved = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return {
          url: String(parsed.url).trim(),
          anonKey: String(parsed.anonKey).trim(),
        };
      }
    }
  } catch {
    // Ignore error
  }

  return {
    url: '',
    anonKey: '',
  };
}

export function saveStoredSupabaseConfig(config: SupabaseConfig): void {
  try {
    if (!config.url || !config.anonKey) {
      localStorage.removeItem(SUPABASE_STORAGE_KEY);
    } else {
      localStorage.setItem(
        SUPABASE_STORAGE_KEY,
        JSON.stringify({ url: config.url.trim(), anonKey: config.anonKey.trim() })
      );
    }
    // Re-initialize client
    activeClient = null;
  } catch (err) {
    console.error('Failed to save Supabase config to localStorage', err);
  }
}

// Fetch configuration from the backend server (allows all devices/phones to sync)
export async function fetchServerSupabaseConfig(): Promise<SupabaseConfig | null> {
  try {
    const res = await fetch('./api/config/supabase');
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) return null;
    const data = await res.json();
    if (data.url && data.anonKey) {
      saveStoredSupabaseConfig({ url: data.url, anonKey: data.anonKey });
      return { url: data.url, anonKey: data.anonKey };
    }
  } catch {
    // Graceful silent fallback for static hosts (Cloudflare Pages / GitHub Pages)
  }
  return null;
}

// Save configuration both to localStorage and the backend server for all devices
export async function saveServerSupabaseConfig(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    saveStoredSupabaseConfig(config);

    const res = await fetch('./api/config/supabase', {
      method: config.url && config.anonKey ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: config.url && config.anonKey ? JSON.stringify(config) : undefined,
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return {
        success: true,
        message: 'Configuración de la Nube guardada exitosamente.',
      };
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || 'Configuración guardada para todos los dispositivos.',
    };
  } catch {
    return {
      success: true,
      message: 'Configuración de la Nube guardada exitosamente.',
    };
  }
}

let activeClient: SupabaseClient | null = null;

export function setSupabaseClientConfig(config: SupabaseConfig | null): void {
  activeClient = null;
  if (config && config.url && config.anonKey) {
    try {
      activeClient = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.warn('Failed to set Supabase client config:', err);
    }
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (activeClient) return activeClient;

  const config = getStoredSupabaseConfig();
  if (config.url && config.anonKey) {
    try {
      activeClient = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
        },
      });
      return activeClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  const config = getStoredSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

// Test connection
export async function testSupabaseConnection(config?: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const targetConfig = config || getStoredSupabaseConfig();
    if (!targetConfig.url || !targetConfig.anonKey) {
      return { success: false, message: 'La URL y el Anon Key de la Nube son requeridos.' };
    }

    const testClient = createClient(targetConfig.url, targetConfig.anonKey, {
      auth: { persistSession: false },
    });

    // Try a simple query on clinic_config or health check
    const { error } = await testClient.from('clinic_config').select('id').limit(1);

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Conectó a la Nube, pero aún no se han creado las tablas. Ejecuta el script SQL en el SQL Editor de tu proyecto en la Nube.',
        };
      }
      return { success: false, message: `Error de conexión con la Nube: ${error.message}` };
    }

    return { success: true, message: '¡Conexión exitosa a la Nube!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'No se pudo conectar a la URL indicada.' };
  }
}

// -------------------------------------------------------------
// Mapping Helpers (camelCase in TS <-> snake_case in PostgreSQL)
// -------------------------------------------------------------

function mapConfigFromDb(row: any): ClinicConfig {
  return {
    name: row.name || 'Mi Consultorio Médico',
    tagline: row.tagline || '',
    phone: row.phone || '',
    whatsappCountryCode: row.whatsapp_country_code || '',
    whatsappNumber: row.whatsapp_number || '',
    address: row.address || '',
    city: row.city || '',
    currencySymbol: row.currency_symbol || '$',
    welcomeMessage: row.welcome_message || '',
    openDaysText: row.open_days_text || 'Lunes a Sábado',
    adminPin: row.admin_pin ? encodePinForStorage(String(row.admin_pin)) : DEFAULT_PIN_HASH,
    defaultSlotDurationMinutes: Number(row.default_slot_duration_minutes) || 30,
  };
}

function mapConfigToDb(config: ClinicConfig): any {
  return {
    id: 'default',
    name: config.name,
    tagline: config.tagline,
    phone: config.phone,
    whatsapp_country_code: config.whatsappCountryCode,
    whatsapp_number: config.whatsappNumber,
    address: config.address,
    city: config.city,
    currency_symbol: config.currencySymbol,
    welcome_message: config.welcomeMessage,
    open_days_text: config.openDaysText,
    admin_pin: encodePinForStorage(config.adminPin),
    default_slot_duration_minutes: config.defaultSlotDurationMinutes || 30,
    updated_at: new Date().toISOString(),
  };
}

function mapDoctorFromDb(row: any): Doctor {
  return {
    id: row.id,
    name: row.name,
    specialtyId: row.specialty_id,
    photoUrl: row.photo_url || '',
    consultorio: row.consultorio || '',
    fee: Number(row.fee) || 0,
    rating: Number(row.rating) || 5.0,
    availableDays: Array.isArray(row.available_days) ? row.available_days : [1, 2, 3, 4, 5],
    startHour: row.start_hour || '08:00',
    endHour: row.end_hour || '18:00',
    slotDurationMinutes: Number(row.slot_duration_minutes) || 30,
    lunchStart: row.lunch_start || undefined,
    lunchEnd: row.lunch_end || undefined,
    active: row.active ?? true,
    phone: row.phone || '',
  };
}

function mapDoctorToDb(doc: Doctor): any {
  return {
    id: doc.id,
    name: doc.name,
    specialty_id: doc.specialtyId,
    photo_url: doc.photoUrl || '',
    consultorio: doc.consultorio || '',
    fee: doc.fee,
    rating: doc.rating,
    available_days: doc.availableDays,
    start_hour: doc.startHour,
    end_hour: doc.endHour,
    slot_duration_minutes: doc.slotDurationMinutes || 30,
    lunch_start: doc.lunchStart || null,
    lunch_end: doc.lunchEnd || null,
    active: doc.active,
    phone: doc.phone || '',
  };
}

function mapSpecialtyFromDb(row: any): Specialty {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    iconName: row.icon_name || 'Stethoscope',
    color: row.color || 'blue',
    active: row.active ?? true,
  };
}

function mapSpecialtyToDb(sp: Specialty): any {
  return {
    id: sp.id,
    name: sp.name,
    description: sp.description || '',
    icon_name: sp.iconName || 'Stethoscope',
    color: sp.color || 'blue',
    active: sp.active,
  };
}

function mapAppointmentFromDb(row: any): Appointment {
  let cancellationReason = row.cancellation_reason || undefined;
  let cancelledBy = (row.cancelled_by as 'paciente' | 'clinica') || undefined;
  let cancelledAt = row.cancelled_at || undefined;

  // Fallback: If not in dedicated columns but in notes e.g. "[Cancelada por paciente: Motivo]"
  if (!cancellationReason && row.notes && typeof row.notes === 'string') {
    const match = row.notes.match(/\[Cancelada por (paciente|clinica):\s*(.*?)\]/i);
    if (match) {
      cancelledBy = match[1].toLowerCase() as 'paciente' | 'clinica';
      cancellationReason = match[2].trim();
    }
  }

  return {
    id: row.id,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    patientEmail: row.patient_email || undefined,
    patientDni: row.patient_dni || undefined,
    reason: row.reason || '',
    type: row.type || 'presencial',
    date: row.date,
    time: row.time,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    specialtyId: row.specialty_id,
    specialtyName: row.specialty_name || '',
    status: row.status || 'pendiente_whatsapp',
    createdAt: row.created_at || new Date().toISOString(),
    fee: Number(row.fee) || 0,
    consultorio: row.consultorio || '',
    notes: row.notes || undefined,
    cancellationReason,
    cancelledBy,
    cancelledAt,
  };
}

export function mapAppointmentToDb(app: Appointment, includeCancellationCols = true): any {
  const data: any = {
    id: app.id,
    patient_name: app.patientName,
    patient_phone: app.patientPhone,
    patient_email: app.patientEmail || null,
    patient_dni: app.patientDni || null,
    reason: app.reason || '',
    type: app.type,
    date: app.date,
    time: app.time,
    doctor_id: app.doctorId,
    doctor_name: app.doctorName,
    specialty_id: app.specialtyId,
    specialty_name: app.specialtyName || '',
    status: app.status,
    created_at: app.createdAt,
    fee: app.fee,
    consultorio: app.consultorio,
    notes: app.notes || null,
  };

  if (includeCancellationCols) {
    data.cancellation_reason = app.cancellationReason || null;
    data.cancelled_by = app.cancelledBy || null;
    data.cancelled_at = app.cancelledAt || null;
  }

  return data;
}

function mapBlockedSlotFromDb(row: any): BlockedSlot {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    date: row.date,
    time: row.time || undefined,
    reason: row.reason || '',
  };
}

function mapBlockedSlotToDb(b: BlockedSlot): any {
  return {
    id: b.id,
    doctor_id: b.doctorId,
    date: b.date,
    time: b.time || null,
    reason: b.reason || '',
  };
}

// -------------------------------------------------------------
// Data Fetch & Operations
// -------------------------------------------------------------

export async function fetchClinicDataFromSupabase(): Promise<{
  clinicConfig?: ClinicConfig;
  doctors: Doctor[];
  specialties: Specialty[];
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
} | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const [cfgRes, specRes, docRes, appRes, blockRes] = await Promise.all([
      client.from('clinic_config').select('*').limit(1).maybeSingle(),
      client.from('specialties').select('*'),
      client.from('doctors').select('*'),
      client.from('appointments').select('*').order('date', { ascending: true }),
      client.from('blocked_slots').select('*'),
    ]);

    let config: ClinicConfig | undefined;
    if (cfgRes.data) {
      config = mapConfigFromDb(cfgRes.data);
    }

    const specialties = (specRes.data || []).map(mapSpecialtyFromDb);
    const doctors = (docRes.data || []).map(mapDoctorFromDb);
    const appointments = (appRes.data || []).map(mapAppointmentFromDb);
    const blockedSlots = (blockRes.data || []).map(mapBlockedSlotFromDb);

    return {
      clinicConfig: config,
      doctors,
      specialties,
      appointments,
      blockedSlots,
    };
  } catch (err) {
    console.warn('Error fetching data from Supabase:', err);
    return null;
  }
}

export async function syncSaveConfigToSupabase(config: ClinicConfig): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('clinic_config').upsert(mapConfigToDb(config));
    return !error;
  } catch (err) {
    console.warn('Error syncing config to Supabase:', err);
    return false;
  }
}

export async function syncSaveDoctorToSupabase(doctor: Doctor): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('doctors').upsert(mapDoctorToDb(doctor));
    return !error;
  } catch (err) {
    console.warn('Error syncing doctor to Supabase:', err);
    return false;
  }
}

export async function syncDeleteDoctorFromSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('doctors').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.warn('Error deleting doctor from Supabase:', err);
    return false;
  }
}

export async function syncSaveSpecialtyToSupabase(specialty: Specialty): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('specialties').upsert(mapSpecialtyToDb(specialty));
    return !error;
  } catch (err) {
    console.warn('Error syncing specialty to Supabase:', err);
    return false;
  }
}

export async function syncDeleteSpecialtyFromSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('specialties').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.warn('Error deleting specialty from Supabase:', err);
    return false;
  }
}

export async function syncSaveAppointmentToSupabase(appointment: Appointment): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('appointments').upsert(mapAppointmentToDb(appointment, true));
    if (error) {
      if (error.code === '42703') {
        // If cancellation columns are not present in Supabase table yet, retry without them
        const { error: retryError } = await client.from('appointments').upsert(mapAppointmentToDb(appointment, false));
        if (retryError) {
          console.warn('Error in fallback appointment upsert:', retryError);
          return false;
        }
        return true;
      }
      console.warn('Error syncing appointment to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing appointment to Supabase:', err);
    return false;
  }
}

export async function syncDeleteAppointmentFromSupabase(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('appointments').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.warn('Error deleting appointment from Supabase:', err);
    return false;
  }
}

// Bulk Upload (Seeding local data to a fresh Supabase project)
export async function uploadAllLocalDataToSupabase(payload: {
  clinicConfig: ClinicConfig;
  specialties: Specialty[];
  doctors: Doctor[];
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
}): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'La conexión a la Nube no está configurada.' };
  }

  try {
    // 1. Config
    const { error: cfgErr } = await client.from('clinic_config').upsert(mapConfigToDb(payload.clinicConfig));
    if (cfgErr) throw new Error(`Config error: ${cfgErr.message}`);

    // 2. Specialties
    if (payload.specialties.length > 0) {
      const { error: spErr } = await client.from('specialties').upsert(payload.specialties.map(mapSpecialtyToDb));
      if (spErr) throw new Error(`Specialties error: ${spErr.message}`);
    }

    // 3. Doctors
    if (payload.doctors.length > 0) {
      const { error: docErr } = await client.from('doctors').upsert(payload.doctors.map(mapDoctorToDb));
      if (docErr) throw new Error(`Doctors error: ${docErr.message}`);
    }

    // 4. Appointments
    if (payload.appointments.length > 0) {
      let { error: appErr } = await client.from('appointments').upsert(payload.appointments.map(a => mapAppointmentToDb(a, true)));
      if (appErr && appErr.code === '42703') {
        const { error: retryErr } = await client.from('appointments').upsert(payload.appointments.map(a => mapAppointmentToDb(a, false)));
        appErr = retryErr;
      }
      if (appErr) throw new Error(`Appointments error: ${appErr.message}`);
    }

    // 5. Blocked slots
    if (payload.blockedSlots.length > 0) {
      const { error: blkErr } = await client.from('blocked_slots').upsert(payload.blockedSlots.map(mapBlockedSlotToDb));
      if (blkErr) throw new Error(`Blocked slots error: ${blkErr.message}`);
    }

    return {
      success: true,
      message: `¡Todos los datos se subieron a la Nube con éxito! (${payload.specialties.length} especialidades, ${payload.doctors.length} médicos, ${payload.appointments.length} citas).`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error durante la sincronización a la Nube.' };
  }
}
