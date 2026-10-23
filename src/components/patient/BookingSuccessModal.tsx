import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Appointment, ClinicConfig } from '../../types';
import { CheckCircle2, MessageCircle, Copy, Check, Printer, Calendar, Clock, MapPin, Stethoscope, User, PlusCircle, Sparkles, X } from 'lucide-react';
import { formatDatePretty, formatTimePretty, generatePatientWhatsAppMessage, buildWhatsAppUrl } from '../../utils/whatsapp';

interface BookingSuccessModalProps {
  appointment: Appointment;
  clinicConfig: ClinicConfig;
  onClose: () => void;
  onNewBooking: () => void;
}

export const BookingSuccessModal: React.FC<BookingSuccessModalProps> = ({
  appointment,
  clinicConfig,
  onClose,
  onNewBooking,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Launch celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#059669', '#10b981', '#34d399', '#0284c7'],
      });
    } catch {
      // safe fallback
    }
  }, []);

  const fullClinicPhone = `${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`;
  const waMessage = generatePatientWhatsAppMessage(appointment, clinicConfig);
  const waUrl = buildWhatsAppUrl(fullClinicPhone, waMessage);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(waMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 text-center relative">
          <button
            type="button"
            id="btn-modal-header-close"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
            title="Cerrar y volver al inicio"
            aria-label="Cerrar y volver al inicio"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-2 text-white ring-4 ring-white/10">
            <CheckCircle2 className="w-8 h-8 text-blue-100" />
          </div>
          <span className="text-[11px] uppercase tracking-wider font-extrabold bg-blue-900/60 px-2.5 py-0.5 rounded-full inline-block mb-1">
            ¡Cita Registrada con Éxito!
          </span>
          <h3 className="text-xl font-black">
            {clinicConfig.name}
          </h3>
          <p className="text-xs text-blue-100/90 mt-1">
            Se ha preparado el mensaje para enviar al WhatsApp de recepción
          </p>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Ticket Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Código de Cita
                </span>
                <span className="text-sm font-black font-mono text-blue-700">
                  #{appointment.id}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Pendiente WhatsApp
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 text-[10px] block">Paciente</span>
                  <span className="font-bold text-slate-800">{appointment.patientName}</span>
                  <span className="text-slate-500 text-[11px] block">{appointment.patientPhone}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Stethoscope className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 text-[10px] block">Especialista</span>
                  <span className="font-bold text-slate-800">{appointment.doctorName}</span>
                  <span className="text-blue-700 text-[11px] font-medium block">
                    {appointment.specialtyName}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Fecha</span>
                    <span className="font-bold text-slate-800 text-[11px] capitalize">
                      {formatDatePretty(appointment.date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
                  <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Hora</span>
                    <span className="font-bold text-slate-800 text-[11px]">
                      {formatTimePretty(appointment.time)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-600 text-[11px] pt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {appointment.type === 'presencial'
                    ? `${appointment.consultorio} (${clinicConfig.address})`
                    : 'Videollamada de Teleconsulta Online'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action: Open WhatsApp */}
          <div className="space-y-2">
            <a
              id="btn-modal-open-whatsapp"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-colors text-center"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" />
              <span>Enviar Cita al WhatsApp de la Clínica</span>
            </a>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-modal-copy-message"
                onClick={handleCopyMessage}
                className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-blue-700">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar texto</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-modal-print-ticket"
                onClick={handlePrint}
                className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Imprimir recibo</span>
              </button>
            </div>
          </div>

          {/* Navigation options */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              id="btn-modal-new-booking"
              type="button"
              onClick={onNewBooking}
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Agendar otra cita</span>
            </button>

            <button
              id="btn-modal-close"
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>Finalizar</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
