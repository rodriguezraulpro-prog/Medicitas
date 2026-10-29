import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Doctor, Specialty, ConsultationType, Appointment } from '../../types';
import { ArrowLeft, User, Phone, Mail, FileText, Send, Sparkles, Shield, AlertCircle, Building, Video } from 'lucide-react';
import { formatDatePretty, formatTimePretty, generatePatientWhatsAppMessage, buildWhatsAppUrl } from '../../utils/whatsapp';
import { syncSaveAppointmentToSupabase } from '../../services/supabase';

interface PatientFormProps {
  specialty: Specialty;
  doctor: Doctor;
  date: string;
  time: string;
  onBack: () => void;
  onSuccess: (appointment: Appointment) => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  specialty,
  doctor,
  date,
  time,
  onBack,
  onSuccess,
}) => {
  const { addAppointment, clinicConfig } = useClinic();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<ConsultationType>('presencial');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Por favor ingresa tu nombre y apellido.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMsg('Por favor ingresa un número de teléfono / WhatsApp válido.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Por favor indica brevemente el motivo de tu consulta o síntomas.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create appointment in persistent context
      const newApp = addAppointment({
        patientName: fullName.trim(),
        patientPhone: phone.trim(),
        patientEmail: email.trim() || undefined,
        patientDni: dni.trim() || undefined,
        reason: reason.trim(),
        type,
        date,
        time,
        doctorId: doctor.id,
        doctorName: doctor.name,
        specialtyId: specialty.id,
        specialtyName: specialty.name,
        fee: doctor.fee,
        consultorio: doctor.consultorio,
        notes: notes.trim() || undefined,
      });

      // Ensure appointment is persisted to Cloud DB before launching external WhatsApp app on mobile
      try {
        await Promise.race([
          syncSaveAppointmentToSupabase(newApp),
          new Promise(resolve => setTimeout(resolve, 2500)),
        ]);
      } catch (syncErr) {
        console.warn('Cloud save warning on submit:', syncErr);
      }

      // Prepare WhatsApp message & URL
      const waMessage = generatePatientWhatsAppMessage(newApp, clinicConfig);
      const fullClinicPhone = `${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`;
      const waUrl = buildWhatsAppUrl(fullClinicPhone, waMessage);

      // Open WhatsApp in new tab / app
      try {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Could not auto-open window', err);
      }

      // Notify parent to show success modal & confetti
      onSuccess(newApp);
    } catch (err) {
      console.error(err);
      setErrorMsg('Ocurrió un error al procesar tu cita. Por favor intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            id="btn-back-to-datetime"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cambiar fecha u hora</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Paso 4 de 4 (Final)
          </span>
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
          Tus datos para la cita médica
        </h2>
        
        {/* Zero-registration reassurance banner */}
        <div className="flex items-start gap-2.5 p-3 bg-blue-50/80 rounded-xl border border-blue-200">
          <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-900">
            <span className="font-bold">Sin registro previo:</span> No necesitas contraseñas ni cuentas. Al enviar, la cita se registra en el sistema y se abre el WhatsApp oficial de la clínica para confirmación inmediata.
          </div>
        </div>
      </div>

      {/* Appointment Summary Box */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Resumen de tu selección
          </span>
          <span className="text-xs font-bold text-blue-700">
            Total: {clinicConfig.currencySymbol}{doctor.fee}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-600 block text-[11px]">Especialidad:</span>
            <span className="font-semibold text-slate-800">{specialty.name}</span>
          </div>
          <div>
            <span className="text-slate-600 block text-[11px]">Médico:</span>
            <span className="font-semibold text-slate-800">{doctor.name}</span>
          </div>
          <div>
            <span className="text-slate-600 block text-[11px]">Fecha:</span>
            <span className="font-semibold text-slate-800 capitalize">{formatDatePretty(date)}</span>
          </div>
          <div>
            <span className="text-slate-600 block text-[11px]">Hora:</span>
            <span className="font-semibold text-slate-800">{formatTimePretty(time)}</span>
          </div>
        </div>
      </div>

      {/* Patient Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modalidad Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Modalidad de atención:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="btn-type-presencial"
              onClick={() => setType('presencial')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                type === 'presencial'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Building className="w-4 h-4 text-blue-600" />
              <span>Presencial en Consultorio</span>
            </button>

            <button
              type="button"
              id="btn-type-teleconsulta"
              onClick={() => setType('teleconsulta')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                type === 'teleconsulta'
                  ? 'bg-blue-50 border-blue-600 text-blue-800 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Video className="w-4 h-4 text-indigo-600" />
              <span>Teleconsulta Online</span>
            </button>
          </div>
        </div>

        {/* Patient Name */}
        <div className="space-y-1">
          <label htmlFor="input-patient-name" className="block text-xs font-bold text-slate-700">
            Nombre y Apellido del Paciente <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-patient-name"
              type="text"
              required
              placeholder="Ej. María Elena Fernández"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Patient Phone / WhatsApp */}
        <div className="space-y-1">
          <label htmlFor="input-patient-phone" className="block text-xs font-bold text-slate-700">
            Teléfono Celular / WhatsApp <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-patient-phone"
              type="tel"
              required
              placeholder="Ej. +52 55 1234 5678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-600">
            Por este número la clínica te enviará la confirmación y recordatorios.
          </p>
        </div>

        {/* Optional DNI & Email Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="input-patient-dni" className="block text-xs font-bold text-slate-700">
              Cédula / DNI / Identificación <span className="text-blue-600 font-semibold">(Recomendado)</span>
            </label>
            <input
              id="input-patient-dni"
              type="text"
              placeholder="Ej. 10987654"
              value={dni}
              onChange={e => setDni(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-[10px] text-slate-500">
              Útil para consultar el estado, modificar fecha o cancelarla luego.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="input-patient-email" className="block text-xs font-medium text-slate-700">
              Correo Electrónico <span className="text-slate-600">(Opcional)</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-patient-email"
                type="email"
                placeholder="nombre@correo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Reason for Appointment */}
        <div className="space-y-1">
          <label htmlFor="input-patient-reason" className="block text-xs font-bold text-slate-700">
            Motivo de Consulta o Síntomas <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="input-patient-reason"
            rows={2}
            required
            placeholder="Describe brevemente tus síntomas o el motivo (ej. Dolor abdominal, chequeo de rutina, control de presión...)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full p-3 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Submit to WhatsApp Action */}
        <div className="pt-2">
          <button
            id="btn-submit-appointment"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-75 shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Registrando cita en el sistema...'
                : 'Confirmar y Enviar al WhatsApp de la Clínica'}
            </span>
          </button>

          <p className="text-[11px] text-center text-slate-600 mt-2">
            Al presionar, se abrirá WhatsApp con el mensaje estructurado listo para enviar a la recepción (+{clinicConfig.whatsappCountryCode} {clinicConfig.whatsappNumber}).
          </p>
        </div>
      </form>
    </div>
  );
};
