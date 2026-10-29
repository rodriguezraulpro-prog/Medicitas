import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Appointment, AppointmentStatus } from '../../types';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  UserCheck,
  Building,
  Video,
  Download,
  Plus,
  RefreshCw,
  Eye,
  AlertCircle,
  Stethoscope,
  User,
  X,
  Sun,
  Moon,
  Lock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import {
  formatDatePretty,
  formatTimePretty,
  generateClinicConfirmationMessage,
  generateClinicCancellationNoticeToPatient,
  buildWhatsAppUrl,
} from '../../utils/whatsapp';

interface AppointmentsManagerProps {
  onOpenNewAppointmentModal: (prefill?: Partial<Appointment>) => void;
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_SHORT_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export const AppointmentsManager: React.FC<AppointmentsManagerProps> = ({
  onOpenNewAppointmentModal,
}) => {
  const {
    appointments,
    updateAppointmentStatus,
    cancelAppointment,
    deleteAppointment,
    purgeCancelledAppointments,
    clinicConfig,
    doctors,
    specialties,
    syncFromCloud,
    isCloudSyncing,
  } = useClinic();

  // Refresh appointments from Cloud whenever the admin opens the Appointments tab
  useEffect(() => {
    syncFromCloud(true);
  }, [syncFromCloud]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'tomorrow' | 'week' | 'custom'>('all');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());
  const calendarPopoverRef = useRef<HTMLDivElement | null>(null);

  const [timeShiftFilter, setTimeShiftFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>('all');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');

  // Close dropdown calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        calendarPopoverRef.current &&
        !calendarPopoverRef.current.contains(event.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // Admin cancellation modal state
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState<string>('');

  // Purge attended & cancelled appointments modal state
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purgeStatusTarget, setPurgeStatusTarget] = useState<'both' | 'cancelada' | 'atendida'>('both');
  const [purgePeriod, setPurgePeriod] = useState<
    'past' | 'older_7' | 'older_15' | 'older_30' | 'older_90' | 'custom_range' | 'all_cancelled'
  >('past');
  const [purgeFromDate, setPurgeFromDate] = useState<string>('');
  const [purgeToDate, setPurgeToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // All cleanable appointments (cancelled + attended)
  const totalCancelledCount = useMemo(
    () => appointments.filter(a => a.status === 'cancelada' || a.status === 'atendida').length,
    [appointments]
  );

  // Appointments matching the selected status target and purge period
  const matchingCancelledToPurge = useMemo(() => {
    const getCutoffDateStr = (daysAgo: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    return appointments.filter(app => {
      if (purgeStatusTarget === 'both') {
        if (app.status !== 'cancelada' && app.status !== 'atendida') return false;
      } else if (purgeStatusTarget === 'cancelada') {
        if (app.status !== 'cancelada') return false;
      } else if (purgeStatusTarget === 'atendida') {
        if (app.status !== 'atendida') return false;
      }

      if (purgePeriod === 'all_cancelled') {
        return true;
      }
      if (purgePeriod === 'past') {
        return app.date < todayStr;
      }
      if (purgePeriod === 'older_7') {
        return app.date <= getCutoffDateStr(7);
      }
      if (purgePeriod === 'older_15') {
        return app.date <= getCutoffDateStr(15);
      }
      if (purgePeriod === 'older_30') {
        return app.date <= getCutoffDateStr(30);
      }
      if (purgePeriod === 'older_90') {
        return app.date <= getCutoffDateStr(90);
      }
      if (purgePeriod === 'custom_range') {
        if (purgeFromDate && app.date < purgeFromDate) return false;
        if (purgeToDate && app.date > purgeToDate) return false;
        return Boolean(purgeFromDate || purgeToDate);
      }
      return false;
    });
  }, [appointments, purgeStatusTarget, purgePeriod, purgeFromDate, purgeToDate, todayStr]);

  const handleConfirmPurgeCancelled = async () => {
    if (matchingCancelledToPurge.length === 0) return;
    setIsPurging(true);
    try {
      const ids = matchingCancelledToPurge.map(a => a.id);
      const deletedCount = await purgeCancelledAppointments(ids);
      setShowPurgeModal(false);
      const targetLabel =
        purgeStatusTarget === 'both'
          ? deletedCount === 1
            ? 'cita (atendida/cancelada)'
            : 'citas (atendidas y canceladas)'
          : purgeStatusTarget === 'atendida'
          ? deletedCount === 1
            ? 'cita atendida'
            : 'citas atendidas'
          : deletedCount === 1
          ? 'cita cancelada'
          : 'citas canceladas';
      setPurgeFeedback(
        `Se eliminaron ${deletedCount} ${targetLabel} de la base de datos.`
      );
      setTimeout(() => setPurgeFeedback(null), 5000);
    } finally {
      setIsPurging(false);
    }
  };

  // Filter available doctors if a specialty is pre-selected
  const availableDoctors = useMemo(() => {
    if (selectedSpecialtyId === 'all') {
      return doctors;
    }
    return doctors.filter(doc => doc.specialtyId === selectedSpecialtyId);
  }, [doctors, selectedSpecialtyId]);

  // Appointment counts per specialty
  const appointmentCountsBySpecialty = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      counts[a.specialtyId] = (counts[a.specialtyId] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  // Appointment counts per doctor
  const appointmentCountsByDoctor = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      counts[a.doctorId] = (counts[a.doctorId] || 0) + 1;
    });
    return counts;
  }, [appointments]);

  // Appointment counts per date (YYYY-MM-DD) for the dropdown calendar
  const appointmentCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach(a => {
      if (a.status !== 'cancelada') {
        counts[a.date] = (counts[a.date] || 0) + 1;
      }
    });
    return counts;
  }, [appointments]);

  // Calendar grid generation for current calendarViewDate
  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Convert Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{ dateStr: string; dayNum: number } | null> = [];
    for (let i = 0; i < startWeekday; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push({
        dateStr: `${year}-${mm}-${dd}`,
        dayNum: d,
      });
    }
    return days;
  }, [calendarViewDate]);

  const handleSelectSpecificDate = (dateStr: string) => {
    setSpecificDate(dateStr);
    setDateFilter('custom');
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (y && m && d) {
        setCalendarViewDate(new Date(y, m - 1, d));
      }
    }
    setIsCalendarOpen(false);
  };

  // Handle specialty dropdown change
  const handleSpecialtyChange = (specId: string) => {
    setSelectedSpecialtyId(specId);
    if (specId !== 'all') {
      const isCurrentDoctorInSpec = doctors.some(
        d => d.id === selectedDoctorId && d.specialtyId === specId
      );
      if (!isCurrentDoctorInSpec) {
        setSelectedDoctorId('all');
      }
    }
  };

  // Handle doctor dropdown change
  const handleDoctorChange = (docId: string) => {
    setSelectedDoctorId(docId);
    if (docId !== 'all') {
      const doc = doctors.find(d => d.id === docId);
      if (doc && selectedSpecialtyId === 'all') {
        setSelectedSpecialtyId(doc.specialtyId);
      }
    }
  };

  // Clear all applied filters
  const resetAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setSpecificDate('');
    setIsCalendarOpen(false);
    setTimeShiftFilter('all');
    setSelectedSpecialtyId('all');
    setSelectedDoctorId('all');
  };

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    dateFilter !== 'all' ||
    specificDate !== '' ||
    timeShiftFilter !== 'all' ||
    selectedSpecialtyId !== 'all' ||
    selectedDoctorId !== 'all';

  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      // Search match
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        app.patientName.toLowerCase().includes(search) ||
        (app.patientDni && app.patientDni.toLowerCase().includes(search)) ||
        app.patientPhone.includes(search) ||
        app.doctorName.toLowerCase().includes(search) ||
        app.specialtyName.toLowerCase().includes(search) ||
        app.id.toLowerCase().includes(search);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter !== 'all' && app.status !== statusFilter) {
        return false;
      }

      // Specialty filter
      if (selectedSpecialtyId !== 'all' && app.specialtyId !== selectedSpecialtyId) {
        return false;
      }

      // Doctor filter
      if (selectedDoctorId !== 'all' && app.doctorId !== selectedDoctorId) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today') {
        if (app.date !== todayStr) return false;
      } else if (dateFilter === 'tomorrow') {
        if (app.date !== tomorrowStr) return false;
      } else if (dateFilter === 'week') {
        const appDate = new Date(app.date);
        const now = new Date();
        const diffDays = (appDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays < -1 || diffDays > 7) return false;
      } else if (dateFilter === 'custom' && specificDate) {
        if (app.date !== specificDate) return false;
      }

      // Shift / Hour filter (Turno Mañana: < 13:00, Turno Tarde: >= 13:00)
      if (timeShiftFilter === 'morning') {
        const hour = parseInt(app.time.split(':')[0], 10);
        if (hour >= 13) return false;
      } else if (timeShiftFilter === 'afternoon') {
        const hour = parseInt(app.time.split(':')[0], 10);
        if (hour < 13) return false;
      }

      return true;
    });
  }, [
    appointments,
    searchTerm,
    statusFilter,
    dateFilter,
    specificDate,
    timeShiftFilter,
    selectedSpecialtyId,
    selectedDoctorId,
    todayStr,
    tomorrowStr,
  ]);

  // Export to CSV (reflecting all applied filters)
  const handleExportCSV = () => {
    const headers = [
      'Código',
      'Paciente',
      'DNI',
      'Teléfono',
      'Especialidad',
      'Médico',
      'Fecha',
      'Hora',
      'Modalidad',
      'Tarifa',
      'Estado',
      'Motivo',
    ];

    const rows = filteredAppointments.map(a => [
      a.id,
      `"${a.patientName}"`,
      `"${a.patientDni || 'N/A'}"`,
      `"${a.patientPhone}"`,
      `"${a.specialtyName}"`,
      `"${a.doctorName}"`,
      a.date,
      a.time,
      a.type,
      `${clinicConfig.currencySymbol}${a.fee}`,
      a.status,
      `"${a.reason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Citas_${clinicConfig.name.replace(/\s+/g, '_')}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open WhatsApp to reply/confirm to the patient
  const handleContactPatientWhatsApp = (app: Appointment) => {
    const message = generateClinicConfirmationMessage(app, clinicConfig);
    const url = buildWhatsAppUrl(app.patientPhone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Open WhatsApp to notify the patient about irreversible cancellation
  const handleContactCancelledPatientWhatsApp = (app: Appointment) => {
    const message = generateClinicCancellationNoticeToPatient(app, clinicConfig);
    const url = buildWhatsAppUrl(app.patientPhone, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Confirm admin cancellation (irreversible)
  const handleConfirmAdminCancel = () => {
    if (!cancellingAppointment) return;
    const reason = adminCancelReason.trim() || 'Cancelada por la clínica / consultorio';
    cancelAppointment(cancellingAppointment.id, reason, 'clinica');
    setCancellingAppointment(null);
    setAdminCancelReason('');
  };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Control de Citas en Tiempo Real
          </h3>
          <p className="text-xs text-slate-500">
            Gestiona reservas, filtra por médico o especialidad, y confirma turnos por WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-admin-refresh-appointments"
            onClick={() => syncFromCloud(false)}
            disabled={isCloudSyncing}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            title="Sincronizar citas desde la Nube"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span>{isCloudSyncing ? 'Sincronizando...' : 'Actualizar'}</span>
          </button>

          <button
            id="btn-admin-export-csv"
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar citas filtradas a Excel/CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden xs:inline">Exportar</span> CSV
          </button>

          <button
            id="btn-admin-purge-cancelled"
            onClick={() => setShowPurgeModal(true)}
            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Limpiar de la base de datos las citas antiguas ya atendidas o canceladas de un período"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Limpiar Atendidas / Canceladas</span>
            {totalCancelledCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-200/90 text-rose-900 text-[10px] font-extrabold">
                {totalCancelledCount}
              </span>
            )}
          </button>

          <button
            id="btn-admin-new-appointment"
            onClick={() => onOpenNewAppointmentModal()}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Cita Presencial</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner after purging cancelled appointments */}
      {purgeFeedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{purgeFeedback}</span>
          </div>
          <button
            onClick={() => setPurgeFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters & Search Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Row 1: Search & Status Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
          {/* Search bar */}
          <div className="relative lg:col-span-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-appointments"
              type="text"
              placeholder="Buscar paciente, DNI, teléfono o código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar lg:col-span-8">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'pendiente_whatsapp', label: 'Pendiente por confirmar' },
              { id: 'confirmada', label: 'Confirmadas' },
              { id: 'atendida', label: 'Atendidas' },
              { id: 'cancelada', label: 'Canceladas' },
            ].map(tab => (
              <button
                key={tab.id}
                id={`filter-status-${tab.id}`}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Specialty & Doctor Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
          {/* Specialty Filter Dropdown */}
          <div>
            <label
              htmlFor="select-filter-specialty"
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1"
            >
              <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
              <span>Filtro por Especialidad</span>
            </label>
            <div className="relative">
              <select
                id="select-filter-specialty"
                value={selectedSpecialtyId}
                onChange={e => handleSpecialtyChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer appearance-none ${
                  selectedSpecialtyId !== 'all'
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900 ring-1 ring-blue-400'
                    : 'bg-slate-50 hover:bg-white focus:bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">Todas las especialidades ({specialties.length})</option>
                {specialties.map(spec => {
                  const count = appointmentCountsBySpecialty[spec.id] || 0;
                  return (
                    <option key={spec.id} value={spec.id}>
                      {spec.name} {count > 0 ? `(${count} ${count === 1 ? 'cita' : 'citas'})` : '(Sin citas)'}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Doctor Filter Dropdown */}
          <div>
            <label
              htmlFor="select-filter-doctor"
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Filtro por Médico / Especialista</span>
            </label>
            <div className="relative">
              <select
                id="select-filter-doctor"
                value={selectedDoctorId}
                onChange={e => handleDoctorChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer appearance-none ${
                  selectedDoctorId !== 'all'
                    ? 'bg-blue-50/70 border-blue-300 text-blue-900 ring-1 ring-blue-400'
                    : 'bg-slate-50 hover:bg-white focus:bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="all">
                  {selectedSpecialtyId === 'all'
                    ? `Todos los médicos (${doctors.length})`
                    : `Médicos de esta especialidad (${availableDoctors.length})`}
                </option>
                {availableDoctors.map(doc => {
                  const count = appointmentCountsByDoctor[doc.id] || 0;
                  return (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} • {doc.consultorio} {count > 0 ? `(${count} ${count === 1 ? 'cita' : 'citas'})` : '(Sin citas)'}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Quick Clear or Summary box */}
          <div className="sm:col-span-2 lg:col-span-1 flex items-end">
            {hasActiveFilters ? (
              <button
                id="btn-clear-all-filters"
                onClick={resetAllFilters}
                className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar todos los filtros</span>
              </button>
            ) : (
              <div className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Mostrando todas las citas ({appointments.length})</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Date & Shift Filters + Active Filter Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date filter pills + Dropdown Calendar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Fecha:</span>
              </span>
              {[
                { id: 'all', label: 'Cualquiera' },
                { id: 'today', label: 'Hoy' },
                { id: 'tomorrow', label: 'Mañana' },
                { id: 'week', label: 'Esta Semana' },
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDateFilter(d.id as any);
                    if (d.id !== 'custom') {
                      setSpecificDate('');
                    }
                    setIsCalendarOpen(false);
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    dateFilter === d.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}

              {/* Dropdown Calendar Trigger & Popover */}
              <div className="relative" ref={calendarPopoverRef}>
                <div className="inline-flex items-center">
                  <button
                    id="btn-toggle-calendar-filter"
                    type="button"
                    onClick={() => setIsCalendarOpen(prev => !prev)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      dateFilter === 'custom' && specificDate
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : isCalendarOpen
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                    title="Abrir calendario para buscar citas en una fecha específica"
                  >
                    <Calendar
                      className={`w-3 h-3 ${
                        dateFilter === 'custom' && specificDate ? 'text-white' : 'text-blue-600'
                      }`}
                    />
                    <span>
                      {dateFilter === 'custom' && specificDate
                        ? formatDatePretty(specificDate)
                        : 'Elegir fecha'}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        isCalendarOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {dateFilter === 'custom' && specificDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setSpecificDate('');
                        setDateFilter('all');
                        setIsCalendarOpen(false);
                      }}
                      className="ml-1 px-1.5 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Quitar fecha seleccionada"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Calendar Popover */}
                {isCalendarOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Month & Year Navigation */}
                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarViewDate(
                            prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                          )
                        }
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                        title="Mes anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="text-xs font-extrabold text-slate-800 tracking-tight">
                        {MONTH_NAMES_ES[calendarViewDate.getMonth()]}{' '}
                        {calendarViewDate.getFullYear()}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCalendarViewDate(
                            prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                          )
                        }
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                        title="Mes siguiente"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                      {WEEKDAYS_SHORT_ES.map(dayName => (
                        <div
                          key={dayName}
                          className="text-[10px] font-bold text-slate-400 uppercase py-0.5"
                        >
                          {dayName}
                        </div>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((cell, idx) => {
                        if (!cell) {
                          return <div key={`empty-${idx}`} className="h-8" />;
                        }

                        const isSelected =
                          dateFilter === 'custom' && specificDate === cell.dateStr;
                        const isToday = cell.dateStr === todayStr;
                        const count = appointmentCountsByDate[cell.dateStr] || 0;

                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            onClick={() => handleSelectSpecificDate(cell.dateStr)}
                            title={
                              count > 0
                                ? `${count} ${count === 1 ? 'cita activa' : 'citas activas'}`
                                : 'Sin citas registradas'
                            }
                            className={`relative h-8 rounded-lg text-[11px] font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white font-bold shadow-xs'
                                : isToday
                                ? 'bg-blue-50 text-blue-700 border border-blue-300 font-bold'
                                : count > 0
                                ? 'bg-emerald-50/70 text-slate-800 hover:bg-blue-50 border border-emerald-200/70 font-bold'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="leading-none">{cell.dayNum}</span>
                            {count > 0 && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                                  isSelected ? 'bg-white' : 'bg-emerald-500'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Direct Date Input + Legend */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          <span>Días con citas</span>
                        </span>
                        <input
                          type="date"
                          value={specificDate}
                          onChange={e => {
                            if (e.target.value) {
                              handleSelectSpecificDate(e.target.value);
                            }
                          }}
                          className="px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          title="Escribir o elegir fecha directamente"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectSpecificDate(todayStr)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Ir a Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSpecificDate('');
                            setDateFilter('all');
                            setIsCalendarOpen(false);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Ver todas
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Hour / Shift filter pills (Mañana / Tarde) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:border-l sm:border-slate-200 sm:pl-3">
              <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Turno:</span>
              </span>
              <button
                id="filter-shift-all"
                onClick={() => setTimeShiftFilter('all')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  timeShiftFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                id="filter-shift-morning"
                onClick={() => setTimeShiftFilter('morning')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  timeShiftFilter === 'morning'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'bg-amber-50/80 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
                }`}
                title="Filtrar citas de la mañana (de 8:00 a 12:59)"
              >
                <Sun className={`w-3 h-3 ${timeShiftFilter === 'morning' ? 'text-white' : 'text-amber-500'}`} />
                <span>Turno Mañana</span>
              </button>
              <button
                id="filter-shift-afternoon"
                onClick={() => setTimeShiftFilter('afternoon')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  timeShiftFilter === 'afternoon'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'bg-indigo-50/80 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/80'
                }`}
                title="Filtrar citas de la tarde (desde las 13:00 en adelante)"
              >
                <Moon className={`w-3 h-3 ${timeShiftFilter === 'afternoon' ? 'text-white' : 'text-indigo-500'}`} />
                <span>Turno Tarde</span>
              </button>
            </div>
          </div>

          {/* Active filter badges & Counter */}
          <div className="flex flex-wrap items-center gap-2">
            {dateFilter === 'custom' && specificDate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold">
                <Calendar className="w-3 h-3 text-emerald-700" />
                <span>Fecha: {formatDatePretty(specificDate)}</span>
                <button
                  onClick={() => {
                    setSpecificDate('');
                    setDateFilter('all');
                  }}
                  className="hover:text-rose-600 ml-1 font-black cursor-pointer"
                  title="Quitar filtro de fecha específica"
                >
                  ✕
                </button>
              </span>
            )}

            {selectedSpecialtyId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200 text-[11px] font-bold">
                <span>Esp: {specialties.find(s => s.id === selectedSpecialtyId)?.name}</span>
                <button
                  onClick={() => handleSpecialtyChange('all')}
                  className="hover:text-rose-600 ml-1 font-black cursor-pointer"
                  title="Quitar filtro de especialidad"
                >
                  ✕
                </button>
              </span>
            )}

            {selectedDoctorId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold">
                <span>Dr: {doctors.find(d => d.id === selectedDoctorId)?.name}</span>
                <button
                  onClick={() => setSelectedDoctorId('all')}
                  className="hover:text-rose-600 ml-1 font-black cursor-pointer"
                  title="Quitar filtro de médico"
                >
                  ✕
                </button>
              </span>
            )}

            {timeShiftFilter !== 'all' && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${
                  timeShiftFilter === 'morning'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                }`}
              >
                {timeShiftFilter === 'morning' ? (
                  <>
                    <Sun className="w-3 h-3 text-amber-600" />
                    <span>Turno: Mañana</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3 text-indigo-600" />
                    <span>Turno: Tarde</span>
                  </>
                )}
                <button
                  onClick={() => setTimeShiftFilter('all')}
                  className="hover:text-rose-600 ml-1 font-black cursor-pointer"
                  title="Quitar filtro de turno"
                >
                  ✕
                </button>
              </span>
            )}

            <span className="text-slate-500 font-medium text-[11px]">
              <strong className="text-blue-700 font-bold">{filteredAppointments.length}</strong> de {appointments.length} citas
            </span>
          </div>
        </div>
      </div>

      {/* Appointment Cards List */}
      <div className="space-y-2.5">
        {filteredAppointments.map(appointment => {
          const isPending = appointment.status === 'pendiente_whatsapp';
          const isConfirmed = appointment.status === 'confirmada';
          const isAttended = appointment.status === 'atendida';
          const isCancelled = appointment.status === 'cancelada';

          return (
            <div
              key={appointment.id}
              id={`appointment-card-${appointment.id}`}
              className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                    #{appointment.id}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isConfirmed
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : isAttended
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : isCancelled
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isConfirmed ? (
                      'Confirmada'
                    ) : isAttended ? (
                      'Atendida'
                    ) : isCancelled ? (
                      <>
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>Cancelada (Irreversible)</span>
                      </>
                    ) : (
                      'Pendiente por confirmar'
                    )}
                  </span>

                  <span className="text-xs text-slate-400">
                    • Creada: {new Date(appointment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Right side Fee */}
                <div className="text-right flex items-center justify-between sm:justify-end gap-2">
                  <span className="text-xs text-slate-500 font-medium">Tarifa consulta:</span>
                  <span className="text-sm font-bold text-slate-900">
                    {clinicConfig.currencySymbol}{appointment.fee}
                  </span>
                </div>
              </div>

              {/* Patient & Doctor details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Patient Col */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Datos del Paciente
                  </span>
                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>{appointment.patientName}</span>
                    {appointment.patientDni && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md">
                        DNI: {appointment.patientDni}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">{appointment.patientPhone}</span>
                  </div>
                  {appointment.patientEmail && (
                    <div className="text-slate-500 text-[11px]">
                      {appointment.patientEmail}
                    </div>
                  )}
                  <div className="pt-1 text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-600">Motivo:</span> "{appointment.reason}"
                  </div>
                </div>

                {/* Appointment Col */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Especialista & Turno
                  </span>
                  <div className="font-bold text-sm text-blue-900">
                    {appointment.doctorName}
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {appointment.specialtyName} • {appointment.consultorio}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-1 font-bold text-slate-800 bg-blue-50 text-blue-900 px-2 py-1 rounded-md border border-blue-200">
                      <Calendar className="w-3.5 h-3.5 text-blue-700" />
                      <span className="capitalize">{formatDatePretty(appointment.date)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span>{formatTimePretty(appointment.time)}</span>
                      {parseInt(appointment.time.split(':')[0], 10) < 13 ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-200/80 px-1 py-0.5 rounded inline-flex items-center gap-0.5 ml-0.5">
                          <Sun className="w-2.5 h-2.5 text-amber-600" /> Mañana
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100/80 border border-indigo-200/80 px-1 py-0.5 rounded inline-flex items-center gap-0.5 ml-0.5">
                          <Moon className="w-2.5 h-2.5 text-indigo-600" /> Tarde
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-1 text-[11px] text-slate-500">
                    {appointment.type === 'presencial' ? (
                      <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                        <Building className="w-3 h-3" /> Presencial en Consultorio
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
                        <Video className="w-3 h-3" /> Teleconsulta Online
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* If cancelled: Show prominent reason card and irreversible warning */}
              {isCancelled && (
                <div className="p-3.5 bg-rose-50/90 rounded-2xl border-2 border-rose-200 text-xs text-rose-950 space-y-2.5 animate-in fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-rose-200/80 pb-2">
                    <div className="flex items-center gap-1.5 text-rose-800 font-black uppercase text-[11px] tracking-wide">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Cita Médica Cancelada — Estado Irreversible</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-rose-900 font-semibold">
                      <span>
                        Cancelada por:{' '}
                        <strong className="text-slate-900 font-black">
                          {appointment.cancelledBy === 'paciente' ? '👤 El Paciente' : '🏥 La Clínica / Recepción'}
                        </strong>
                      </span>
                      {appointment.cancelledAt && (
                        <span className="text-slate-500 font-medium text-[10px]">
                          • {new Date(appointment.cancelledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Motivo de Cancelación */}
                  <div className="bg-white p-3 rounded-xl border border-rose-200 space-y-1">
                    <span className="text-[10px] uppercase font-black text-rose-800 tracking-wider block">
                      Motivo registrado de cancelación:
                    </span>
                    <p className="font-bold text-slate-900 text-xs sm:text-sm italic bg-rose-50/40 p-2.5 rounded-lg border border-rose-100">
                      "{appointment.cancellationReason || 'Cancelada sin motivo específico especificado'}"
                    </p>
                  </div>

                  {/* Irreversible System Warning Notice */}
                  <div className="flex items-start gap-2 text-[11px] text-rose-900 font-medium bg-rose-100/70 p-2.5 rounded-xl border border-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Atención médica:</strong> Esta cita ha quedado anulada de manera <strong>permanente e irreversible</strong>. No se puede reactivar ni marcar como confirmada o atendida. Si el paciente desea volver a agendar, <strong>debe realizar una nueva cita médica</strong>.
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              {isCancelled ? (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Cita Anulada (Irreversible)</span>
                    </span>

                    <button
                      id={`btn-contact-cancelled-${appointment.id}`}
                      onClick={() => handleContactCancelledPatientWhatsApp(appointment)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Enviar notificación de cancelación por WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Notificar por WhatsApp</span>
                    </button>

                    <button
                      id={`btn-delete-cancelled-${appointment.id}`}
                      onClick={() => deleteAppointment(appointment.id)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Eliminar definitivamente este registro cancelado de la base de datos"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Borrar registro</span>
                    </button>
                  </div>

                  <button
                    id={`btn-new-appointment-from-${appointment.id}`}
                    onClick={() =>
                      onOpenNewAppointmentModal({
                        patientName: appointment.patientName,
                        patientPhone: appointment.patientPhone,
                        patientDni: appointment.patientDni,
                        patientEmail: appointment.patientEmail,
                        specialtyId: appointment.specialtyId,
                        doctorId: appointment.doctorId,
                        reason: appointment.reason,
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agendar Nueva Cita para este Paciente</span>
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {/* Contact patient via WhatsApp */}
                  <button
                    id={`btn-contact-patient-${appointment.id}`}
                    onClick={() => handleContactPatientWhatsApp(appointment)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-blue-600 fill-blue-600/20" />
                    <span>Confirmar por WhatsApp con Paciente</span>
                  </button>

                  {/* State toggles */}
                  <div className="flex items-center gap-1.5">
                    {!isConfirmed && (
                      <button
                        id={`btn-status-confirm-${appointment.id}`}
                        onClick={() => updateAppointmentStatus(appointment.id, 'confirmada')}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                        title="Confirmar cita"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmar</span>
                      </button>
                    )}

                    {!isAttended ? (
                      <button
                        id={`btn-status-attended-${appointment.id}`}
                        onClick={() => updateAppointmentStatus(appointment.id, 'atendida')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                        title="Marcar como atendida"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Atendida</span>
                      </button>
                    ) : (
                      <button
                        id={`btn-delete-attended-${appointment.id}`}
                        onClick={() => deleteAppointment(appointment.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Eliminar este registro ya atendido de la base de datos"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Borrar registro</span>
                      </button>
                    )}

                    <button
                      id={`btn-status-cancel-${appointment.id}`}
                      onClick={() => {
                        setCancellingAppointment(appointment);
                        setAdminCancelReason('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Cancelar cita"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {appointments.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
              <Calendar className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">
                No hay citas registradas en el sistema
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                El sistema está completamente limpio para empezar a registrar. Las citas reservadas por los pacientes desde la web o agregadas en recepción aparecerán aquí en tiempo real.
              </p>
            </div>
            <div>
              <button
                onClick={() => onOpenNewAppointmentModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primera Cita</span>
              </button>
            </div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
            <AlertCircle className="w-9 h-9 text-slate-300 mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                No se encontraron citas con estos criterios
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                No hay citas registradas que coincidan con la combinación de médico, especialidad, fecha, turno horario o término de búsqueda.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                id="btn-empty-reset-filters"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restablecer todos los filtros</span>
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Admin Cancellation Confirmation Modal */}
      {cancellingAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ¿Confirmar cancelación irreversible de la cita?
                </h3>
                <p className="text-xs text-slate-500">
                  Cita <span className="font-mono font-bold text-slate-700">#{cancellingAppointment.id}</span>
                </p>
              </div>
            </div>

            {/* Appointment Details snapshot */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-900 text-sm">{cancellingAppointment.patientName}</span>
                <span className="text-slate-500 font-semibold">{cancellingAppointment.patientPhone}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                <span className="text-blue-900 font-bold">{cancellingAppointment.doctorName}</span>
                <span>•</span>
                <span>{cancellingAppointment.specialtyName}</span>
                <span>•</span>
                <span className="capitalize">{formatDatePretty(cancellingAppointment.date)} a las {formatTimePretty(cancellingAppointment.time)}</span>
              </div>
            </div>

            {/* Irreversible Warning Box */}
            <div className="p-3.5 bg-rose-50 rounded-2xl border-2 border-rose-300 text-xs text-rose-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-rose-800 text-[11px] uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Advertencia Importante — Acción Irreversible</span>
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed font-medium">
                Al confirmar, esta cita quedará <strong>cancelada definitivamente</strong>. No podrá volverse a confirmar ni marcarse como atendida. El horario de consultorio quedará liberado. Si el paciente o la clínica desean retomar el turno, <strong>se deberá agendar una nueva cita médica</strong>.
              </p>
            </div>

            {/* Motivo de Cancelación con chips predeterminados */}
            <div className="space-y-2">
              <label htmlFor="admin-cancel-reason" className="block text-xs font-bold text-slate-800">
                Indica el motivo de la cancelación:
              </label>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Médico indispuesto / Fuera de servicio',
                  'Cancelación solicitada por el paciente',
                  'Paciente inasistente a consulta',
                  'Reprogramación requerida',
                  'Error de datos / Cita duplicada',
                ].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setAdminCancelReason(chip)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
                      adminCancelReason === chip
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <textarea
                id="admin-cancel-reason"
                rows={2}
                value={adminCancelReason}
                onChange={e => setAdminCancelReason(e.target.value)}
                placeholder="Escribe o selecciona arriba el motivo detallado de la cancelación..."
                className="w-full px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-medium text-slate-800 resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setCancellingAppointment(null);
                  setAdminCancelReason('');
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors text-center"
              >
                No cancelar, mantener turno
              </button>
              <button
                type="button"
                onClick={handleConfirmAdminCancel}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Confirmar Cancelación Irreversible</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Purge Attended & Cancelled Appointments by Period Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    Limpiar Citas Atendidas y Canceladas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Elimina de la base de datos las citas antiguas{' '}
                    <strong className="text-emerald-700">Ya Atendidas</strong> y/o{' '}
                    <strong className="text-rose-700">Canceladas</strong> del período que elijas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Safe Guarantee Notice */}
            <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Limpieza segura y selectiva:</strong> Tus citas activas (pendientes por confirmar y confirmadas), médicos y especialidades <strong>no se tocarán</strong>. Solo se borrarán las citas finalizadas (atendidas y/o canceladas) del período seleccionado.
              </span>
            </div>

            {/* Step 1: Status Target Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                1. ¿Qué tipo de citas finalizadas deseas limpiar?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'both',
                    label: 'Ambas',
                    sub: 'Atendidas y Canceladas',
                  },
                  {
                    id: 'atendida',
                    label: 'Solo Atendidas',
                    sub: 'Consultas ya realizadas',
                  },
                  {
                    id: 'cancelada',
                    label: 'Solo Canceladas',
                    sub: 'Turnos anulados',
                  },
                ].map(target => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setPurgeStatusTarget(target.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      purgeStatusTarget === target.id
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center justify-between">
                      <span>{target.label}</span>
                      {purgeStatusTarget === target.id && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        purgeStatusTarget === target.id ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {target.sub}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Period Selection Options */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                2. Selecciona el período de antigüedad a limpiar:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: 'past',
                    title: 'Anteriores a hoy',
                    desc: 'Citas de fechas pasadas (hasta ayer)',
                  },
                  {
                    id: 'older_7',
                    title: 'Más de 7 días',
                    desc: 'Con más de 1 semana de antigüedad',
                  },
                  {
                    id: 'older_15',
                    title: 'Más de 15 días',
                    desc: 'Con más de 2 semanas de antigüedad',
                  },
                  {
                    id: 'older_30',
                    title: 'Más de 30 días (1 mes)',
                    desc: 'Con más de un mes de antigüedad',
                  },
                  {
                    id: 'older_90',
                    title: 'Más de 90 días (3 meses)',
                    desc: 'Historial antiguo de más de 3 meses',
                  },
                  {
                    id: 'custom_range',
                    title: 'Rango de fechas específico',
                    desc: 'Elegir desde / hasta qué fecha borrar',
                  },
                  {
                    id: 'all_cancelled',
                    title: 'Todas las del estado elegido',
                    desc: 'Sin importar la fecha registrada',
                  },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPurgePeriod(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      opt.id === 'all_cancelled' ? 'sm:col-span-2' : ''
                    } ${
                      purgePeriod === opt.id
                        ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 text-rose-950'
                        : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="text-xs font-extrabold flex items-center justify-between">
                      <span>{opt.title}</span>
                      {purgePeriod === opt.id && (
                        <span className="w-2 h-2 rounded-full bg-rose-600" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Pickers if custom_range is selected */}
            {purgePeriod === 'custom_range' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Desde la fecha (opcional):
                  </label>
                  <input
                    type="date"
                    value={purgeFromDate}
                    onChange={e => setPurgeFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Hasta la fecha (inclusive):
                  </label>
                  <input
                    type="date"
                    value={purgeToDate}
                    onChange={e => setPurgeToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            )}

            {/* Live Preview of matching appointments */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-bold text-slate-700">
                  Citas encontradas para limpiar:
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      matchingCancelledToPurge.length > 0
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {matchingCancelledToPurge.length}{' '}
                    {matchingCancelledToPurge.length === 1 ? 'cita' : 'citas'}
                  </span>
                </div>
              </div>

              {matchingCancelledToPurge.length > 0 ? (
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 pt-1">
                  {matchingCancelledToPurge.map(app => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between gap-2 text-[11px] bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80"
                    >
                      <div className="truncate flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                            app.status === 'atendida'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {app.status === 'atendida' ? 'Atendida' : 'Cancelada'}
                        </span>
                        <span className="font-mono font-bold text-slate-500">
                          #{app.id}
                        </span>
                        <span className="font-bold text-slate-800 truncate">{app.patientName}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 truncate">{app.doctorName}</span>
                      </div>
                      <span className="font-semibold text-slate-700 shrink-0">
                        {app.date}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  No hay citas que coincidan con el estado y período seleccionados.
                </p>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors text-center"
              >
                Cerrar
              </button>
              <button
                type="button"
                id="btn-confirm-purge-cancelled"
                disabled={matchingCancelledToPurge.length === 0 || isPurging}
                onClick={handleConfirmPurgeCancelled}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:text-slate-500 text-white shadow-md shadow-rose-600/20 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {isPurging
                    ? 'Eliminando de la Base de Datos...'
                    : `Eliminar ${matchingCancelledToPurge.length} ${
                        matchingCancelledToPurge.length === 1 ? 'Cita' : 'Citas'
                      }`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
