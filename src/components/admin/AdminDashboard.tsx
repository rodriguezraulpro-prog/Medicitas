import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { AppointmentsManager } from './AppointmentsManager';
import { DoctorsManager } from './DoctorsManager';
import { ReportsAnalytics } from './ReportsAnalytics';
import { ClinicSettings } from './ClinicSettings';
import { SupabaseManager } from './SupabaseManager';
import { NewAppointmentModal } from './NewAppointmentModal';
import { Database } from 'lucide-react';

export type AdminSection = 'appointments' | 'doctors' | 'reports' | 'settings' | 'database';

interface AdminDashboardProps {
  activeSection: AdminSection;
  setActiveSection: (section: AdminSection) => void;
  onBackToPatientView?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeSection,
  setActiveSection,
}) => {
  const { appointments, doctors, clinicConfig, isCloudConnected } = useClinic();
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [appointmentPrefill, setAppointmentPrefill] = useState<any>(null);

  const handleOpenNewAppointmentModal = (prefill?: any) => {
    setAppointmentPrefill(prefill || null);
    setShowNewAppointmentModal(true);
  };

  // Real-time quick counters
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const pendingWhatsApp = appointments.filter(a => a.status === 'pendiente_whatsapp');
  const activeDoctorsCount = doctors.filter(d => d.active).length;

  return (
    <div className="space-y-4">
      {/* Top Admin Quick Status Banner (Medical Blue & White Theme) */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white rounded-3xl p-5 sm:p-6 shadow-md shadow-blue-700/10 space-y-4">
        
        {/* Upper row: Section title */}
        <div className="border-b border-white/20 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-black text-white">
              {activeSection === 'appointments' && 'Gestión de Citas'}
              {activeSection === 'doctors' && 'Médicos y Especialistas'}
              {activeSection === 'reports' && 'Reportes en Tiempo Real'}
              {activeSection === 'settings' && 'Configuración de la Clínica'}
              {activeSection === 'database' && 'Base de Datos en la Nube (Supabase)'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('database')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                isCloudConnected
                  ? 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-blue-100 border-white/20 hover:bg-white/20'
              }`}
              title="Configurar conexión con Supabase"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isCloudConnected ? 'Supabase Conectado' : 'Supabase (Offline)'}</span>
            </button>
            <span className="text-xs font-semibold text-blue-100 bg-white/10 px-3 py-1 rounded-full border border-white/20 hidden sm:inline-block">
              Panel Clínico
            </span>
          </div>
        </div>

        {/* Quick Snapshot Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
            <span className="text-[11px] text-blue-100 font-semibold block">Citas para Hoy</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-white">{todayAppointments.length}</span>
              <span className="text-[10px] text-blue-200 font-medium">agendadas</span>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
            <span className="text-[11px] text-blue-100 font-semibold block">Pendientes WhatsApp</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-amber-300">{pendingWhatsApp.length}</span>
              <span className="text-[10px] text-amber-200 font-medium">por confirmar</span>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
            <span className="text-[11px] text-blue-100 font-semibold block">Médicos Activos</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold text-white">{activeDoctorsCount}</span>
              <span className="text-[10px] text-blue-200 font-medium">en servicio</span>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-xs rounded-2xl p-3.5 border border-white/20">
            <span className="text-[11px] text-blue-100 font-semibold block">Destino WhatsApp</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xs font-bold text-white truncate">
                {clinicConfig.whatsappNumber
                  ? `+${clinicConfig.whatsappCountryCode} ${clinicConfig.whatsappNumber}`
                  : 'Por configurar'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Section Content */}
      <div className="space-y-4">
        {activeSection === 'appointments' && (
          <AppointmentsManager
            onOpenNewAppointmentModal={handleOpenNewAppointmentModal}
          />
        )}

        {activeSection === 'doctors' && <DoctorsManager />}

        {activeSection === 'reports' && <ReportsAnalytics />}

        {activeSection === 'settings' && <ClinicSettings />}

        {activeSection === 'database' && (
          <SupabaseManager
            onBackToSafeSection={() => setActiveSection('appointments')}
          />
        )}
      </div>

      {/* Walk-in appointment creation modal */}
      {showNewAppointmentModal && (
        <NewAppointmentModal
          initialData={appointmentPrefill}
          onClose={() => {
            setShowNewAppointmentModal(false);
            setAppointmentPrefill(null);
          }}
        />
      )}
    </div>
  );
};
