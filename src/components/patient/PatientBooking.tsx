import React, { useState } from 'react';
import { Specialty, Doctor, Appointment } from '../../types';
import { useClinic } from '../../context/ClinicContext';
import { SpecialtySelector } from './SpecialtySelector';
import { DoctorSelector } from './DoctorSelector';
import { DateTimeSelector } from './DateTimeSelector';
import { PatientForm } from './PatientForm';
import { BookingSuccessModal } from './BookingSuccessModal';
import { PatientAppointmentLookup } from './PatientAppointmentLookup';
import {
  ShieldCheck,
  MessageCircle,
  Clock,
  User,
  HeartPulse,
  Phone,
  CalendarPlus,
  Search,
  CalendarDays,
} from 'lucide-react';

export const PatientBooking: React.FC = () => {
  const { clinicConfig } = useClinic();

  const [patientMode, setPatientMode] = useState<'booking' | 'lookup'>('booking');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);

  const handleSelectSpecialty = (specialty: Specialty) => {
    setSelectedSpecialty(specialty);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedTime('');
    setStep(2);
  };

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedTime('');
    setStep(3);
  };

  const handleSelectDateTime = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep(4);
  };

  const handleBookingSuccess = (appointment: Appointment) => {
    setBookedAppointment(appointment);
  };

  const handleResetToStart = () => {
    setBookedAppointment(null);
    setSelectedSpecialty(null);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedTime('');
    setStep(1);
  };

  return (
    <div className="space-y-4">
      {/* Top Patient Mode Switcher (Agendar vs Consultar/Modificar) */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPatientMode('booking')}
          className={`flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            patientMode === 'booking'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CalendarPlus className="w-4 h-4 shrink-0" />
          <span>Agendar Nueva Cita</span>
        </button>

        <button
          type="button"
          onClick={() => setPatientMode('lookup')}
          className={`flex-1 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            patientMode === 'lookup'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" />
          <span>Consultar / Modificar Cita</span>
        </button>
      </div>

      {patientMode === 'lookup' ? (
        <PatientAppointmentLookup onBackToBooking={() => setPatientMode('booking')} />
      ) : (
        <>
          {/* Patient Welcome Card */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 rounded-3xl p-5 text-white shadow-lg shadow-blue-700/15 relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
                <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
                <span>Citas directas al WhatsApp de la clínica</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Agenda tu cita médica en 1 minuto
              </h2>

              <p className="text-xs sm:text-sm text-blue-100/90 max-w-xl">
                {clinicConfig.welcomeMessage}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-blue-100 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                  Sin registrarte ni crear contraseñas
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  Disponibilidad en tiempo real
                </span>
              </div>
            </div>

            {/* Decorative ambient background shape */}
            <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* Wizard Progress Indicator */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between gap-1 text-center">
          
          <button
            type="button"
            onClick={() => {
              if (step > 1) setStep(1);
            }}
            className={`flex-1 flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              step >= 1 ? 'text-blue-700' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 1
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step > 1
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              1
            </div>
            <span className="text-[10px] sm:text-xs font-bold truncate max-w-[70px] sm:max-w-none">
              Especialidad
            </span>
          </button>

          <div className={`h-0.5 flex-1 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />

          <button
            type="button"
            disabled={!selectedSpecialty}
            onClick={() => {
              if (selectedSpecialty && step > 2) setStep(2);
            }}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${
              step >= 2 ? 'text-blue-700' : 'text-slate-400'
            } ${!selectedSpecialty ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 2
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step > 2
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              2
            </div>
            <span className="text-[10px] sm:text-xs font-bold truncate max-w-[70px] sm:max-w-none">
              Médico
            </span>
          </button>

          <div className={`h-0.5 flex-1 ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />

          <button
            type="button"
            disabled={!selectedDoctor}
            onClick={() => {
              if (selectedDoctor && step > 3) setStep(3);
            }}
            className={`flex-1 flex flex-col items-center gap-1 transition-colors ${
              step >= 3 ? 'text-blue-700' : 'text-slate-400'
            } ${!selectedDoctor ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 3
                  ? 'bg-blue-600 text-white shadow-xs'
                  : step > 3
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              3
            </div>
            <span className="text-[10px] sm:text-xs font-bold truncate max-w-[70px] sm:max-w-none">
              Fecha & Hora
            </span>
          </button>

          <div className={`h-0.5 flex-1 ${step >= 4 ? 'bg-blue-600' : 'bg-slate-200'}`} />

          <div
            className={`flex-1 flex flex-col items-center gap-1 ${
              step === 4 ? 'text-blue-700' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === 4
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              4
            </div>
            <span className="text-[10px] sm:text-xs font-bold truncate max-w-[70px] sm:max-w-none">
              Enviar Cita
            </span>
          </div>

        </div>
      </div>

      {/* Main Interactive Wizard Step */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs">
        {step === 1 && (
          <SpecialtySelector
            onSelectSpecialty={handleSelectSpecialty}
            selectedSpecialtyId={selectedSpecialty?.id}
          />
        )}

        {step === 2 && selectedSpecialty && (
          <DoctorSelector
            specialty={selectedSpecialty}
            onSelectDoctor={handleSelectDoctor}
            onBack={() => setStep(1)}
            selectedDoctorId={selectedDoctor?.id}
          />
        )}

        {step === 3 && selectedSpecialty && selectedDoctor && (
          <DateTimeSelector
            specialty={selectedSpecialty}
            doctor={selectedDoctor}
            onSelectDateTime={handleSelectDateTime}
            onBack={() => setStep(2)}
            initialDate={selectedDate}
            initialTime={selectedTime}
          />
        )}

        {step === 4 && selectedSpecialty && selectedDoctor && selectedDate && selectedTime && (
          <PatientForm
            specialty={selectedSpecialty}
            doctor={selectedDoctor}
            date={selectedDate}
            time={selectedTime}
            onBack={() => setStep(3)}
            onSuccess={handleBookingSuccess}
          />
        )}
      </div>
      </>
      )}



      {/* Booking Success Modal */}
      {bookedAppointment && (
        <BookingSuccessModal
          appointment={bookedAppointment}
          clinicConfig={clinicConfig}
          onClose={handleResetToStart}
          onNewBooking={handleResetToStart}
        />
      )}
    </div>
  );
};
