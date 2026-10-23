import { Appointment, ClinicConfig } from '../types';

/**
 * Formats a clean, professional appointment message ready for WhatsApp
 */
export function generatePatientWhatsAppMessage(
  appointment: Appointment,
  clinicConfig: ClinicConfig
): string {
  const typeLabel = appointment.type === 'presencial' ? '🏥 Presencial' : '💻 Teleconsulta Virtual';

  return `*NUEVA SOLICITUD DE CITA MÉDICA*
━━━━━━━━━━━━━━━━━━━━
*Clínica:* ${clinicConfig.name}
*Código de Reserva:* \`#${appointment.id}\`
━━━━━━━━━━━━━━━━━━━━

👤 *DATOS DEL PACIENTE:*
• *Nombre:* ${appointment.patientName}
• *Teléfono:* ${appointment.patientPhone}
${appointment.patientEmail ? `• *Correo:* ${appointment.patientEmail}\n` : ''}${appointment.patientDni ? `• *Identificación / DNI:* ${appointment.patientDni}\n` : ''}
🩺 *DETALLES DE LA CITA:*
• *Especialidad:* ${appointment.specialtyName}
• *Médico:* ${appointment.doctorName}
• *Fecha:* ${formatDatePretty(appointment.date)}
• *Hora:* ${formatTimePretty(appointment.time)}
• *Modalidad:* ${typeLabel}
• *Ubicación:* ${appointment.consultorio}
• *Costo de Consulta:* ${clinicConfig.currencySymbol}${appointment.fee}

📝 *MOTIVO / SÍNTOMAS:*
"${appointment.reason}"

━━━━━━━━━━━━━━━━━━━━
_Hola, acabo de reservar esta cita desde su plataforma móvil. Por favor confirmar mi disponibilidad. ¡Muchas gracias!_`;
}

/**
 * Formats clinic confirmation to send to patient
 */
export function generateClinicConfirmationMessage(
  appointment: Appointment,
  clinicConfig: ClinicConfig
): string {
  return `¡Hola *${appointment.patientName}*! 👋 
Le saludamos del *${clinicConfig.name}*.

✅ *Su cita médica ha sido CONFIRMADA con éxito:*
━━━━━━━━━━━━━━━━━━━━
• *Código:* \`#${appointment.id}\`
• *Especialidad:* ${appointment.specialtyName}
• *Médico:* ${appointment.doctorName}
• *Fecha:* ${formatDatePretty(appointment.date)}
• *Hora:* ${formatTimePretty(appointment.time)}
• *Lugar:* ${clinicConfig.address} (${appointment.consultorio})
• *Importe:* ${clinicConfig.currencySymbol}${appointment.fee}
━━━━━━━━━━━━━━━━━━━━

📌 *Recomendaciones:*
1. Llegar con 10-15 minutos de anticipación.
2. Traer identificación y estudios previos si dispone de ellos.
${appointment.type === 'teleconsulta' ? '3. Le enviaremos el enlace de videollamada 15 minutos antes de su turno.\n' : ''}
Cualquier duda o reprogramación, por favor comuníquese por este medio. ¡Que tenga un excelente día! 🩺`;
}

/**
 * Builds the WhatsApp Click-to-Chat URL
 */
