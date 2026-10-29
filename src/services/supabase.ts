import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Appointment, Doctor, Specialty, ClinicConfig, BlockedSlot } from '../types';
import { DEFAULT_PIN_HASH, encodePinForStorage } from '../utils/pinSecurity';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const SUPABASE_STORAGE_KEY = 'medicitas_cloud_config_v3';

let memoryStoredConfig: SupabaseConfig | null = null;
let activeClient: SupabaseClient | null = null;

// Purge legacy stored credentials so the template starts completely blank
try {
  localStorage.removeItem('medicitas_supabase_config');
  localStorage.removeItem('medicitas_cloud_config_v2');
} catch {
  // Ignore error
}

function isValidConfig(url?: string, anonKey?: string): boolean {
  if (!url || !anonKey) return false;
  const cleanUrl = String(url).trim();
  const cleanKey = String(anonKey).trim();
  if (!cleanUrl || !cleanKey) return false;
  if (cleanUrl.includes('your-project-id') || cleanKey === 'your-anon-public-key') return false;
  return cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
}

// Encode credentials into a shareable URL parameter for 1-click cross-device setup
export function encodeCloudConfigToken(config: SupabaseConfig): string {
  try {
    if (!isValidConfig(config.url, config.anonKey)) return '';
    const json = JSON.stringify({ u: config.url.trim(), k: config.anonKey.trim() });
    return btoa(encodeURIComponent(json));
  } catch {
    return '';
  }
}

// Decode credentials from URL query parameter (?cloud=... or ?cloud_url=...&cloud_key=...)
export function checkUrlForCloudConfig(): SupabaseConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('cloud');
    let resolvedUrl = params.get('cloud_url') || '';
    let resolvedKey = params.get('cloud_key') || '';

    if (token) {
      try {
        const decodedJson = decodeURIComponent(atob(token));
        const parsed = JSON.parse(decodedJson);
        if (parsed && parsed.u && parsed.k) {
          resolvedUrl = String(parsed.u).trim();
          resolvedKey = String(parsed.k).trim();
        }
      } catch {
        // Ignore malformed token
      }
    }

    if (isValidConfig(resolvedUrl, resolvedKey)) {
      const config = { url: resolvedUrl.trim(), anonKey: resolvedKey.trim() };
      saveStoredSupabaseConfig(config);

      // Clean URL parameters without reloading the page
      params.delete('cloud');
      params.delete('cloud_url');
      params.delete('cloud_key');
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, newUrl);

      return config;
    }
  } catch {
    // Ignore error
  }
  return null;
}

function getEnvSupabaseConfig(): SupabaseConfig | null {
  try {
    const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
    const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
    if (isValidConfig(envUrl, envKey)) {
      return {
        url: String(envUrl).trim(),
        anonKey: String(envKey).trim(),
      };
    }
  } catch {
    // Ignore error
  }
  return null;
}

// 1. Get configuration from URL params, localStorage, memory, or Vite env vars
export function getStoredSupabaseConfig(): SupabaseConfig {
  const urlCfg = checkUrlForCloudConfig();
  if (urlCfg) return urlCfg;

  try {
    const saved = localStorage.getItem(SUPABASE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isValidConfig(parsed?.url, parsed?.anonKey)) {
        const cfg = {
          url: String(parsed.url).trim(),
          anonKey: String(parsed.anonKey).trim(),
        };
        memoryStoredConfig = cfg;
        return cfg;
      }
    }
  } catch {
    // Ignore localStorage read error
  }

  if (memoryStoredConfig && isValidConfig(memoryStoredConfig.url, memoryStoredConfig.anonKey)) {
    return memoryStoredConfig;
  }

  const envCfg = getEnvSupabaseConfig();
  if (envCfg) {
    memoryStoredConfig = envCfg;
    return envCfg;
  }

  return {
    url: '',
    anonKey: '',
  };
}

