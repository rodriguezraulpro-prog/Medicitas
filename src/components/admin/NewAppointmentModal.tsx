import React, { useState, useMemo } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { ConsultationType, Doctor, Specialty } from '../../types';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Stethoscope,
  Building,
  Video,
  Search,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  DollarSign,
  Star,
  MapPin,
  CalendarCheck,
  Send,
  AlertCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { SpecialtyIcon } from '../common/SpecialtyIcon';
import {
  formatDatePretty,
  formatTimePretty,
  generateClinicConfirmationMessage,
  buildWhatsAppUrl,
} from '../../utils/whatsapp';

interface NewAppointmentModalProps {
  onClose: () => void;
  initialData?: {
    patientName?: string;
    patientDni?: string;
    patientPhone?: string;
    patientEmail?: string;
    specialtyId?: string;
    doctorId?: string;
    reason?: string;
  };
}

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const monthNames = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const NewAppointmentModal: React.FC<NewAppointmentModalProps> = ({ onClose, initialData }) => {
  const {
    doctors,
    specialties,
    addAppointment,
    updateAppointmentStatus,
    clinicConfig,
    getAvailableSlotsForDoctor,
  } = useClinic();

  const activeSpecialties = useMemo(() => specialties.filter(s => s.active), [specialties]);
  const activeDoctors = useMemo(() => doctors.filter(d => d.active), [doctors]);

  // Current wizard step: 1 = Especialidad, 2 = Doctor, 3 = Fecha y Hora, 4 = Datos del Paciente (con DNI)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(
    initialData?.doctorId ? 3 : initialData?.specialtyId ? 2 : 1
  );

  // Selections
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>(
    initialData?.specialtyId || activeSpecialties[0]?.id || ''
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    initialData?.doctorId || ''
  );
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Patient Info (as in patient page)
  const [patientName, setPatientName] = useState(initialData?.patientName || '');
  const [patientDni, setPatientDni] = useState(initialData?.patientDni || '');
  const [patientPhone, setPatientPhone] = useState(initialData?.patientPhone || '');
  const [patientEmail, setPatientEmail] = useState(initialData?.patientEmail || '');
  const [type, setType] = useState<ConsultationType>('presencial');
  const [reason, setReason] = useState(initialData?.reason || '');
  const [notes, setNotes] = useState('');
  const [sendWhatsAppDirect, setSendWhatsAppDirect] = useState(true);
  const [markAsConfirmed, setMarkAsConfirmed] = useState(true);
  const [formError, setFormError] = useState('');

  // Search filter for specialties
  const [specialtySearch, setSpecialtySearch] = useState('');

  const selectedSpecialty = activeSpecialties.find(s => s.id === selectedSpecialtyId) || activeSpecialties[0];

  // Doctors belonging to the selected specialty
  const doctorsForSpecialty = useMemo(() => {
    if (!selectedSpecialty) return [];
    return activeDoctors.filter(d => d.specialtyId === selectedSpecialty.id);
  }, [activeDoctors, selectedSpecialty]);

  const selectedDoctor =
    doctorsForSpecialty.find(d => d.id === selectedDoctorId) ||
    doctorsForSpecialty[0] ||
    activeDoctors[0];

  // Upcoming 14 calendar days starting from today for the selected doctor
  const upcomingDays = useMemo(() => {
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

      const isAvailable = selectedDoctor
        ? selectedDoctor.availableDays.includes(dayOfWeek)
        : true;

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
  }, [selectedDoctor]);

  // Fetch real-time available time slots for the chosen doctor and date
  const availableSlots = useMemo(() => {
    if (!selectedDoctor || !selectedDate) return [];
    return getAvailableSlotsForDoctor(selectedDoctor.id, selectedDate);
  }, [selectedDoctor, selectedDate, getAvailableSlotsForDoctor]);

  // Morning and Afternoon slots
  const morningSlots = useMemo(() => {
    return availableSlots.filter(t => {
      const h = parseInt(t.split(':')[0], 10);
      return h < 13;
    });
  }, [availableSlots]);

  const afternoonSlots = useMemo(() => {
    return availableSlots.filter(t => {
      const h = parseInt(t.split(':')[0], 10);
      return h >= 13;
    });
  }, [availableSlots]);

  // Handle specialty change
  const handleSelectSpecialty = (spec: Specialty) => {
    setSelectedSpecialtyId(spec.id);
    const docs = activeDoctors.filter(d => d.specialtyId === spec.id);
    if (docs.length > 0) {
      setSelectedDoctorId(docs[0].id);
    } else {
      setSelectedDoctorId('');
    }
    setCurrentStep(2);
  };

  // Handle doctor change
  const handleSelectDoctor = (doc: Doctor) => {
    setSelectedDoctorId(doc.id);
    // Find next available date
    const firstAvail = upcomingDays.find(d => doc.availableDays.includes(d.dayOfWeek));
    if (firstAvail) {
      setSelectedDate(firstAvail.dateStr);
    }
    setSelectedTime('');
    setCurrentStep(3);
  };

  // Handle date and time change
  const handleConfirmDateTime = () => {
    if (!selectedDate) {
      setFormError('Por favor selecciona una fecha.');
      return;
    }
    if (!selectedTime) {
      setFormError('Por favor selecciona un horario para la cita.');
      return;
    }
    setFormError('');
    setCurrentStep(4);
  };

  // Handle final submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!patientName.trim()) {
      setFormError('Por favor ingresa el nombre y apellido del paciente.');
      return;
    }

    if (!patientDni.trim()) {
      setFormError('Por favor ingresa el DNI o Documento de Identidad del paciente.');
      return;
    }

    if (!patientPhone.trim() || patientPhone.trim().length < 8) {
      setFormError('Por favor ingresa un número de teléfono o WhatsApp válido.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Por favor indica el motivo de la consulta o diagnóstico preliminar.');
      return;
    }

    if (!selectedDoctor || !selectedSpecialty) {
      setFormError('Falta seleccionar médico o especialidad.');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setFormError('Falta seleccionar fecha y hora de la cita.');
      return;
    }

    // Create the appointment
    const newApp = addAppointment({
      patientName: patientName.trim(),
      patientDni: patientDni.trim(),
      patientPhone: patientPhone.trim(),
      patientEmail: patientEmail.trim() || undefined,
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      specialtyId: selectedSpecialty.id,
      specialtyName: selectedSpecialty.name,
      date: selectedDate,
      time: selectedTime,
      type,
      fee: selectedDoctor.fee,
      consultorio: selectedDoctor.consultorio,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    });

    // If marked as confirmed directly at the front desk
    if (markAsConfirmed) {
      updateAppointmentStatus(newApp.id, 'confirmada');
      newApp.status = 'confirmada';
    }

    // Open WhatsApp to send confirmation if enabled
    if (sendWhatsAppDirect) {
      try {
        const msg = generateClinicConfirmationMessage(newApp, clinicConfig);
        const url = buildWhatsAppUrl(patientPhone.trim(), msg);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Could not open WhatsApp window', err);
      }
    }

    onClose();
  };

  const filteredSpecialties = activeSpecialties.filter(
    s =>
      s.name.toLowerCase().includes(specialtySearch.toLowerCase()) ||
      s.description.toLowerCase().includes(specialtySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white max-w-2xl sm:max-w-3xl w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <CalendarCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">
                  Nueva Cita Presencial en Recepción
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Mostrador
                </span>
              </div>
              <p className="text-xs text-blue-100/80">
                Registro clínico completo: especialización, doctor, fecha, hora y DNI del paciente
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator Bar (tal cual el flujo del paciente) */}
        <div className="bg-slate-50 border-b border-slate-200 p-2.5 sm:px-6 shrink-0">
          <div className="flex items-center justify-between gap-1 text-center">
            
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-colors cursor-pointer ${
                currentStep === 1
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : currentStep > 1
                  ? 'bg-blue-100/70 text-blue-800 hover:bg-blue-200/70 font-semibold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 1
                    ? 'bg-white text-blue-700'
                    : currentStep > 1
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                1
              </div>
              <span className="text-[11px] sm:text-xs truncate">1. Especialidad</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden sm:block" />

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => {
                if (selectedSpecialty) setCurrentStep(2);
              }}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-colors cursor-pointer ${
                currentStep === 2
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : currentStep > 2
                  ? 'bg-blue-100/70 text-blue-800 hover:bg-blue-200/70 font-semibold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 2
                    ? 'bg-white text-blue-700'
                    : currentStep > 2
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                2
              </div>
              <span className="text-[11px] sm:text-xs truncate">2. Doctor</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden sm:block" />

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => {
                if (selectedDoctor) setCurrentStep(3);
              }}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-colors cursor-pointer ${
                currentStep === 3
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : currentStep > 3
                  ? 'bg-blue-100/70 text-blue-800 hover:bg-blue-200/70 font-semibold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 3
                    ? 'bg-white text-blue-700'
                    : currentStep > 3
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                3
              </div>
              <span className="text-[11px] sm:text-xs truncate">3. Fecha & Hora</span>
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 hidden sm:block" />

            {/* Step 4 */}
            <button
              type="button"
              onClick={() => {
                if (selectedDate && selectedTime) setCurrentStep(4);
              }}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-colors cursor-pointer ${
                currentStep === 4
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 4
                    ? 'bg-white text-blue-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                4
              </div>
              <span className="text-[11px] sm:text-xs truncate">4. Datos & DNI</span>
            </button>

          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">

          {/* Global validation error banner */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{formError}</span>
            </div>
          )}

          {/* STEP 1: ESPECIALIDAD */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                    <span>Paso 1: Seleccionar Especialización Médica</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Elige el área clínica de atención para el paciente
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
                  {activeSpecialties.length} Especialidades disponibles
                </span>
              </div>

              {/* Specialty Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar especialidad (ej. Medicina General, Cardiología, Pediatría...)"
                  value={specialtySearch}
                  onChange={e => setSpecialtySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              {/* Specialties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {filteredSpecialties.map(spec => {
                  const docCount = activeDoctors.filter(d => d.specialtyId === spec.id).length;
                  const isSelected = selectedSpecialtyId === spec.id;

                  return (
                    <div
                      key={spec.id}
                      onClick={() => handleSelectSpecialty(spec)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/80 shadow-xs'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-700 group-hover:bg-blue-100'
                        }`}
                      >
                        <SpecialtyIcon name={spec.iconName} className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {spec.name}
                          </h5>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full shrink-0">
                            {docCount} {docCount === 1 ? 'médico' : 'médicos'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {spec.description}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400 self-center shrink-0" />
                    </div>
                  );
                })}
              </div>

              {activeSpecialties.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h5 className="text-sm font-bold text-slate-800">No hay especialidades registradas</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Antes de agendar citas, debes registrar al menos una especialidad médica y un doctor desde el panel de Médicos y Especialistas.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Entendido, ir a configurar
                  </button>
                </div>
              ) : filteredSpecialties.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  No se encontraron especialidades con ese término de búsqueda.
                </div>
              ) : null}
            </div>
          )}

          {/* STEP 2: DOCTOR */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Paso 2: Elegir Médico Especialista</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Especialistas disponibles para <strong>{selectedSpecialty?.name}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cambiar Especialidad</span>
                </button>
              </div>

              {/* Chosen Specialty Banner */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <SpecialtyIcon name={selectedSpecialty?.iconName || 'Stethoscope'} className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                    Especialidad Seleccionada:
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {selectedSpecialty?.name}
                  </span>
                </div>
              </div>

              {/* Doctors List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {doctorsForSpecialty.map(doc => {
                  const isSelected = selectedDoctor?.id === doc.id;
                  const dayNamesStr = doc.availableDays
                    .map(d => dayNames[d])
                    .join(', ');

                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoctor(doc)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {doc.photoUrl ? (
                          <img
                            src={doc.photoUrl}
                            alt={doc.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center border border-blue-200 shrink-0">
                            {doc.name.slice(0, 2).toUpperCase() || 'DR'}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                              {doc.name}
                            </h5>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {doc.rating}
                            </span>
                          </div>
                          <p className="text-xs text-blue-700 font-medium">
                            {doc.consultorio}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <CalendarIcon className="w-3 h-3 text-slate-400" />
                            <span>Atiende: {dayNamesStr} ({doc.startHour} - {doc.endHour})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 gap-1 shrink-0">
                        <span className="text-xs font-bold text-slate-900 bg-slate-100 sm:bg-transparent px-2 sm:px-0 py-1 sm:py-0 rounded-lg">
                          Tarifa: {clinicConfig.currencySymbol}{doc.fee}
                        </span>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-blue-700"
                        >
                          <span>Elegir Doctor</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {doctorsForSpecialty.length === 0 && (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                    No hay médicos asignados a esta especialidad actualmente.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: FECHA Y HORA */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-blue-600" />
                    <span>Paso 3: Elegir Fecha y Hora de la Cita</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Disponibilidad médica en tiempo real para <strong>{selectedDoctor?.name}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cambiar Doctor</span>
                </button>
              </div>

              {/* Doctor summary mini-banner */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {selectedDoctor?.photoUrl ? (
                    <img
                      src={selectedDoctor?.photoUrl}
                      alt={selectedDoctor?.name}
                      className="w-10 h-10 rounded-xl object-cover border border-blue-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
                      {selectedDoctor?.name ? selectedDoctor.name.slice(0, 2).toUpperCase() : 'DR'}
                    </div>
                  )}
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900">
                      {selectedDoctor?.name}
                    </h5>
                    <p className="text-xs text-blue-700 font-medium">
                      {selectedSpecialty?.name} • {selectedDoctor?.consultorio}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Consulta
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                    {clinicConfig.currencySymbol}{selectedDoctor?.fee}
                  </span>
                </div>
              </div>

              {/* 1. Date selector - Interactive Days Carousel */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>1. Selecciona el Día de Consulta:</span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">O fecha manual:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => {
                        setSelectedDate(e.target.value);
                        setSelectedTime('');
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Horizontal scroll container with upcoming days */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
                  {upcomingDays.map(item => {
                    const isSelected = selectedDate === item.dateStr;
                    const isDisabled = !item.isAvailable;

                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          setSelectedDate(item.dateStr);
                          setSelectedTime('');
                        }}
                        className={`flex flex-col items-center justify-center min-w-[64px] sm:min-w-[70px] py-2.5 px-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                          isDisabled
                            ? 'opacity-40 bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700 hover:bg-blue-50/40'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            isSelected ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {item.dayName}
                        </span>
                        <span className="text-base font-extrabold my-0.5">
                          {item.dayNumber}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${
                            isSelected ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {item.monthName}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedDate && (
                  <p className="text-xs text-slate-600 font-medium capitalize">
                    📅 Fecha elegida: <span className="text-blue-700 font-bold">{formatDatePretty(selectedDate)}</span>
                  </p>
                )}
              </div>

              {/* 2. Time slots */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>2. Horas Disponibles para este Día:</span>
                    </label>
                    <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Intervalos de {selectedDoctor?.slotDurationMinutes || 30} min
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Hora personalizada:</span>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={e => setSelectedTime(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {availableSlots.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-800">
                      No hay horarios automáticos disponibles para este día
                    </p>
                    <p className="text-[11px] text-slate-500">
                      El médico no atiende o todos los turnos están ocupados. Puedes escribir una hora manual arriba para una excepción médica en recepción.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Morning */}
                    {morningSlots.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Turno Mañana:
                        </span>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {morningSlots.map(timeStr => {
                            const isTimeSelected = selectedTime === timeStr;
                            return (
                              <button
                                key={timeStr}
                                type="button"
                                onClick={() => setSelectedTime(timeStr)}
                                className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                                  isTimeSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                {timeStr}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Afternoon */}
                    {afternoonSlots.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Turno Tarde:
                        </span>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {afternoonSlots.map(timeStr => {
                            const isTimeSelected = selectedTime === timeStr;
                            return (
                              <button
                                key={timeStr}
                                type="button"
                                onClick={() => setSelectedTime(timeStr)}
                                className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                                  isTimeSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                              >
                                {timeStr}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTime && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-emerald-900 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Horario fijado: <strong>{formatTimePretty(selectedTime)}</strong> ({formatDatePretty(selectedDate)})
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmDateTime}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>Siguiente: Datos y DNI</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: DATOS DEL PACIENTE CON DNI (TAL CUAL LA PÁGINA DEL PACIENTE) */}
          {currentStep === 4 && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Paso 4: Datos del Paciente e Identificación (DNI)</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Ingresa los datos del paciente para su expediente clínico y confirmación
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Modificar Fecha/Hora</span>
                </button>
              </div>

              {/* Complete Appointment Summary Card */}
              <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                  <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                    Resumen de la Cita Seleccionada
                  </span>
                  <span className="text-xs font-extrabold text-blue-800">
                    Tarifa: {clinicConfig.currencySymbol}{selectedDoctor?.fee}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Especialidad:</span>
                    <span className="font-bold text-slate-800">{selectedSpecialty?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Médico:</span>
                    <span className="font-bold text-slate-800">{selectedDoctor?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Fecha:</span>
                    <span className="font-bold text-slate-800 capitalize">{formatDatePretty(selectedDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Hora y Consultorio:</span>
                    <span className="font-bold text-slate-800">{formatTimePretty(selectedTime)} ({selectedDoctor?.consultorio})</span>
                  </div>
                </div>
              </div>

              {/* Modalidad Selection (Presencial en consultorio por defecto) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Modalidad de atención médica:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('presencial')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      type === 'presencial'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span>Presencial en Consultorio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('teleconsulta')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      type === 'teleconsulta'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Teleconsulta Online</span>
                  </button>
                </div>
              </div>

              {/* Patient Name and DNI Row (Highlighted exactly as requested) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Nombre y Apellido del Paciente <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Carlos Pérez"
                      value={patientName}
                      onChange={e => setPatientName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* DNI / Documento de Identidad (Destacado para expediente clínico) */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    DNI / Identificación del Paciente <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Ej. 45892301 o Cédula / CURP"
                      value={patientDni}
                      onChange={e => setPatientDni(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-blue-50/30 hover:bg-white focus:bg-white rounded-xl border border-blue-300 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Necesario para historial clínico del paciente y ficha en recepción
                  </span>
                </div>
              </div>

              {/* Phone & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Phone */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Teléfono Celular / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="Ej. +52 55 1234 5678"
                      value={patientPhone}
                      onChange={e => setPatientPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Correo Electrónico <span className="text-slate-400">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="paciente@correo.com"
                      value={patientEmail}
                      onChange={e => setPatientEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Motivo o Síntomas */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Motivo de Consulta o Diagnóstico Preliminar <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej. Control de hipertensión, dolor de garganta, revisión de análisis clínicos..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                />
              </div>

              {/* Receptionist toggles */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-mark-confirmed"
                    checked={markAsConfirmed}
                    onChange={e => setMarkAsConfirmed(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="chk-mark-confirmed" className="text-xs text-slate-800 font-bold cursor-pointer">
                    Marcar cita como CONFIRMADA inmediatamente (creada en recepción)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-send-whatsapp-direct"
                    checked={sendWhatsAppDirect}
                    onChange={e => setSendWhatsAppDirect(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <label htmlFor="chk-send-whatsapp-direct" className="text-xs text-slate-800 font-medium cursor-pointer">
                    Abrir WhatsApp con mensaje de confirmación oficial para el paciente
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a Horarios</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Agendar y Guardar Cita</span>
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};