export function buildWhatsAppUrl(phoneWithCountry: string, message: string): string {
  // Strip spaces, dashes, parentheses and plus
  const cleanPhone = phoneWithCountry.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export function formatDatePretty(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTimePretty(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${period}`;
}

export function calculateEndTime(timeStr: string, durationMinutes: number = 30): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const total = h * 60 + m + (durationMinutes || 30);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

/**
 * Formats appointment reschedule notification for WhatsApp
 */
export function generateRescheduleWhatsAppMessage(
  appointment: Appointment,
  clinicConfig: ClinicConfig,
  oldDate?: string,
  oldTime?: string
): string {
  return `*SOLICITUD DE REPROGRAMACIÓN DE CITA MÉDICA*
━━━━━━━━━━━━━━━━━━━━
*Clínica:* ${clinicConfig.name}
*Código de Cita:* \`#${appointment.id}\`
━━━━━━━━━━━━━━━━━━━━

👤 *DATOS DEL PACIENTE:*
• *Nombre:* ${appointment.patientName}
${appointment.patientDni ? `• *Cédula / Identificación:* ${appointment.patientDni}\n` : ''}• *Teléfono:* ${appointment.patientPhone}

🩺 *NUEVA FECHA Y HORA PROGRAMADA:*
• *Especialidad:* ${appointment.specialtyName}
• *Médico:* ${appointment.doctorName}
• *Nueva Fecha:* ${formatDatePretty(appointment.date)}
• *Nueva Hora:* ${formatTimePretty(appointment.time)}
${oldDate && oldTime ? `• *Horario anterior:* ${formatDatePretty(oldDate)} a las ${formatTimePretty(oldTime)}\n` : ''}• *Consultorio:* ${appointment.consultorio}

━━━━━━━━━━━━━━━━━━━━
_Hola, he reprogramado mi cita médica a través de la plataforma web. Por favor actualizar mi turno en la agenda de la clínica. ¡Muchas gracias!_`;
}

/**
 * Formats appointment cancellation notification for WhatsApp
 */
export function generateCancelWhatsAppMessage(
  appointment: Appointment,
  clinicConfig: ClinicConfig,
  reason?: string
): string {
  return `*SOLICITUD DE CANCELACIÓN DE CITA MÉDICA*
━━━━━━━━━━━━━━━━━━━━
*Clínica:* ${clinicConfig.name}
*Código de Cita:* \`#${appointment.id}\`
━━━━━━━━━━━━━━━━━━━━

👤 *DATOS DEL PACIENTE:*
• *Nombre:* ${appointment.patientName}
${appointment.patientDni ? `• *Cédula / Identificación:* ${appointment.patientDni}\n` : ''}• *Teléfono:* ${appointment.patientPhone}

🩺 *DATOS DE LA CITA CANCELADA:*
• *Especialidad:* ${appointment.specialtyName}
• *Médico:* ${appointment.doctorName}
• *Fecha:* ${formatDatePretty(appointment.date)}
• *Hora:* ${formatTimePretty(appointment.time)}
${reason ? `• *Motivo:* "${reason}"\n` : ''}
━━━━━━━━━━━━━━━━━━━━
_Hola, informo la cancelación de mi cita médica para liberar el horario en consultorio. Agradezco su atención._`;
}

/**
 * Formats cancellation notification sent from clinic reception to the patient
 */
export function generateClinicCancellationNoticeToPatient(
  appointment: Appointment,
  clinicConfig: ClinicConfig,
  customReason?: string
): string {
  const reasonToUse = customReason || appointment.cancellationReason || 'Cancelación de turno médico';
  return `Estimado/a *${appointment.patientName}* 👋,
Le escribimos del *${clinicConfig.name}*.

⚠️ *NOTIFICACIÓN DE CITA MÉDICA CANCELADA:*
━━━━━━━━━━━━━━━━━━━━
• *Código:* \`#${appointment.id}\`
• *Especialidad:* ${appointment.specialtyName}
• *Médico:* ${appointment.doctorName}
• *Fecha y Hora:* ${formatDatePretty(appointment.date)} a las ${formatTimePretty(appointment.time)}
• *Motivo de cancelación:* "${reasonToUse}"
━━━━━━━━━━━━━━━━━━━━

📌 *Información Importante:*
Esta cita ha quedado anulada de forma irreversible en nuestro sistema. Si aún requiere atención médica o desea consultar en una nueva fecha, con gusto puede agendar una nueva cita médica respondiendo a este mensaje o a través de nuestra plataforma web.

Agradecemos su comprensión. ¡Que tenga un buen día! 🩺`;
}