export function saveStoredSupabaseConfig(config: SupabaseConfig): void {
  const cleanUrl = config?.url ? config.url.trim() : '';
  const cleanKey = config?.anonKey ? config.anonKey.trim() : '';

  if (!cleanUrl || !cleanKey) {
    memoryStoredConfig = null;
    activeClient = null;
    try {
      localStorage.removeItem(SUPABASE_STORAGE_KEY);
    } catch {
      // Ignore error
    }
    return;
  }

  const normalized = { url: cleanUrl, anonKey: cleanKey };
  memoryStoredConfig = normalized;
  activeClient = null;

  try {
    localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    console.warn('Failed to save Supabase config to localStorage', err);
  }
}

// Fetch configuration from URL, backend/Cloudflare Worker API, static cloud-config.json, or Vite env
export async function fetchServerSupabaseConfig(): Promise<SupabaseConfig | null> {
  // 1. Check URL query parameter (?cloud=...) first
  const urlCfg = checkUrlForCloudConfig();
  if (urlCfg) {
    // Best-effort push to server/worker cache so other devices on the same edge also get it
    saveServerSupabaseConfig(urlCfg).catch(() => {});
    return urlCfg;
  }

  // 2. Check /api/config/supabase (Express server in dev/node or _worker.js on Cloudflare Pages)
  const apiCandidates = [`./api/config/supabase?t=${Date.now()}`, `/api/config/supabase?t=${Date.now()}`];
  for (const endpoint of apiCandidates) {
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (isValidConfig(data?.url, data?.anonKey)) {
          const cfg = { url: String(data.url).trim(), anonKey: String(data.anonKey).trim() };
          saveStoredSupabaseConfig(cfg);
          return cfg;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // 3. Check static cloud-config.json (works on Cloudflare Pages Direct Upload, GitHub Pages, etc.)
  const staticCandidates = [
    `./cloud-config.json?t=${Date.now()}`,
    `./public/cloud-config.json?t=${Date.now()}`,
    `/cloud-config.json?t=${Date.now()}`,
  ];
  for (const staticPath of staticCandidates) {
    try {
      const res = await fetch(staticPath, { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (isValidConfig(data?.url, data?.anonKey)) {
          const cfg = { url: String(data.url).trim(), anonKey: String(data.anonKey).trim() };
          saveStoredSupabaseConfig(cfg);
          return cfg;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // 4. Check build-time Vite environment variables
  const envCfg = getEnvSupabaseConfig();
  if (envCfg) {
    saveStoredSupabaseConfig(envCfg);
    return envCfg;
  }

  return null;
}

// Save configuration both to localStorage and the backend/Cloudflare Worker server for all devices
export async function saveServerSupabaseConfig(config: SupabaseConfig): Promise<{ success: boolean; message: string; persistedOnServer?: boolean }> {
  saveStoredSupabaseConfig(config);

  const endpoints = ['./api/config/supabase', '/api/config/supabase'];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: config.url && config.anonKey ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: config.url && config.anonKey ? JSON.stringify(config) : undefined,
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return {
          success: true,
          persistedOnServer: true,
          message: data.message || 'Configuración guardada para todos los dispositivos.',
        };
      }
    } catch {
      // Try next endpoint
    }
  }

  return {
    success: true,
    persistedOnServer: false,
    message: 'Configuración de la Nube guardada exitosamente.',
  };
}

function createResilientSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const method = (init?.method || 'GET').toUpperCase();
        const isWrite = method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
        const bodyLength = typeof init?.body === 'string' ? init.body.length : 0;
        if (isWrite && bodyLength < 60000) {
          return fetch(input, { ...init, keepalive: true });
        }
        return fetch(input, init);
      },
    },
  });
}

