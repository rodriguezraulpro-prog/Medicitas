import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Appointment, Doctor, Specialty, ClinicConfig, AppointmentStatus, BlockedSlot } from '../types';
import { initialAppointments, initialDoctors, initialSpecialties, initialClinicConfig } from '../data/initialData';
import { encodePinForStorage } from '../utils/pinSecurity';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  fetchServerSupabaseConfig,
  saveServerSupabaseConfig,
  setSupabaseClientConfig,
  getSupabaseClient,
  isSupabaseConfigured,
  testSupabaseConnection,
  fetchClinicDataFromSupabase,
  syncSaveConfigToSupabase,
  syncSaveDoctorToSupabase,
  syncDeleteDoctorFromSupabase,
  syncSaveSpecialtyToSupabase,
  syncDeleteSpecialtyFromSupabase,
  syncSaveAppointmentToSupabase,
  syncDeleteAppointmentFromSupabase,
  syncDeleteAppointmentsBatchFromSupabase,
  syncClearAllDataFromSupabase,
  uploadAllLocalDataToSupabase,
  isRlsDeleteBlocked,
  SupabaseConfig,
} from '../services/supabase';

interface ClinicContextType {
  appointments: Appointment[];
  doctors: Doctor[];
  specialties: Specialty[];
  clinicConfig: ClinicConfig;
  blockedSlots: BlockedSlot[];
  addAppointment: (
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'status'> & { status?: AppointmentStatus }
  ) => Appointment;
  updateAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  cancelAppointment: (id: string, reason: string, cancelledBy: 'paciente' | 'clinica') => void;
  deleteAppointment: (id: string) => Promise<boolean>;
  purgeCancelledAppointments: (appointmentIds: string[]) => Promise<number>;
  addDoctor: (doctor: Omit<Doctor, 'id'>) => Doctor;
  updateDoctor: (id: string, updates: Partial<Doctor>) => void;
  deleteDoctor: (id: string) => void;
  toggleDoctorActive: (id: string) => void;
  addSpecialty: (specialty: Omit<Specialty, 'id'>) => Specialty;
  updateSpecialty: (id: string, updates: Partial<Specialty>) => void;
  deleteSpecialty: (id: string) => void;
  updateClinicConfig: (updates: Partial<ClinicConfig>) => void;
  clearAllData: () => void;
  resetToDemoData: () => void;
  getAvailableSlotsForDoctor: (doctorId: string, dateStr: string, excludeAppointmentId?: string) => string[];
  isSlotTaken: (doctorId: string, dateStr: string, timeStr: string, excludeAppointmentId?: string) => boolean;

  // Supabase Cloud Multi-Tenant State & Helpers
  isCloudConnected: boolean;
  isCloudSyncing: boolean;
  cloudError: string | null;
  lastCloudSync: Date | null;
  rlsDeleteBlocked: boolean;
  supabaseConfig: SupabaseConfig;
  setCloudConfig: (config: SupabaseConfig) => Promise<{ success: boolean; message: string }>;
  disconnectOnlineDatabase: () => Promise<{ success: boolean; message: string }>;
  connectOnlineDatabase: () => Promise<{ success: boolean; message: string; needsCredentials?: boolean }>;
  syncFromCloud: (silent?: boolean) => Promise<{ success: boolean; message: string }>;
  syncToCloud: () => Promise<{ success: boolean; message: string }>;
  exportBackupData: () => void;
  importBackupData: (jsonText: string, pushToCloudIfConnected?: boolean) => Promise<{ success: boolean; message: string }>;
}

const STORAGE_KEYS = {
  APPOINTMENTS: 'medicitas_appointments_v4',
  DOCTORS: 'medicitas_doctors_v4',
  SPECIALTIES: 'medicitas_specialties_v4',
  CONFIG: 'medicitas_config_v4',
  BLOCKED: 'medicitas_blocked_v4',
  DELETED_APPOINTMENTS: 'medicitas_deleted_appointments_v4',
  MANUAL_OFFLINE: 'medicitas_manual_offline_v4',
  SAVED_CLOUD_CREDENTIALS: 'medicitas_saved_cloud_credentials_v4',
};

