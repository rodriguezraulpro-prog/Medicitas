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
  deleteAppointment: (id: string) => void;
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
  supabaseConfig: SupabaseConfig;
  setCloudConfig: (config: SupabaseConfig) => Promise<{ success: boolean; message: string }>;
  syncFromCloud: (silent?: boolean) => Promise<{ success: boolean; message: string }>;
  syncToCloud: () => Promise<{ success: boolean; message: string }>;
}

const STORAGE_KEYS = {
  APPOINTMENTS: 'medicitas_appointments_v3',
  DOCTORS: 'medicitas_doctors_v3',
  SPECIALTIES: 'medicitas_specialties_v3',
  CONFIG: 'medicitas_config_v3',
  BLOCKED: 'medicitas_blocked_v3',
  DELETED_APPOINTMENTS: 'medicitas_deleted_appointments_v3',
};

// Purge old v1/v2 demo & cached keys if present to ensure a completely clean template start
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
  localStorage.removeItem('medicitas_supabase_config');
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

  const persistDeletedAppointmentIds = useCallback((idsToAdd: string[]) => {
    idsToAdd.forEach(id => deletedAppointmentIdsRef.current.add(id));
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

      const remoteDeletedStillPresent = data.appointments.filter(a =>
        deletedAppointmentIdsRef.current.has(a.id)
      );
      if (remoteDeletedStillPresent.length > 0) {
        syncDeleteAppointmentsBatchFromSupabase(remoteDeletedStillPresent.map(a => a.id)).catch(
          err => console.warn('Re-deleting purged appointments from cloud error:', err)
        );
      }

      const activeRemoteAppointments = data.appointments.filter(
        a => !deletedAppointmentIdsRef.current.has(a.id)
      );

      setAppointments(prev => {
        const remoteIds = new Set(activeRemoteAppointments.map(a => a.id));
        const unsyncedLocal = prev.filter(
          localApp =>
            !remoteIds.has(localApp.id) && !deletedAppointmentIdsRef.current.has(localApp.id)
        );
        if (unsyncedLocal.length > 0) {
          unsyncedLocal.forEach(app => {
            syncSaveAppointmentToSupabase(app).catch(err =>
              console.warn('Auto-uploading unsynced local appointment error:', err)
            );
          });
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
    if (!newConfig.url || !newConfig.anonKey) {
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

    // Save both locally and to server/worker so all devices (phones, tablets, PCs) get it
    await saveServerSupabaseConfig(cleanConfig);
    setSupabaseConfigState(cleanConfig);
    setSupabaseClientConfig(cleanConfig);
    setIsCloudConnected(true);
    setCloudError(null);

    // Load cloud data if available; NEVER overwrite remote data from a fresh/blank device
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

    const hasLocalCustomData =
      doctors.length > 0 ||
      specialties.length > 0 ||
      appointments.length > 0 ||
      clinicConfig.name !== initialClinicConfig.name ||
      clinicConfig.whatsappNumber !== '' ||
      clinicConfig.phone !== '';

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
            !remoteIds.has(localApp.id) && !deletedAppointmentIdsRef.current.has(localApp.id)
        );
        if (unsyncedLocal.length > 0) {
          unsyncedLocal.forEach(app => {
            syncSaveAppointmentToSupabase(app).catch(() => {});
          });
          return [...unsyncedLocal, ...activeRemoteAppointments];
        }
        return activeRemoteAppointments;
      });
      setBlockedSlots(cloudData.blockedSlots);
    } else if (hasLocalCustomData) {
      // Cloud is completely brand new and this device has local data to seed
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
      message: '¡Conexión establecida y sincronizada! Todos los dispositivos conectados a esta base de datos reflejarán los datos en tiempo real.',
    };
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
        setSupabaseConfigState(effectiveCfg);
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
    if (!supabaseConfig.url || !supabaseConfig.anonKey) return;

    const client = getSupabaseClient();
    if (!client) return;

    const realtimeChannel = client
      .channel('medicitas-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
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
      if (document.visibilityState === 'visible') {
        syncFromCloud(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(intervalId);
      client.removeChannel(realtimeChannel);
    };
  }, [supabaseConfig.url, supabaseConfig.anonKey, syncFromCloud]);

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

    setAppointments(prev => {
      const next = [newAppointment, ...prev];
      try {
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(next));
      } catch {
        // ignore storage error
      }
      return next;
    });

    syncSaveAppointmentToSupabase(newAppointment).catch(err =>
      console.warn('Background sync error (addAppointment):', err)
    );

    return newAppointment;
  };

  const updateAppointmentStatus = (id: string, status: AppointmentStatus) => {
    setAppointments(prev => {
      const current = prev.find(app => app.id === id);
      // Cancellation is strictly irreversible
      if (current && current.status === 'cancelada' && status !== 'cancelada') {
        console.warn(`[ClinicContext] La cita #${id} está cancelada de forma irreversible y no se puede reactivar.`);
        return prev;
      }

      const next = prev.map(app => (app.id === id ? { ...app, status } : app));
      const target = next.find(app => app.id === id);
      if (target) {
        syncSaveAppointmentToSupabase(target).catch(err =>
          console.warn('Background sync error (updateAppointmentStatus):', err)
        );
      }
      return next;
    });
  };

  const updateAppointment = (id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => {
      const current = prev.find(app => app.id === id);
      // Cancellation is strictly irreversible
      if (current && current.status === 'cancelada' && updates.status && updates.status !== 'cancelada') {
        console.warn(`[ClinicContext] La cita #${id} está cancelada y no se puede reactivar.`);
        return prev;
      }

      const next = prev.map(app => (app.id === id ? { ...app, ...updates } : app));
      const target = next.find(app => app.id === id);
      if (target) {
        syncSaveAppointmentToSupabase(target).catch(err =>
          console.warn('Background sync error (updateAppointment):', err)
        );
      }
      return next;
    });
  };

  const cancelAppointment = (id: string, reason: string, cancelledBy: 'paciente' | 'clinica') => {
    const cleanReason = reason.trim() || (cancelledBy === 'paciente' ? 'Cancelada por el paciente' : 'Cancelada por la clínica');
    const cancelledAt = new Date().toISOString();

    setAppointments(prev => {
      const next = prev.map(app => {
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
      });

      const target = next.find(app => app.id === id);
      if (target) {
        syncSaveAppointmentToSupabase(target).catch(err =>
          console.warn('Background sync error (cancelAppointment):', err)
        );
      }
      return next;
    });
  };

  const deleteAppointment = (id: string) => {
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
    syncDeleteAppointmentFromSupabase(id).catch(err =>
      console.warn('Background sync error (deleteAppointment):', err)
    );
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
        supabaseConfig,
        setCloudConfig,
        syncFromCloud,
        syncToCloud,
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
