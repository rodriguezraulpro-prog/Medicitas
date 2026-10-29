import React, { useState, useMemo } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Appointment } from '../../types';
import {
  Search,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageCircle,
  CalendarDays,
  Building,
  Video,
  ArrowRight,
  Sun,
  Moon,
  Info,
  Edit3,
} from 'lucide-react';
import {
  formatDatePretty,
  formatTimePretty,
  generateRescheduleWhatsAppMessage,
  generateCancelWhatsAppMessage,
  buildWhatsAppUrl,
} from '../../utils/whatsapp';

interface PatientAppointmentLookupProps {
  onBackToBooking?: () => void;
  defaultDni?: string;
}

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const monthNames = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const PatientAppointmentLookup: React.FC<PatientAppointmentLookupProps> = ({
  onBackToBooking,
  defaultDni = '',
}) => {
  const {
    appointments,
    doctors,
    clinicConfig,
    updateAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    getAvailableSlotsForDoctor,
  } = useClinic();

  const [searchDni, setSearchDni] = useState<string>(defaultDni);
  const [searchedTerm, setSearchedTerm] = useState<string>(defaultDni ? defaultDni.trim() : '');
  const [hasSearched, setHasSearched] = useState<boolean>(Boolean(defaultDni));

  // Rescheduling state
  const [reschedulingApp, setReschedulingApp] = useState<Appointment | null>(null);
  const [newSelectedDate, setNewSelectedDate] = useState<string>('');
  const [newSelectedTime, setNewSelectedTime] = useState<string>('');
  const [rescheduleSuccessInfo, setRescheduleSuccessInfo] = useState<{
    appointment: Appointment;
    oldDate: string;
    oldTime: string;
  } | null>(null);

  // Cancellation state
  const [cancellingApp, setCancellingApp] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelSuccessInfo, setCancelSuccessInfo] = useState<{
    appointment: Appointment;
    reason?: string;
  } | null>(null);

  // Normalize string for robust matching (e.g. V-10.987.654 or 10987654)
  const cleanDoc = (val?: string) => (val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Calculate local "today" date string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // Filter ONLY active appointments:
  // 1. DNI matches
  // 2. Status is 'pendiente_whatsapp' OR 'confirmada' (NEVER 'cancelada' or 'atendida')
  // 3. Date is today or future (within valid prior range, NEVER past dates)
  const activeAppointments = useMemo(() => {
    if (!hasSearched || !searchedTerm.trim()) return [];

    const queryClean = cleanDoc(searchedTerm);
    if (!queryClean) return [];

    return appointments.filter(app => {
      // DNI match (or phone / ID fallback if match)
      const dniMatch = app.patientDni && cleanDoc(app.patientDni) === queryClean;
      const phoneMatch = cleanDoc(app.patientPhone).includes(queryClean);
      const idMatch = cleanDoc(app.id) === queryClean;

      const isOwner = dniMatch || phoneMatch || idMatch;
      if (!isOwner) return false;

      // Status must be active (pendiente o confirmada)
      const isActiveStatus =
        app.status === 'pendiente_whatsapp' || app.status === 'confirmada';
      if (!isActiveStatus) return false;

      // Date must be today or in the future
      const isCurrentOrFuture = app.date >= todayStr;
      if (!isCurrentOrFuture) return false;

      return true;
    });
  }, [appointments, hasSearched, searchedTerm, todayStr]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchDni.trim()) return;
    setSearchedTerm(searchDni.trim());
    setHasSearched(true);
    setRescheduleSuccessInfo(null);
    setCancelSuccessInfo(null);
  };

  // Find doctor for rescheduling
  const reschedulingDoctor = useMemo(() => {
    if (!reschedulingApp) return null;
    return doctors.find(d => d.id === reschedulingApp.doctorId) || null;
  }, [reschedulingApp, doctors]);

  // Generate 14 upcoming days for rescheduling
  const rescheduleUpcomingDays = useMemo(() => {
    if (!reschedulingDoctor) return [];
    const list: {
      dateStr: string;
      dayOfWeek: number;
      dayName: string;
      dayNumber: number;
      monthName: string;
      isAvailable: boolean;
    }[] = [];

    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayOfWeek = d.getDay();

      const isAvailable = reschedulingDoctor.availableDays.includes(dayOfWeek);

      list.push({
        dateStr,
        dayOfWeek,
        dayName: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dayNames[dayOfWeek],
        dayNumber: d.getDate(),
        monthName: monthNames[d.getMonth()],
        isAvailable,
      });
    }

    return list;
  }, [reschedulingDoctor]);

  // Available slots for doctor on newSelectedDate
  const rescheduleAvailableSlots = useMemo(() => {
    if (!reschedulingDoctor || !newSelectedDate || !reschedulingApp) return [];
    return getAvailableSlotsForDoctor(reschedulingDoctor.id, newSelectedDate, reschedulingApp.id);
  }, [reschedulingDoctor, newSelectedDate, reschedulingApp, getAvailableSlotsForDoctor]);

  const rescheduleMorningSlots = useMemo(() => {
    return rescheduleAvailableSlots.filter(t => parseInt(t.split(':')[0], 10) < 13);
  }, [rescheduleAvailableSlots]);

  const rescheduleAfternoonSlots = useMemo(() => {
    return rescheduleAvailableSlots.filter(t => parseInt(t.split(':')[0], 10) >= 13);
  }, [rescheduleAvailableSlots]);

  const startReschedule = (app: Appointment) => {
    setReschedulingApp(app);
    setNewSelectedDate(app.date >= todayStr ? app.date : todayStr);
    setNewSelectedTime(app.time);
  };

  const handleConfirmReschedule = () => {
    if (!reschedulingApp || !newSelectedDate || !newSelectedTime) return;

    const oldDate = reschedulingApp.date;
    const oldTime = reschedulingApp.time;

    // Update appointment in ClinicContext
    updateAppointment(reschedulingApp.id, {
      date: newSelectedDate,
      time: newSelectedTime,
    });

    const updatedApp: Appointment = {
      ...reschedulingApp,
      date: newSelectedDate,
      time: newSelectedTime,
    };

    setRescheduleSuccessInfo({
      appointment: updatedApp,
      oldDate,
      oldTime,
    });

    setReschedulingApp(null);
  };

  const handleConfirmCancel = () => {
    if (!cancellingApp) return;

    const reasonToSave = cancelReason.trim() || 'Cancelada a solicitud del paciente';

    // Call cancelAppointment in ClinicContext (persists status, cancellationReason, cancelledBy, cancelledAt)
    cancelAppointment(cancellingApp.id, reasonToSave, 'paciente');

    const cancelledAppCopy: Appointment = {
      ...cancellingApp,
      status: 'cancelada',
      cancellationReason: reasonToSave,
      cancelledBy: 'paciente',
      cancelledAt: new Date().toISOString(),
      notes: cancellingApp.notes
        ? `${cancellingApp.notes} | [Cancelada por paciente: ${reasonToSave}]`
        : `[Cancelada por paciente: ${reasonToSave}]`,
    };

    setCancelSuccessInfo({
      appointment: cancelledAppCopy,
      reason: reasonToSave,
    });

    setCancellingApp(null);
    setCancelReason('');
  };

  return (
    <div className="space-y-4">
      {/* Banner / Card Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-5 text-white shadow-lg shadow-blue-700/15 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
            <CalendarDays className="w-3.5 h-3.5 text-blue-200" />
            <span>Gestión y Consulta de Cita Médica</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            ¿Ya posees una cita médica agendada?
          </h2>

          <p className="text-xs sm:text-sm text-blue-100/95 max-w-xl">
            Ingresa tu <strong className="text-white">Número de Identidad o Cédula</strong> para consultar el estado de tu turno, reprogramar la fecha con horarios disponibles en tiempo real o cancelarla de forma inmediata.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-blue-200 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Solo citas activas y vigentes
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              Reprogramación con disponibilidad real
            </span>
          </div>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-xs">
        <form onSubmit={handleSearch} className="space-y-3">
          <label htmlFor="search-patient-dni" className="block text-xs sm:text-sm font-bold text-slate-800">
            Ingresa tu Cédula / DNI / Documento de Identidad:
          </label>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="search-patient-dni"
                type="text"
                value={searchDni}
                onChange={e => setSearchDni(e.target.value)}
                placeholder="Ej. 10987654, 24567890, 31245678..."
                className="w-full pl-10 pr-3 py-2.5 sm:py-3 bg-slate-50 hover:bg-white focus:bg-white rounded-2xl border border-slate-300 text-xs sm:text-sm text-slate-900 font-medium placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Buscar Cita</span>
            </button>
          </div>
        </form>
      </div>

      {/* Success Banner: Rescheduled */}
      {rescheduleSuccessInfo && (
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs sm:text-sm">
                ¡Cita médica reprogramada exitosamente!
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Tu cita con <strong className="font-bold">{rescheduleSuccessInfo.appointment.doctorName}</strong> ({rescheduleSuccessInfo.appointment.specialtyName}) ha sido actualizada para el{' '}
                <strong className="font-bold">{formatDatePretty(rescheduleSuccessInfo.appointment.date)}</strong> a las{' '}
                <strong className="font-bold">{formatTimePretty(rescheduleSuccessInfo.appointment.time)}</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/60">
            <a
              href={buildWhatsAppUrl(
                `${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`,
                generateRescheduleWhatsAppMessage(
                  rescheduleSuccessInfo.appointment,
                  clinicConfig,
                  rescheduleSuccessInfo.oldDate,
                  rescheduleSuccessInfo.oldTime
                )
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Notificar reprogramación a la clínica por WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => setRescheduleSuccessInfo(null)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-300 cursor-pointer transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Success Banner: Cancelled */}
      {cancelSuccessInfo && (
        <div className="p-4 sm:p-5 bg-rose-50 rounded-2xl border-2 border-rose-200 text-rose-900 space-y-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-sm text-rose-950">
                  Cita #{cancelSuccessInfo.appointment.id} cancelada exitosamente
                </h4>
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                  Irreversible
                </span>
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                El horario ha sido liberado en el consultorio. Por seguridad médica y reglas del sistema, <strong>esta cancelación es irreversible</strong> y no puede reactivarse. Si deseas atenderte con este u otro especialista, debes <strong>agendar una nueva cita</strong>.
              </p>
              {cancelSuccessInfo.reason && (
                <p className="text-xs text-rose-900 bg-rose-100/70 px-2.5 py-1.5 rounded-xl border border-rose-200/60 font-medium">
                  <strong>Motivo registrado:</strong> "{cancelSuccessInfo.reason}"
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200/80">
            {onBackToBooking && (
              <button
                type="button"
                onClick={onBackToBooking}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Agendar Nueva Cita Médica</span>
              </button>
            )}
            <a
              href={buildWhatsAppUrl(
                `${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`,
                generateCancelWhatsAppMessage(
                  cancelSuccessInfo.appointment,
                  clinicConfig,
                  cancelSuccessInfo.reason
                )
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Enviar aviso a la clínica por WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => setCancelSuccessInfo(null)}
              className="px-3 py-2 rounded-xl bg-white hover:bg-rose-100 text-rose-800 text-xs font-semibold border border-rose-300 cursor-pointer transition-colors"
            >
              Cerrar aviso
            </button>
          </div>
        </div>
      )}

      {/* Results Area */}
      {hasSearched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarCheckIcon className="w-4 h-4 text-blue-600" />
              <span>
                Citas activas encontradas ({activeAppointments.length}):
              </span>
            </h3>
            {activeAppointments.length > 0 && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Turnos vigentes
              </span>
            )}
          </div>

          {activeAppointments.length === 0 ? (
            /* Strict empty state: explains why cancelled/past/attended are omitted */
            <div className="bg-white rounded-3xl p-6 sm:p-8 text-center border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                  No se encontraron citas activas para la cédula: &quot;{searchedTerm}&quot;
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Solo se muestran citas en estado <strong className="text-slate-700">Pendiente por confirmar</strong> o <strong className="text-slate-700">Confirmadas</strong> con fecha vigente (de hoy en adelante).
                </p>
                <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 max-w-md mx-auto text-left mt-2 border border-slate-200 space-y-1">
                  <p className="font-semibold text-slate-700">• Si tu cita ya fue atendida por el médico, ha finalizado su ciclo.</p>
                  <p className="font-semibold text-slate-700">• Si la cita ya pasó de fecha o fue cancelada, se excluye automáticamente de esta vista.</p>
                  <p className="font-semibold text-slate-700">• Si agendaste recientemente sin ingresar tu cédula, comunícate con recepción.</p>
                </div>
              </div>

              {onBackToBooking && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onBackToBooking}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>Agendar una nueva cita médica</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Active Appointments List */
            <div className="space-y-3">
              {activeAppointments.map(app => {
                const hourNum = parseInt(app.time.split(':')[0], 10);
                const isMorning = hourNum < 13;

                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:border-blue-200 transition-all space-y-4"
                  >
                    {/* Header Row: ID, Status, Consultation Type */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                          #{app.id}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {app.type === 'presencial' ? (
                            <span className="inline-flex items-center gap-1 text-slate-700">
                              <Building className="w-3.5 h-3.5 text-blue-600" />
                              Presencial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                              <Video className="w-3.5 h-3.5 text-indigo-600" />
                              Teleconsulta
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {app.status === 'confirmada' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Confirmada en Agenda</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pendiente por confirmar</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Body: Doctor & Specialty, Date & Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Doctor Info */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Médico y Especialidad
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                          {app.doctorName}
                        </h4>
                        <p className="text-xs font-semibold text-blue-700">
                          {app.specialtyName}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 pt-0.5">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{app.consultorio}</span>
                        </p>
                      </div>

                      {/* Scheduled Date & Time with Shift Indicator */}
                      <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Fecha y Turno Programado
                        </span>
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
                          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="capitalize">{formatDatePretty(app.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{formatTimePretty(app.time)}</span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isMorning
                                ? 'bg-amber-100/80 text-amber-800 border border-amber-200'
                                : 'bg-indigo-100/80 text-indigo-800 border border-indigo-200'
                            }`}
                          >
                            {isMorning ? (
                              <>
                                <Sun className="w-3 h-3 text-amber-600" />
                                <span>Turno Mañana</span>
                              </>
                            ) : (
                              <>
                                <Moon className="w-3 h-3 text-indigo-600" />
                                <span>Turno Tarde</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Patient & Reason Info */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          Paciente: {app.patientName}
                        </span>
                        {app.patientDni && (
                          <span className="font-mono text-slate-600 text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                            Cédula / DNI: {app.patientDni}
                          </span>
                        )}
                      </div>
                      {app.reason && (
                        <p className="text-[11px] text-slate-500 italic">
                          Motivo: &quot;{app.reason}&quot;
                        </p>
                      )}
                    </div>

                    {/* Action Buttons: Modificar Fecha, Cancelar, WhatsApp */}
                    <div className="pt-2 flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Modificar Fecha y Hora */}
                        <button
                          type="button"
                          onClick={() => startReschedule(app)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modificar Fecha / Hora</span>
                        </button>

                        {/* Cancelar Cita */}
                        <button
                          type="button"
                          onClick={() => setCancellingApp(app)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 hover:border-rose-300 cursor-pointer transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Cancelar Cita</span>
                        </button>
                      </div>

                      {/* WhatsApp Direct */}
                      <a
                        href={buildWhatsAppUrl(
                          `${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`,
                          `Hola ${clinicConfig.name}, tengo una consulta sobre mi cita médica #${app.id} (${app.specialtyName} con ${app.doctorName}) agendada para el ${formatDatePretty(app.date)} a las ${formatTimePretty(app.time)}. Paciente: ${app.patientName}, Cédula: ${app.patientDni || 'N/A'}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Consultar por WhatsApp</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reschedule Modal / Dialog */}
      {reschedulingApp && reschedulingDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl p-4 sm:p-6 space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <CalendarDays className="w-3 h-3" />
                  <span>Reprogramar Cita #{reschedulingApp.id}</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Elige una nueva fecha y horario disponible
                </h3>
                <p className="text-xs text-slate-500">
                  Médico: <strong className="text-slate-800">{reschedulingDoctor.name}</strong> • {reschedulingApp.specialtyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingApp(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Current Schedule summary */}
            <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] font-bold uppercase text-amber-700">
                  Horario actual programado:
                </span>
                <span className="font-bold">
                  {formatDatePretty(reschedulingApp.date)} a las {formatTimePretty(reschedulingApp.time)}
                </span>
              </div>
              <span className="text-[10px] bg-white px-2 py-0.5 rounded font-bold border border-amber-200 text-amber-800">
                Se liberará este horario
              </span>
            </div>

            {/* Step 1: Select New Date */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                1. Selecciona la nueva fecha:
              </label>

              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {rescheduleUpcomingDays.map(item => {
                  const isSelected = newSelectedDate === item.dateStr;
                  const isAvailable = item.isAvailable;

                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        setNewSelectedDate(item.dateStr);
                        setNewSelectedTime('');
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-2xl min-w-[62px] border text-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 ring-2 ring-blue-500/30'
                          : isAvailable
                          ? 'bg-white hover:bg-blue-50/50 border-slate-200 text-slate-800 cursor-pointer'
                          : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <span className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.dayName}
                      </span>
                      <span className="text-base font-black my-0.5">
                        {item.dayNumber}
                      </span>
                      <span className={`text-[9px] font-medium ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {item.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select New Time */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <label className="block text-xs font-bold text-slate-800">
                    2. Horarios disponibles en tiempo real:
                  </label>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Turnos de {reschedulingDoctor?.slotDurationMinutes || 30} min
                  </span>
                </div>
                {newSelectedDate && (
                  <span className="text-[11px] font-semibold text-slate-500 capitalize">
                    {formatDatePretty(newSelectedDate)}
                  </span>
                )}
              </div>

              {rescheduleAvailableSlots.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-600">
                    No hay turnos disponibles para esta fecha.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Por favor selecciona otro día en el calendario arriba.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Morning Slots */}
                  {rescheduleMorningSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>Turno Mañana (8:00 - 13:00)</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {rescheduleMorningSlots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setNewSelectedTime(slot)}
                            className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              newSelectedTime === slot
                                ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/30'
                                : 'bg-white hover:bg-amber-50/50 border-slate-200 text-slate-800'
                            }`}
                          >
                            {formatTimePretty(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Afternoon Slots */}
                  {rescheduleAfternoonSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <Moon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Turno Tarde (13:00 - 19:00)</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {rescheduleAfternoonSlots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setNewSelectedTime(slot)}
                            className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              newSelectedTime === slot
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/30'
                                : 'bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-800'
                            }`}
                          >
                            {formatTimePretty(slot)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReschedulingApp(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Descartar
              </button>
              <button
                type="button"
                disabled={!newSelectedDate || !newSelectedTime}
                onClick={handleConfirmReschedule}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                Confirmar Reprogramación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal / Dialog */}
      {cancellingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-900">
                  ¿Confirmas la cancelación de tu cita?
                </h3>
                <p className="text-xs text-slate-500">
                  Cita #{cancellingApp.id} con {cancellingApp.doctorName}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span className="capitalize">{formatDatePretty(cancellingApp.date)}</span>
                <span>•</span>
                <span>{formatTimePretty(cancellingApp.time)}</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Paciente: <strong className="text-slate-900">{cancellingApp.patientName}</strong> (Cédula: {cancellingApp.patientDni || 'N/A'})
              </p>
            </div>

            {/* Irreversible Warning Box */}
            <div className="p-3.5 bg-rose-50/90 rounded-2xl border-2 border-rose-300 text-xs text-rose-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-rose-800 text-[11px] uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Advertencia: Cancelación Irreversible</span>
              </div>
              <p className="text-[11px] text-rose-900 leading-relaxed font-medium">
                Esta acción es <strong>definitiva e irreversible</strong>. Una vez confirmada, la cita quedará anulada y el turno liberado de inmediato en el consultorio. <strong>No podrá reactivarse</strong>. Si requieres atención en esta u otra fecha, deberás agendar una nueva cita médica.
              </p>
            </div>

            {/* Cancellation reason with quick chips */}
            <div className="space-y-2">
              <label htmlFor="cancel-reason" className="block text-xs font-bold text-slate-800">
                Indica el motivo de cancelación:
              </label>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Imprevisto personal / laboral',
                  'Horario no conveniente',
                  'Mejoría en síntomas',
                  'Atendido en otro centro',
                  'Reprogramaré después',
                ].map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setCancelReason(chip)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
                      cancelReason === chip
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <input
                id="cancel-reason"
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Escribe o selecciona un motivo arriba..."
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-medium text-slate-800"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCancellingApp(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors text-center"
              >
                No cancelar, mantener turno
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Confirmar Cancelación Irreversible</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function CalendarCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}