// Purge old v1/v2/v3 demo & cached keys if present to ensure a completely clean template start
try {
  localStorage.removeItem('medicitas_appointments_v1');
  localStorage.removeItem('medicitas_doctors_v1');
  localStorage.removeItem('medicitas_specialties_v1');
  localStorage.removeItem('medicitas_config_v1');
  localStorage.removeItem('medicitas_blocked_v1');
  localStorage.removeItem('medicitas_appointments_v2');
  localStorage.removeItem('medicitas_doctors_v2');
  localStorage.removeItem('medicitas_specialties_v2');
  localStorage.removeItem('medicitas_config_v2');
  localStorage.removeItem('medicitas_blocked_v2');
  localStorage.removeItem('medicitas_appointments_v3');
  localStorage.removeItem('medicitas_doctors_v3');
  localStorage.removeItem('medicitas_specialties_v3');
  localStorage.removeItem('medicitas_config_v3');
  localStorage.removeItem('medicitas_blocked_v3');
  localStorage.removeItem('medicitas_deleted_appointments_v3');
  localStorage.removeItem('medicitas_manual_offline_v3');
  localStorage.removeItem('medicitas_saved_cloud_credentials_v3');
  localStorage.removeItem('medicitas_supabase_config');
  localStorage.removeItem('medicitas_cloud_config_v2');
  localStorage.removeItem('medicitas_cloud_config_v3');
  sessionStorage.removeItem('medicitas_db_dev_unlocked');
} catch {
  // ignore
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export const ClinicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      return saved ? JSON.parse(saved) : initialAppointments;
    } catch {
      return initialAppointments;
    }
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DOCTORS);
      return saved ? JSON.parse(saved) : initialDoctors;
    } catch {
      return initialDoctors;
    }
  });

  const [specialties, setSpecialties] = useState<Specialty[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SPECIALTIES);
      return saved ? JSON.parse(saved) : initialSpecialties;
    } catch {
      return initialSpecialties;
    }
  });

  const [clinicConfig, setClinicConfig] = useState<ClinicConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tagline === 'Gestión y Reserva Médica por WhatsApp') {
          parsed.tagline = 'Gestión y Reserva Médica';
        }
        return parsed;
      }
      return initialClinicConfig;
    } catch {
      return initialClinicConfig;
    }
  });

  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BLOCKED);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Supabase state
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig>(getStoredSupabaseConfig);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);
  const [rlsDeleteBlocked, setRlsDeleteBlocked] = useState<boolean>(false);
  const [isManualOffline, setIsManualOffline] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.MANUAL_OFFLINE) === 'true';
    } catch {
      return false;
    }
  });

  // Sync state to local storage as continuous fallback
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    } catch (err) {
      console.warn('Could not save appointments to localStorage', err);
    }
  }, [appointments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
    } catch (err) {
      console.warn('Could not save doctors to localStorage', err);
    }
  }, [doctors]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SPECIALTIES, JSON.stringify(specialties));
    } catch (err) {
      console.warn('Could not save specialties to localStorage', err);
    }
  }, [specialties]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(clinicConfig));
    } catch (err) {
      console.warn('Could not save clinicConfig to localStorage', err);
    }
  }, [clinicConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BLOCKED, JSON.stringify(blockedSlots));
    } catch (err) {
      console.warn('Could not save blockedSlots to localStorage', err);
    }
  }, [blockedSlots]);

  // Synchronize across multiple windows/tabs
  useEffect(() => {
    const handleStorageEvent = (event: StorageEvent) => {
      if (!event.newValue) return;
      try {
        if (event.key === STORAGE_KEYS.APPOINTMENTS) {
          setAppointments(JSON.parse(event.newValue));
        } else if (event.key === STORAGE_KEYS.DOCTORS) {
          setDoctors(JSON.parse(event.newValue));
        } else if (event.key === STORAGE_KEYS.SPECIALTIES) {
          setSpecialties(JSON.parse(event.newValue));
        } else if (event.key === STORAGE_KEYS.CONFIG) {
          setClinicConfig(JSON.parse(event.newValue));
        } else if (event.key === STORAGE_KEYS.BLOCKED) {
          setBlockedSlots(JSON.parse(event.newValue));
        } else if (event.key === STORAGE_KEYS.DELETED_APPOINTMENTS) {
          const parsedIds: string[] = JSON.parse(event.newValue);
          if (Array.isArray(parsedIds)) {
            parsedIds.forEach(id => deletedAppointmentIdsRef.current.add(id));
          }
        }
      } catch (err) {
        console.warn('Error syncing storage event', err);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  const deletedAppointmentIdsRef = useRef<Set<string>>((() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DELETED_APPOINTMENTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return new Set<string>(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set<string>();
    }
  })());

  const pendingUploadAppointmentIdsRef = useRef<Set<string>>(new Set());

  const persistDeletedAppointmentIds = useCallback((idsToAdd: string[]) => {
    idsToAdd.forEach(id => {
      deletedAppointmentIdsRef.current.add(id);
      pendingUploadAppointmentIdsRef.current.delete(id);
    });
    try {
      localStorage.setItem(
        STORAGE_KEYS.DELETED_APPOINTMENTS,
        JSON.stringify(Array.from(deletedAppointmentIdsRef.current))
      );
    } catch {
      // ignore storage error
    }
  }, []);

  // Fetch all data from Cloud
  const syncFromCloud = useCallback(async (silent = false): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured()) {
      setIsCloudConnected(false);
      return { success: false, message: 'La conexión a la Nube no está configurada.' };
    }

    if (!silent) {
      setIsCloudSyncing(true);
    }
    setCloudError(null);

    try {
      const data = await fetchClinicDataFromSupabase();
      if (!data) {
        if (!silent) {
          setCloudError('No se pudo obtener datos de la Nube. Revisa tus credenciales o conexión a internet.');
          setIsCloudConnected(false);
          setIsCloudSyncing(false);
        }
        return { success: false, message: 'No se pudo obtener respuesta de la Nube.' };
      }

      setRlsDeleteBlocked(Boolean(data.rlsDeleteBlocked || isRlsDeleteBlocked()));

      if (data.clinicConfig) {
        const normalizedConfig = {
          ...data.clinicConfig,
          tagline:
            data.clinicConfig.tagline === 'Gestión y Reserva Médica por WhatsApp'
              ? 'Gestión y Reserva Médica'
              : data.clinicConfig.tagline,
        };
        setClinicConfig(normalizedConfig);
      }
      setSpecialties(data.specialties);
      setDoctors(data.doctors);

      const activeRemoteAppointments = data.appointments.filter(
        a => !deletedAppointmentIdsRef.current.has(a.id)
      );

      setAppointments(prev => {
        const remoteIds = new Set(activeRemoteAppointments.map(a => a.id));
        // Only keep local appointments that were just created in this session and are still uploading for the first time
        const unsyncedLocal = prev.filter(
          localApp =>
            pendingUploadAppointmentIdsRef.current.has(localApp.id) &&
            !remoteIds.has(localApp.id) &&
            !deletedAppointmentIdsRef.current.has(localApp.id)
        );
        if (unsyncedLocal.length > 0) {
          return [...unsyncedLocal, ...activeRemoteAppointments];
        }
        return activeRemoteAppointments;
      });
      setBlockedSlots(data.blockedSlots);

      setIsCloudConnected(true);
      setLastCloudSync(new Date());
      if (!silent) {
        setIsCloudSyncing(false);
      }

      return {
        success: true,
        message: `Sincronización exitosa con la Nube: ${data.doctors.length} médicos, ${data.specialties.length} especialidades, ${activeRemoteAppointments.length} citas.`,
      };
    } catch (err: any) {
      if (!silent) {
        setCloudError(err?.message || 'Error al conectar con la Nube.');
        setIsCloudConnected(false);
        setIsCloudSyncing(false);
      }
      return { success: false, message: err?.message || 'Error de sincronización con la Nube.' };
    }
  }, []);

  // Upload local data to Cloud
  const syncToCloud = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'La conexión a la Nube no está configurada.' };
    }

    setIsCloudSyncing(true);
    try {
      const res = await uploadAllLocalDataToSupabase({
        clinicConfig,
        specialties,
        doctors,
        appointments,
        blockedSlots,
      });

      if (res.success) {
        setIsCloudConnected(true);
        setLastCloudSync(new Date());
      }
      setIsCloudSyncing(false);
      return res;
    } catch (err: any) {
      setIsCloudSyncing(false);
      return { success: false, message: err?.message || 'Error al subir a la nube.' };
    }
  }, [clinicConfig, specialties, doctors, appointments, blockedSlots]);

  // Set & Validate Cloud credentials
  const setCloudConfig = async (newConfig: SupabaseConfig): Promise<{ success: boolean; message: string }> => {
    const wasOffline = !isCloudConnected || isManualOffline;

    if (!newConfig.url || !newConfig.anonKey) {
      if (supabaseConfig.url && supabaseConfig.anonKey) {
        try {
          localStorage.setItem(STORAGE_KEYS.SAVED_CLOUD_CREDENTIALS, JSON.stringify(supabaseConfig));
        } catch {
          // ignore
        }
      }
      await saveServerSupabaseConfig({ url: '', anonKey: '' });
      setSupabaseConfigState({ url: '', anonKey: '' });
      setSupabaseClientConfig(null);
      setIsCloudConnected(false);
      setCloudError(null);
      return { success: true, message: 'Modo local activado.' };
    }

    setIsCloudSyncing(true);
    const cleanConfig = { url: newConfig.url.trim(), anonKey: newConfig.anonKey.trim() };
    const test = await testSupabaseConnection(cleanConfig);
    if (!test.success) {
      setIsCloudSyncing(false);
      setCloudError(test.message);
      return test;
    }

    try {
      localStorage.removeItem(STORAGE_KEYS.MANUAL_OFFLINE);
      localStorage.setItem(STORAGE_KEYS.SAVED_CLOUD_CREDENTIALS, JSON.stringify(cleanConfig));
    } catch {
      // ignore
    }
    setIsManualOffline(false);

    // Save both locally and to server/worker so all devices (phones, tablets, PCs) get it
    await saveServerSupabaseConfig(cleanConfig);
    setSupabaseConfigState(cleanConfig);
    setSupabaseClientConfig(cleanConfig);
    setIsCloudConnected(true);
    setCloudError(null);

    const hasLocalCustomData =
      doctors.length > 0 ||
      specialties.length > 0 ||
      appointments.length > 0 ||
      clinicConfig.name !== initialClinicConfig.name ||
      clinicConfig.whatsappNumber !== '' ||
      clinicConfig.phone !== '';

    // If connecting while in offline mode and there is local data, automatically upload local data to the online database
    if (wasOffline && hasLocalCustomData) {
      await uploadAllLocalDataToSupabase({
        clinicConfig,
        specialties,
        doctors,
        appointments,
        blockedSlots,
      });
    }

    // Load/sync cloud data so everything is unified
    const cloudData = await fetchClinicDataFromSupabase();
    const hasRemoteData = Boolean(
      cloudData &&
        (cloudData.doctors.length > 0 ||
          cloudData.appointments.length > 0 ||
          cloudData.specialties.length > 0 ||
          (cloudData.clinicConfig &&
            (cloudData.clinicConfig.name !== initialClinicConfig.name ||
              cloudData.clinicConfig.whatsappNumber !== '' ||
              cloudData.clinicConfig.phone !== '' ||
              cloudData.clinicConfig.address !== '')))
    );

    if (cloudData && (hasRemoteData || !hasLocalCustomData)) {
      if (cloudData.clinicConfig) setClinicConfig(cloudData.clinicConfig);
      setSpecialties(cloudData.specialties);
      setDoctors(cloudData.doctors);
      const activeRemoteAppointments = cloudData.appointments.filter(
        a => !deletedAppointmentIdsRef.current.has(a.id)
      );
      setAppointments(prev => {
        const remoteIds = new Set(activeRemoteAppointments.map(a => a.id));
        const unsyncedLocal = prev.filter(
          localApp =>
            pendingUploadAppointmentIdsRef.current.has(localApp.id) &&
            !remoteIds.has(localApp.id) &&
            !deletedAppointmentIdsRef.current.has(localApp.id)
        );
        if (unsyncedLocal.length > 0) {
          return [...unsyncedLocal, ...activeRemoteAppointments];
        }
        return activeRemoteAppointments;
      });
      setBlockedSlots(cloudData.blockedSlots);
    } else if (hasLocalCustomData) {
      await uploadAllLocalDataToSupabase({
        clinicConfig,
        specialties,
        doctors,
        appointments,
        blockedSlots,
      });
    }

    setLastCloudSync(new Date());
    setIsCloudSyncing(false);
    return {
      success: true,
      message:
        wasOffline && hasLocalCustomData
          ? '¡Base de datos online conectada! Tus datos locales se subieron y sincronizaron automáticamente.'
          : '¡Conexión establecida y sincronizada! Todos los dispositivos conectados a esta base de datos reflejarán los datos en tiempo real.',
    };
  };

  // Disconnect Online Database to work in Offline / Local Mode while preserving credentials for 1-click reconnect
  const disconnectOnlineDatabase = async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (supabaseConfig.url && supabaseConfig.anonKey) {
        localStorage.setItem(STORAGE_KEYS.SAVED_CLOUD_CREDENTIALS, JSON.stringify(supabaseConfig));
      }
      localStorage.setItem(STORAGE_KEYS.MANUAL_OFFLINE, 'true');
    } catch {
      // ignore
    }
    setIsManualOffline(true);
    setSupabaseClientConfig(null);
    setIsCloudConnected(false);
    setCloudError(null);
    return {
      success: true,
      message:
        'Base de datos online desconectada. Ahora estás trabajando en Modo Local (Offline); cuando vuelvas a conectar, tus cambios locales se subirán automáticamente.',
    };
  };

  // Reconnect Online Database from Offline Mode and automatically upload all local data
  const connectOnlineDatabase = async (): Promise<{
    success: boolean;
    message: string;
    needsCredentials?: boolean;
  }> => {
    setIsCloudSyncing(true);
    setCloudError(null);

    try {
      let targetCfg: SupabaseConfig | null = null;

      if (supabaseConfig.url && supabaseConfig.anonKey) {
        targetCfg = supabaseConfig;
      } else {
        try {
          const savedRaw = localStorage.getItem(STORAGE_KEYS.SAVED_CLOUD_CREDENTIALS);
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            if (parsed?.url && parsed?.anonKey) {
              targetCfg = { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
            }
          }
        } catch {
          // ignore
        }

        if (!targetCfg) {
          const stored = getStoredSupabaseConfig();
          if (stored.url && stored.anonKey) {
            targetCfg = stored;
          }
        }

        if (!targetCfg) {
          const serverCfg = await fetchServerSupabaseConfig();
          if (serverCfg && serverCfg.url && serverCfg.anonKey) {
            targetCfg = serverCfg;
          }
        }
      }

      if (!targetCfg || !targetCfg.url || !targetCfg.anonKey) {
        setIsCloudSyncing(false);
        return {
          success: false,
          needsCredentials: true,
          message:
            'No se encontraron credenciales de base de datos online guardadas. Configúralas desde el Área de soporte técnico.',
        };
      }

      const cleanConfig = { url: targetCfg.url.trim(), anonKey: targetCfg.anonKey.trim() };
      const test = await testSupabaseConnection(cleanConfig);
      if (!test.success) {
        setIsCloudSyncing(false);
        setCloudError(test.message);
        return { success: false, message: test.message };
      }

      try {
        localStorage.removeItem(STORAGE_KEYS.MANUAL_OFFLINE);
        localStorage.setItem(STORAGE_KEYS.SAVED_CLOUD_CREDENTIALS, JSON.stringify(cleanConfig));
      } catch {
        // ignore
      }
      setIsManualOffline(false);

      saveStoredSupabaseConfig(cleanConfig);
      await saveServerSupabaseConfig(cleanConfig);
      setSupabaseConfigState(cleanConfig);
      setSupabaseClientConfig(cleanConfig);

      // Automatically upload all current local data to the online database since we were in offline mode
      const uploadRes = await uploadAllLocalDataToSupabase({
        clinicConfig,
        specialties,
        doctors,
        appointments,
        blockedSlots,
      });

      await syncFromCloud(true);
      setIsCloudConnected(true);
      setLastCloudSync(new Date());
      setIsCloudSyncing(false);

      if (!uploadRes.success) {
        return {
          success: true,
          message: `Base de datos online conectada, pero hubo un aviso al subir algunos registros locales: ${uploadRes.message}`,
        };
      }

      return {
        success: true,
        message: `¡Base de datos online conectada! Se subieron automáticamente todos los datos locales al servidor (${specialties.length} especialidades, ${doctors.length} médicos, ${appointments.length} citas).`,
      };
    } catch (err: any) {
      setIsCloudSyncing(false);
      return {
        success: false,
        message: err?.message || 'Error al intentar conectar con la base de datos online.',
      };
    }
  };

  // Initial cloud check on mount
  useEffect(() => {
    let isMounted = true;

    async function initCloudConfig() {
      // 1. Try to fetch from URL (?cloud=...), server/worker (/api/config/supabase), static /cloud-config.json, or env vars
      const serverCfg = await fetchServerSupabaseConfig();
      if (!isMounted) return;

      let effectiveCfg: SupabaseConfig | null = null;

      if (serverCfg && serverCfg.url && serverCfg.anonKey) {
        effectiveCfg = serverCfg;
      } else {
        // 2. If server has none yet, check if current browser already has it in localStorage/env
        // and upload it to the server/worker so mobile phones and other PCs can receive it!
        const localCfg = getStoredSupabaseConfig();
        if (localCfg.url && localCfg.anonKey) {
          effectiveCfg = localCfg;
          saveServerSupabaseConfig(localCfg).catch(err =>
            console.warn('Auto-uploaded local config to server error:', err)
          );
        }
      }

      if (effectiveCfg && effectiveCfg.url && effectiveCfg.anonKey) {
        saveStoredSupabaseConfig(effectiveCfg);
        try {
          localStorage.setItem(STORAGE_KEYS.SAVED_CLOUD_CREDENTIALS, JSON.stringify(effectiveCfg));
        } catch {
          // ignore
        }
        setSupabaseConfigState(effectiveCfg);

        const manuallyOffline = (() => {
          try {
            return localStorage.getItem(STORAGE_KEYS.MANUAL_OFFLINE) === 'true';
          } catch {
            return false;
          }
        })();

        if (manuallyOffline) {
          setSupabaseClientConfig(null);
          setIsCloudConnected(false);
          return;
        }

        setSupabaseClientConfig(effectiveCfg);
        await syncFromCloud();
      }
    }

    initCloudConfig();

    return () => {
      isMounted = false;
    };
  }, [syncFromCloud]);

  // Realtime subscription across ALL tables + Auto-sync on window focus & periodic interval
  useEffect(() => {
    if (isManualOffline || !isCloudConnected || !supabaseConfig.url || !supabaseConfig.anonKey) return;

    const client = getSupabaseClient();
    if (!client) return;

    const realtimeChannel = client
      .channel('medicitas-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          const table = payload?.table;
          const eventType = payload?.eventType;
          const row = payload?.new;
          if (
            table === 'appointments' &&
            (eventType === 'INSERT' || eventType === 'UPDATE') &&
            row?.id &&
            (deletedAppointmentIdsRef.current.has(String(row.id)) ||
              (typeof row.notes === 'string' && row.notes.includes('[ELIMINADA]')))
          ) {
            syncDeleteAppointmentFromSupabase(String(row.id)).catch(() => {});
            return;
          }
          syncFromCloud(true);
        }
      )
      .subscribe();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud(true);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const intervalId = window.setInterval(() => {
      syncFromCloud(true);
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(intervalId);
      client.removeChannel(realtimeChannel);
    };
  }, [isManualOffline, isCloudConnected, supabaseConfig.url, supabaseConfig.anonKey, syncFromCloud]);

  // --------------------------------------------------------------------------
  // Core Domain Operations (Auto-sync to Supabase in background when configured)
  // --------------------------------------------------------------------------

  const addAppointment = (
    data: Omit<Appointment, 'id' | 'createdAt' | 'status'> & { status?: AppointmentStatus }
  ): Appointment => {
    const id = `MC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newAppointment: Appointment = {
      ...data,
      id,
      status: data.status || 'pendiente_whatsapp',
      createdAt: new Date().toISOString(),
    };

    pendingUploadAppointmentIdsRef.current.add(id);

    setAppointments(prev => {
      const next = [newAppointment, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });

    syncSaveAppointmentToSupabase(newAppointment)
      .then(() => {
        pendingUploadAppointmentIdsRef.current.delete(id);
      })
      .catch(err => {
        console.warn('Background sync error (addAppointment):', err);
      });

    return newAppointment;
  };

  const updateAppointmentStatus = (id: string, status: AppointmentStatus) => {
    const current = appointments.find(app => app.id === id);
    if (!current) return;
    if (current.status === 'cancelada' && status !== 'cancelada') {
      console.warn(`[ClinicContext] La cita #${id} está cancelada de forma irreversible y no se puede reactivar.`);
      return;
    }

    const updatedTarget: Appointment = { ...current, status };

    setAppointments(prev =>
      prev.map(app => (app.id === id ? { ...app, status } : app))
    );

    if (!deletedAppointmentIdsRef.current.has(id)) {
      syncSaveAppointmentToSupabase(updatedTarget).catch(err =>
        console.warn('Background sync error (updateAppointmentStatus):', err)
      );
    }
  };

  const updateAppointment = (id: string, updates: Partial<Appointment>) => {
    const current = appointments.find(app => app.id === id);
    if (!current) return;
    if (current.status === 'cancelada' && updates.status && updates.status !== 'cancelada') {
      console.warn(`[ClinicContext] La cita #${id} está cancelada y no se puede reactivar.`);
      return;
    }

    const updatedTarget: Appointment = { ...current, ...updates };

    setAppointments(prev =>
      prev.map(app => (app.id === id ? { ...app, ...updates } : app))
    );

    if (!deletedAppointmentIdsRef.current.has(id)) {
      syncSaveAppointmentToSupabase(updatedTarget).catch(err =>
        console.warn('Background sync error (updateAppointment):', err)
      );
    }
  };

  const cancelAppointment = (id: string, reason: string, cancelledBy: 'paciente' | 'clinica') => {
    const cleanReason = reason.trim() || (cancelledBy === 'paciente' ? 'Cancelada por el paciente' : 'Cancelada por la clínica');
    const cancelledAt = new Date().toISOString();
    const current = appointments.find(app => app.id === id);

    let updatedTarget: Appointment | null = null;
    if (current) {
      const updatedNotes = current.notes
        ? `${current.notes} | [Cancelada por ${cancelledBy}: ${cleanReason}]`
        : `[Cancelada por ${cancelledBy}: ${cleanReason}]`;
      updatedTarget = {
        ...current,
        status: 'cancelada' as AppointmentStatus,
        cancellationReason: cleanReason,
        cancelledBy,
        cancelledAt,
        notes: updatedNotes,
      };
    }

    setAppointments(prev =>
      prev.map(app => {
        if (app.id !== id) return app;
        const updatedNotes = app.notes
          ? `${app.notes} | [Cancelada por ${cancelledBy}: ${cleanReason}]`
          : `[Cancelada por ${cancelledBy}: ${cleanReason}]`;

        return {
          ...app,
          status: 'cancelada' as AppointmentStatus,
          cancellationReason: cleanReason,
          cancelledBy,
          cancelledAt,
          notes: updatedNotes,
        };
      })
    );

    if (updatedTarget && !deletedAppointmentIdsRef.current.has(id)) {
      syncSaveAppointmentToSupabase(updatedTarget).catch(err =>
        console.warn('Background sync error (cancelAppointment):', err)
      );
    }
  };

  const deleteAppointment = async (id: string): Promise<boolean> => {
    persistDeletedAppointmentIds([id]);
    setAppointments(prev => {
      const next = prev.filter(app => app.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
    try {
      const ok = await syncDeleteAppointmentFromSupabase(id);
      setRlsDeleteBlocked(isRlsDeleteBlocked());
      return ok;
    } catch (err) {
      console.warn('Background sync error (deleteAppointment):', err);
      return false;
    }
  };

  const purgeCancelledAppointments = async (appointmentIds: string[]): Promise<number> => {
    const validIds = new Set(
      appointments
        .filter(
          app =>
            (app.status === 'cancelada' || app.status === 'atendida') &&
            appointmentIds.includes(app.id)
        )
        .map(app => app.id)
    );

    if (validIds.size === 0) return 0;

    const idsList = Array.from(validIds);
    persistDeletedAppointmentIds(idsList);

    setAppointments(prev => {
      const next = prev.filter(app => !validIds.has(app.id));
      try {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });

    await syncDeleteAppointmentsBatchFromSupabase(idsList);
    setRlsDeleteBlocked(isRlsDeleteBlocked());
    return idsList.length;
  };

  const addDoctor = (doctorData: Omit<Doctor, 'id'>): Doctor => {
    const id = `doc-${Date.now()}`;
    const newDoc: Doctor = { ...doctorData, id };
    setDoctors(prev => [...prev, newDoc]);

    const matchingSpec = specialties.find(s => s.id === newDoc.specialtyId);
    syncSaveDoctorToSupabase(newDoc, matchingSpec).catch(err =>
      console.warn('Background sync error (addDoctor):', err)
    );

    return newDoc;
  };

  const updateDoctor = (id: string, updates: Partial<Doctor>) => {
    setDoctors(prev => {
      const next = prev.map(doc => (doc.id === id ? { ...doc, ...updates } : doc));
      const target = next.find(doc => doc.id === id);
      if (target) {
        const matchingSpec = specialties.find(s => s.id === target.specialtyId);
        syncSaveDoctorToSupabase(target, matchingSpec).catch(err =>
          console.warn('Background sync error (updateDoctor):', err)
        );
      }
      return next;
    });
  };

  const toggleDoctorActive = (id: string) => {
    setDoctors(prev => {
      const next = prev.map(doc => (doc.id === id ? { ...doc, active: !doc.active } : doc));
      const target = next.find(doc => doc.id === id);
      if (target) {
        const matchingSpec = specialties.find(s => s.id === target.specialtyId);
        syncSaveDoctorToSupabase(target, matchingSpec).catch(err =>
          console.warn('Background sync error (toggleDoctorActive):', err)
        );
      }
      return next;
    });
  };

  const deleteDoctor = (id: string) => {
    setDoctors(prev => prev.filter(doc => doc.id !== id));
    setBlockedSlots(prev => prev.filter(b => b.doctorId !== id));

    syncDeleteDoctorFromSupabase(id).catch(err =>
      console.warn('Background sync error (deleteDoctor):', err)
    );
  };

  const addSpecialty = (specialtyData: Omit<Specialty, 'id'>): Specialty => {
    const id = `esp-${Date.now()}`;
    const newSpec: Specialty = { ...specialtyData, id };
    setSpecialties(prev => [...prev, newSpec]);

    syncSaveSpecialtyToSupabase(newSpec).catch(err =>
      console.warn('Background sync error (addSpecialty):', err)
    );

    return newSpec;
  };

  const updateSpecialty = (id: string, updates: Partial<Specialty>) => {
    setSpecialties(prev => {
      const next = prev.map(spec => (spec.id === id ? { ...spec, ...updates } : spec));
      const target = next.find(spec => spec.id === id);
      if (target) {
        syncSaveSpecialtyToSupabase(target).catch(err =>
          console.warn('Background sync error (updateSpecialty):', err)
        );
      }
      return next;
    });
  };

  const deleteSpecialty = (id: string) => {
    setSpecialties(prev => prev.filter(spec => spec.id !== id));

    syncDeleteSpecialtyFromSupabase(id).catch(err =>
      console.warn('Background sync error (deleteSpecialty):', err)
    );
  };

  const updateClinicConfig = (updates: Partial<ClinicConfig>) => {
    setClinicConfig(prev => {
      const normalizedUpdates = { ...updates };
      if (normalizedUpdates.adminPin !== undefined) {
        normalizedUpdates.adminPin = encodePinForStorage(normalizedUpdates.adminPin);
      }
      const next = { ...prev, ...normalizedUpdates };
      syncSaveConfigToSupabase(next).catch(err =>
        console.warn('Background sync error (updateClinicConfig):', err)
      );
      return next;
    });
  };

  const clearAllData = () => {
    persistDeletedAppointmentIds(appointments.map(a => a.id));
    setAppointments([]);
    setDoctors([]);
    setSpecialties([]);
    setClinicConfig(initialClinicConfig);
    setBlockedSlots([]);
    localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
    localStorage.removeItem(STORAGE_KEYS.DOCTORS);
    localStorage.removeItem(STORAGE_KEYS.SPECIALTIES);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.BLOCKED);

    syncClearAllDataFromSupabase(initialClinicConfig).catch(err =>
      console.warn('Background sync error (clearAllData):', err)
    );
  };

  const resetToDemoData = clearAllData;

  const exportBackupData = () => {
    const payload = {
      version: '3.0',
      exportedAt: new Date().toISOString(),
      clinicConfig,
      specialties,
      doctors,
      appointments,
      blockedSlots,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().split('T')[0];
    const safeClinicName = (clinicConfig.name || 'medicitas')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_${safeClinicName || 'medicitas'}_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackupData = async (
    jsonText: string,
    pushToCloudIfConnected = true
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const parsed = JSON.parse(jsonText);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (!Array.isArray(parsed.doctors) &&
          !Array.isArray(parsed.specialties) &&
          !Array.isArray(parsed.appointments) &&
          !parsed.clinicConfig)
      ) {
        return {
          success: false,
          message: 'El archivo seleccionado no tiene un formato de respaldo válido de MediCitas (.json).',
        };
      }

      const nextConfig: ClinicConfig = parsed.clinicConfig
        ? { ...initialClinicConfig, ...parsed.clinicConfig }
        : clinicConfig;
      const nextSpecialties: Specialty[] = Array.isArray(parsed.specialties)
        ? parsed.specialties
        : specialties;
      const nextDoctors: Doctor[] = Array.isArray(parsed.doctors) ? parsed.doctors : doctors;
      const nextAppointments: Appointment[] = Array.isArray(parsed.appointments)
        ? parsed.appointments
        : appointments;
      const nextBlockedSlots: BlockedSlot[] = Array.isArray(parsed.blockedSlots)
        ? parsed.blockedSlots
        : blockedSlots;

      // Clear any deleted appointment tombstones for IDs being explicitly restored from backup
      nextAppointments.forEach(a => {
        if (a?.id) deletedAppointmentIdsRef.current.delete(a.id);
      });
      try {
        localStorage.setItem(
          STORAGE_KEYS.DELETED_APPOINTMENTS,
          JSON.stringify(Array.from(deletedAppointmentIdsRef.current))
        );
      } catch {
        // ignore
      }

      setClinicConfig(nextConfig);
      setSpecialties(nextSpecialties);
      setDoctors(nextDoctors);
      setAppointments(nextAppointments);
      setBlockedSlots(nextBlockedSlots);

      try {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(nextConfig));
        localStorage.setItem(STORAGE_KEYS.SPECIALTIES, JSON.stringify(nextSpecialties));
        localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(nextDoctors));
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(nextAppointments));
        localStorage.setItem(STORAGE_KEYS.BLOCKED, JSON.stringify(nextBlockedSlots));
      } catch {
        // ignore
      }

      if (pushToCloudIfConnected && isSupabaseConfigured()) {
        setIsCloudSyncing(true);
        const cloudRes = await uploadAllLocalDataToSupabase({
          clinicConfig: nextConfig,
          specialties: nextSpecialties,
          doctors: nextDoctors,
          appointments: nextAppointments,
          blockedSlots: nextBlockedSlots,
        });
        setIsCloudSyncing(false);
        if (cloudRes.success) {
          setIsCloudConnected(true);
          setLastCloudSync(new Date());
          return {
            success: true,
            message: `¡Respaldo restaurado y sincronizado con la base de datos online con éxito! (${nextSpecialties.length} especialidades, ${nextDoctors.length} médicos, ${nextAppointments.length} citas).`,
          };
        }
        return {
          success: true,
          message: `Respaldo cargado localmente (${nextSpecialties.length} especialidades, ${nextDoctors.length} médicos, ${nextAppointments.length} citas), pero hubo un aviso al subir a la Nube: ${cloudRes.message}`,
        };
      }

      return {
        success: true,
        message: `¡Respaldo restaurado localmente con éxito! (${nextSpecialties.length} especialidades, ${nextDoctors.length} médicos, ${nextAppointments.length} citas).`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: 'Error al leer el archivo JSON: asegúrate de seleccionar un archivo .json válido.',
      };
    }
  };

  const isSlotTaken = (
    doctorId: string,
    dateStr: string,
    timeStr: string,
    excludeAppointmentId?: string
  ): boolean => {
    return appointments.some(
      app =>
        app.id !== excludeAppointmentId &&
        app.doctorId === doctorId &&
        app.date === dateStr &&
        app.time === timeStr &&
        app.status !== 'cancelada'
    );
  };

  const getAvailableSlotsForDoctor = (
    doctorId: string,
    dateStr: string,
    excludeAppointmentId?: string
  ): string[] => {
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor || !doctor.active) return [];

    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    if (!doctor.availableDays.includes(dayOfWeek)) {
      return [];
    }

    const isDayBlocked = blockedSlots.some(
      b => b.doctorId === doctorId && b.date === dateStr && !b.time
    );
    if (isDayBlocked) return [];

    const [startH, startM] = doctor.startHour.split(':').map(Number);
    const [endH, endM] = doctor.endHour.split(':').map(Number);
    const duration = doctor.slotDurationMinutes || 30;

    let lunchStartMinutes = -1;
    let lunchEndMinutes = -1;
    if (doctor.lunchStart && doctor.lunchEnd) {
      const [lh1, lm1] = doctor.lunchStart.split(':').map(Number);
      const [lh2, lm2] = doctor.lunchEnd.split(':').map(Number);
      lunchStartMinutes = lh1 * 60 + lm1;
      lunchEndMinutes = lh2 * 60 + lm2;
    }

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    const slots: string[] = [];

    for (let current = startTotal; current + duration <= endTotal; current += duration) {
      if (lunchStartMinutes !== -1 && current >= lunchStartMinutes && current < lunchEndMinutes) {
        continue;
      }

      const h = Math.floor(current / 60);
      const m = current % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      const taken = isSlotTaken(doctorId, dateStr, timeStr, excludeAppointmentId);
      if (!taken) {
        slots.push(timeStr);
      }
    }

    return slots;
  };

  return (
    <ClinicContext.Provider
      value={{
        appointments,
        doctors,
        specialties,
        clinicConfig,
        blockedSlots,
        addAppointment,
        updateAppointmentStatus,
        updateAppointment,
        cancelAppointment,
        deleteAppointment,
        purgeCancelledAppointments,
        addDoctor,
        updateDoctor,
        deleteDoctor,
        toggleDoctorActive,
        addSpecialty,
        updateSpecialty,
        deleteSpecialty,
        updateClinicConfig,
        clearAllData,
        resetToDemoData,
        getAvailableSlotsForDoctor,
        isSlotTaken,
        isCloudConnected,
        isCloudSyncing,
        cloudError,
        lastCloudSync,
        rlsDeleteBlocked,
        supabaseConfig,
        setCloudConfig,
        disconnectOnlineDatabase,
        connectOnlineDatabase,
        syncFromCloud,
        syncToCloud,
        exportBackupData,
        importBackupData,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};