export function setSupabaseClientConfig(config: SupabaseConfig | null): void {
  activeClient = null;
  if (config && isValidConfig(config.url, config.anonKey)) {
    const normalized = { url: config.url.trim(), anonKey: config.anonKey.trim() };
    memoryStoredConfig = normalized;
    try {
      activeClient = createResilientSupabaseClient(normalized.url, normalized.anonKey);
    } catch (err) {
      console.warn('Failed to set Supabase client config:', err);
    }
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (activeClient) return activeClient;

  const config = getStoredSupabaseConfig();
  if (isValidConfig(config.url, config.anonKey)) {
    try {
      activeClient = createResilientSupabaseClient(config.url, config.anonKey);
      return activeClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}

export function isSupabaseConfigured(): boolean {
  if (activeClient) return true;
  const config = getStoredSupabaseConfig();
  return isValidConfig(config.url, config.anonKey);
}

// Test connection
export async function testSupabaseConnection(config?: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const targetConfig = config || getStoredSupabaseConfig();
    if (!isValidConfig(targetConfig.url, targetConfig.anonKey)) {
      return { success: false, message: 'La URL y el Anon Key de la Nube son requeridos.' };
    }

    const testClient = createClient(targetConfig.url.trim(), targetConfig.anonKey.trim(), {
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
    specialty_id: doc.specialtyId && doc.specialtyId.trim() !== '' ? doc.specialtyId : null,
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
    doctorId: row.doctor_id || '',
    doctorName: row.doctor_name,
    specialtyId: row.specialty_id || '',
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
    type: app.type || 'presencial',
    date: app.date,
    time: app.time,
    doctor_id: app.doctorId && app.doctorId.trim() !== '' ? app.doctorId : null,
    doctor_name: app.doctorName,
    specialty_id: app.specialtyId || '',
    specialty_name: app.specialtyName || '',
    status: app.status || 'pendiente_whatsapp',
    created_at: app.createdAt || new Date().toISOString(),
    fee: Number(app.fee) || 0,
    consultorio: app.consultorio || '',
    notes: app.notes || null,
  };

  const hasCancellationData = Boolean(
    app.status === 'cancelada' || app.cancellationReason || app.cancelledBy || app.cancelledAt
  );

  if (includeCancellationCols && hasCancellationData) {
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

async function ensureActiveSupabaseClient(): Promise<SupabaseClient | null> {
  let client = getSupabaseClient();
  if (client) return client;

  const serverCfg = await fetchServerSupabaseConfig();
  if (serverCfg && isValidConfig(serverCfg.url, serverCfg.anonKey)) {
    setSupabaseClientConfig(serverCfg);
    client = getSupabaseClient();
  }
  return client;
}

export async function fetchClinicDataFromSupabase(): Promise<{
  clinicConfig?: ClinicConfig;
  doctors: Doctor[];
  specialties: Specialty[];
  appointments: Appointment[];
  blockedSlots: BlockedSlot[];
} | null> {
  const client = await ensureActiveSupabaseClient();
  if (!client) return null;

  try {
    const [cfgRes, specRes, docRes, appRes, blockRes] = await Promise.all([
      client.from('clinic_config').select('*').limit(1).maybeSingle(),
      client.from('specialties').select('*'),
      client.from('doctors').select('*'),
      client.from('appointments').select('*').order('date', { ascending: true }),
      client.from('blocked_slots').select('*'),
    ]);

    // If core tables failed due to network or auth/table error, do not return empty arrays
    if (specRes.error && docRes.error && appRes.error) {
      console.warn('Supabase query error:', specRes.error);
      return null;
    }

    if (appRes.error) {
      console.warn('Supabase appointments query warning:', appRes.error);
    }

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
  const client = await ensureActiveSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('clinic_config').upsert(mapConfigToDb(config));
    if (error) {
      console.warn('Error syncing config to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing config to Supabase:', err);
    return false;
  }
}

export async function syncSaveDoctorToSupabase(doctor: Doctor, specialty?: Specialty): Promise<boolean> {
  const client = await ensureActiveSupabaseClient();
  if (!client) return false;
  try {
    if (specialty) {
      await client.from('specialties').upsert(mapSpecialtyToDb(specialty));
    }
    const payload = mapDoctorToDb(doctor);
    const { error } = await client.from('doctors').upsert(payload);
    if (error) {
      if (error.code === '23503') {
        // Foreign key violation if specialty_id does not exist in remote specialties table yet
        const fallbackPayload = { ...payload, specialty_id: null };
        const { error: retryErr } = await client.from('doctors').upsert(fallbackPayload);
        return !retryErr;
      }
      console.warn('Error syncing doctor to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing doctor to Supabase:', err);
    return false;
  }
}

export async function syncDeleteDoctorFromSupabase(id: string): Promise<boolean> {
  const client = await ensureActiveSupabaseClient();
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
  const client = await ensureActiveSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('specialties').upsert(mapSpecialtyToDb(specialty));
    if (error) {
      console.warn('Error syncing specialty to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing specialty to Supabase:', err);
    return false;
  }
}

export async function syncDeleteSpecialtyFromSupabase(id: string): Promise<boolean> {
  const client = await ensureActiveSupabaseClient();
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
  const client = await ensureActiveSupabaseClient();
  if (!client) return false;

  try {
    const currentPayload: Record<string, any> = { ...mapAppointmentToDb(appointment, true) };

    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await client.from('appointments').upsert(currentPayload);
      if (!error) {
        return true;
      }

      const errCode = String(error.code || '');
      const errMsg = String(error.message || '');
      const errDetails = String(error.details || '');
      const combinedMsg = `${errMsg} ${errDetails}`;

      // 1. Handle missing column errors (PostgREST PGRST204 or PostgreSQL 42703)
      const isColumnError =
        errCode === 'PGRST204' ||
        errCode === '42703' ||
        /column|schema cache/i.test(combinedMsg);

      if (isColumnError) {
        let removedAny = false;

        // Extract specific offending column name if mentioned in error message
        const colMatch =
          combinedMsg.match(/['"]([a-zA-Z0-9_]+)['"]\s+column/i) ||
          combinedMsg.match(/column\s+['"]([a-zA-Z0-9_]+)['"]/i);

        if (colMatch) {
          const offendingCol = colMatch[1] || colMatch[2];
          if (offendingCol && offendingCol in currentPayload && offendingCol !== 'id') {
            delete currentPayload[offendingCol];
            removedAny = true;
          }
        }

        // Also strip cancellation columns if present
        if (
          'cancellation_reason' in currentPayload ||
          'cancelled_by' in currentPayload ||
          'cancelled_at' in currentPayload
        ) {
          delete currentPayload.cancellation_reason;
          delete currentPayload.cancelled_by;
          delete currentPayload.cancelled_at;
          removedAny = true;
        } else if (!removedAny && 'patient_dni' in currentPayload) {
          delete currentPayload.patient_dni;
          removedAny = true;
        }

        if (removedAny) {
          continue;
        }
      }

      // 2. Handle Foreign Key constraint violations (PostgreSQL 23503)
      const isFkError = errCode === '23503' || /foreign key/i.test(combinedMsg);
      if (isFkError) {
        if (currentPayload.doctor_id !== null) {
          currentPayload.doctor_id = null;
          continue;
        }
        if (currentPayload.specialty_id !== null) {
          currentPayload.specialty_id = null;
          continue;
        }
      }

      console.warn('Error syncing appointment to Supabase:', error);
      return false;
    }

    return false;
  } catch (err) {
    console.warn('Error syncing appointment to Supabase:', err);
    return false;
  }
}

export async function syncDeleteAppointmentFromSupabase(id: string): Promise<boolean> {
  const client = await ensureActiveSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('appointments').delete().eq('id', id);
    return !error;
  } catch (err) {
    console.warn('Error deleting appointment from Supabase:', err);
    return false;
  }
}

export async function syncClearAllDataFromSupabase(defaultConfig: ClinicConfig): Promise<boolean> {
  const client = await ensureActiveSupabaseClient();
  if (!client) return false;
  try {
    await client.from('appointments').delete().neq('id', '__none__');
    await client.from('blocked_slots').delete().neq('id', '__none__');
    await client.from('doctors').delete().neq('id', '__none__');
    await client.from('specialties').delete().neq('id', '__none__');
    await client.from('clinic_config').upsert(mapConfigToDb(defaultConfig));
    return true;
  } catch (err) {
    console.warn('Error clearing all data from Supabase:', err);
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
  const client = await ensureActiveSupabaseClient();
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

    // 4. Appointments (using resilient per-appointment fallback if batch fails)
    if (payload.appointments.length > 0) {
      const { error: appErr } = await client
        .from('appointments')
        .upsert(payload.appointments.map(a => mapAppointmentToDb(a, false)));
      if (appErr) {
        const results = await Promise.all(
          payload.appointments.map(a => syncSaveAppointmentToSupabase(a))
        );
        if (results.some(ok => !ok)) {
          throw new Error(`Appointments error: ${appErr.message}`);
        }
      }
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
