import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import {
  Save,
  RotateCcw,
  MessageCircle,
  Building,
  MapPin,
  Phone,
  Lock,
  DollarSign,
  Check,
  AlertTriangle,
  FileText,
  Clock,
  CheckSquare,
  Square,
  Database,
  Trash2,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { formatTimePretty, calculateEndTime } from '../../utils/whatsapp';
import { encodePinForStorage } from '../../utils/pinSecurity';

export const ClinicSettings: React.FC = () => {
  const {
    clinicConfig,
    updateClinicConfig,
    clearAllData,
    purgeCancelledAppointments,
    doctors,
    specialties,
    appointments,
    updateDoctor,
    isCloudConnected,
  } = useClinic();

  const [name, setName] = useState(clinicConfig.name);
  const [tagline, setTagline] = useState(clinicConfig.tagline);
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(clinicConfig.whatsappCountryCode);
  const [whatsappNumber, setWhatsappNumber] = useState(clinicConfig.whatsappNumber);
  const [phone, setPhone] = useState(clinicConfig.phone);
  const [address, setAddress] = useState(clinicConfig.address);
  const [city, setCity] = useState(clinicConfig.city);
  const [currencySymbol, setCurrencySymbol] = useState(clinicConfig.currencySymbol);
  const [welcomeMessage, setWelcomeMessage] = useState(clinicConfig.welcomeMessage);
  const [newAdminPin, setNewAdminPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [defaultSlotDuration, setDefaultSlotDuration] = useState<number>(clinicConfig.defaultSlotDurationMinutes || 30);
  const [applyToAllDoctors, setApplyToAllDoctors] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Selective attended & cancelled appointments cleanup state
  const [cleanupStatusTarget, setCleanupStatusTarget] = useState<'both' | 'cancelada' | 'atendida'>('both');
  const [cleanupPeriod, setCleanupPeriod] = useState<
    'past' | 'older_7' | 'older_15' | 'older_30' | 'older_90' | 'all_cancelled'
  >('past');
  const [isCleaningCancelled, setIsCleaningCancelled] = useState(false);
  const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const matchingCancelledIds = appointments
    .filter(app => {
      if (cleanupStatusTarget === 'both') {
        if (app.status !== 'cancelada' && app.status !== 'atendida') return false;
      } else if (cleanupStatusTarget === 'cancelada') {
        if (app.status !== 'cancelada') return false;
      } else if (cleanupStatusTarget === 'atendida') {
        if (app.status !== 'atendida') return false;
      }

      if (cleanupPeriod === 'all_cancelled') return true;
      if (cleanupPeriod === 'past') return app.date < todayStr;
      const days =
        cleanupPeriod === 'older_7'
          ? 7
          : cleanupPeriod === 'older_15'
          ? 15
          : cleanupPeriod === 'older_30'
          ? 30
          : 90;
      const d = new Date();
      d.setDate(d.getDate() - days);
      const cutoff = d.toISOString().split('T')[0];
      return app.date <= cutoff;
    })
    .map(a => a.id);

  const handleSelectivePurgeCancelled = async () => {
    if (matchingCancelledIds.length === 0) return;
    setIsCleaningCancelled(true);
    try {
      const deleted = await purgeCancelledAppointments(matchingCancelledIds);
      setCleanupSuccessMessage(
        `¡Limpieza completada! Se eliminaron ${deleted} ${
          deleted === 1 ? 'cita finalizada' : 'citas finalizadas'
        } de la base de datos.`
      );
      setTimeout(() => setCleanupSuccessMessage(null), 5000);
    } finally {
      setIsCleaningCancelled(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const durationNum = Number(defaultSlotDuration) || 30;

    const updatedPin = newAdminPin.trim()
      ? encodePinForStorage(newAdminPin.trim())
      : clinicConfig.adminPin;

    updateClinicConfig({
      name: name.trim(),
      tagline: tagline.trim(),
      whatsappCountryCode: whatsappCountryCode.replace(/[^0-9]/g, ''),
      whatsappNumber: whatsappNumber.replace(/[^0-9]/g, ''),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      currencySymbol: currencySymbol.trim() || '$',
      welcomeMessage: welcomeMessage.trim(),
      adminPin: updatedPin,
      defaultSlotDurationMinutes: durationNum,
    });

    setNewAdminPin('');

    if (applyToAllDoctors && doctors.length > 0) {
      doctors.forEach(doc => {
        updateDoctor(doc.id, { slotDurationMinutes: durationNum });
      });
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    clearAllData();
    setShowResetConfirm(false);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Configuración del Consultorio & WhatsApp
          </h3>
          <p className="text-xs text-slate-500">
            Personaliza el número oficial donde los pacientes envían sus citas y los datos del centro médico.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold rounded-xl animate-in fade-in">
            <Check className="w-4 h-4 text-blue-600" />
            <span>¡Configuración guardada!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        
        {/* WhatsApp Receptor Section */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200 ring-4 ring-blue-500/5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-blue-800 border-b border-blue-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <MessageCircle className="w-4 h-4 fill-white/20" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                WhatsApp Oficial de Recepción
              </h4>
              <p className="text-xs text-slate-500">
                Aquí llegarán de manera instantánea los datos de todas las citas agendadas por los pacientes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Código de País:
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                  +
                </span>
                <input
                  type="text"
                  required
                  placeholder="52 (México), 51 (Perú), 57 (Col), 1 (USA)..."
                  value={whatsappCountryCode}
                  onChange={e => setWhatsappCountryCode(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <span className="text-[10px] text-slate-600 block">Sin el signo +</span>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block">
                Número de Celular / WhatsApp:
              </label>
              <input
                type="text"
                required
                placeholder="Ej. 5541697820"
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-blue-800 font-medium block">
                Destino activo: +{whatsappCountryCode} {whatsappNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Clinic Identity & Address */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h4 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
            Identidad de la Clínica
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Nombre del Consultorio / Clínica:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Eslogan / Subtítulo:
              </label>
              <input
                type="text"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Dirección Física:
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Ciudad / Estado:
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Teléfono Fijo / Centralita:
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Símbolo de Moneda:
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={e => setCurrencySymbol(e.target.value)}
                placeholder="$, S/., €, MXN..."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              Mensaje de Bienvenida a Pacientes:
            </label>
            <textarea
              rows={2}
              value={welcomeMessage}
              onChange={e => setWelcomeMessage(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-xs resize-none focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Cambiar PIN de Administración:</span>
                </label>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  🔒 PIN Encriptado
                </span>
              </div>

              <div className="relative">
                <input
                  type={showNewPin ? 'text' : 'password'}
                  maxLength={6}
                  placeholder="Nuevo PIN (dejar vacío para no cambiar)"
                  value={newAdminPin}
                  onChange={e => setNewAdminPin(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-white rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showNewPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                >
                  {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Por seguridad, tu PIN actual está oculto y encriptado. Escribe uno nuevo (4 a 6 caracteres) solo si deseas reemplazarlo, y luego pulsa <strong>Guardar Cambios</strong>.
              </p>
            </div>

            {/* Consultation Duration / Interval customization section */}
            <div className="space-y-2 p-3 bg-blue-50/70 rounded-2xl border border-blue-200">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Duración e Intervalo de Consulta:</span>
                </span>
                <span className="font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                  {defaultSlotDuration} min
                </span>
              </label>

              {/* Presets */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {[15, 20, 30, 40, 45, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDefaultSlotDuration(mins)}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                      defaultSlotDuration === mins
                        ? 'bg-blue-600 text-white shadow-2xs ring-2 ring-blue-500/20'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-100/60'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              {/* Custom input */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-slate-600 font-semibold text-[11px]">Otro intervalo:</span>
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={defaultSlotDuration}
                  onChange={e => setDefaultSlotDuration(Math.max(5, Number(e.target.value)))}
                  className="w-16 px-2 py-1 bg-white rounded-lg border border-slate-300 text-xs text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500 text-[11px]">minutos por cita</span>
              </div>

              {/* Live Preview */}
              <div className="p-2 bg-white rounded-xl border border-blue-100 text-[11px] text-slate-600">
                <span className="font-semibold block text-slate-700 mb-0.5">Ejemplo de distribución de turnos:</span>
                <div className="font-mono font-bold text-blue-700 truncate">
                  {formatTimePretty("08:00")} → {formatTimePretty(calculateEndTime("08:00", defaultSlotDuration))} → {formatTimePretty(calculateEndTime(calculateEndTime("08:00", defaultSlotDuration), defaultSlotDuration))}...
                </div>
              </div>

              {/* Checkbox to apply to all doctors */}
              {doctors.length > 0 && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToAllDoctors}
                    onChange={e => setApplyToAllDoctors(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-slate-700">
                    Aplicar este intervalo ({defaultSlotDuration} min) a los <strong>{doctors.length}</strong> médico(s) ya registrado(s).
                  </span>
                </label>
              )}

              <span className="text-[10px] text-slate-500 block pt-0.5">
                💡 También puedes asignar un intervalo individual diferente a cada doctor en <strong>Médicos & Especialidades</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Cloud Database Quick Banner */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl p-4 border border-teal-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-teal-950">
                  Base de Datos en la Nube
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isCloudConnected
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isCloudConnected ? '🟢 Conectado' : '🟡 Modo Local'}
                </span>
              </div>
              <p className="text-xs text-teal-800/80 mt-0.5">
                Configura URL, credenciales de la Nube y copia el script SQL para clonar bases de datos para nuevas clínicas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('header-nav-database');
              if (el) el.click();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition shrink-0 cursor-pointer text-center"
          >
            Abrir Panel de la Nube
          </button>
        </div>

        {/* Save button bar */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4" />
              <span>¡Configuración guardada exitosamente!</span>
            </span>
          )}

          <button
            type="submit"
            id="btn-save-clinic-settings"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </form>

      {/* Selective Maintenance: Limpiar Citas Atendidas y Canceladas Antiguas */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs border border-amber-200">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                Mantenimiento: Limpiar Citas Atendidas y Canceladas por Período
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950 uppercase tracking-wider">
                Limpieza Selectiva
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Elimina de la base de datos las citas con estado <strong>Atendida</strong> y/o <strong>Cancelada</strong> del período que selecciones. Tus médicos, especialidades y citas activas (pendientes o confirmadas) se mantienen intactos.
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-amber-200/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-700">
                Estado a limpiar:
              </label>
              <select
                value={cleanupStatusTarget}
                onChange={e => setCleanupStatusTarget(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="both">Ambas (Citas Atendidas y Canceladas)</option>
                <option value="atendida">Solo Citas Ya Atendidas</option>
                <option value="cancelada">Solo Citas Canceladas</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-700">
                Período de antigüedad:
              </label>
              <select
                value={cleanupPeriod}
                onChange={e => setCleanupPeriod(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="past">Anteriores a hoy (fechas pasadas)</option>
                <option value="older_7">Más de 7 días de antigüedad</option>
                <option value="older_15">Más de 15 días de antigüedad</option>
                <option value="older_30">Más de 30 días (1 mes)</option>
                <option value="older_90">Más de 90 días (3 meses)</option>
                <option value="all_cancelled">Todas (cualquier fecha)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={matchingCancelledIds.length === 0 || isCleaningCancelled}
            onClick={handleSelectivePurgeCancelled}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0 lg:self-end"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isCleaningCancelled
                ? 'Limpiando...'
                : `Limpiar Registros (${matchingCancelledIds.length})`}
            </span>
          </button>
        </div>

        {cleanupSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{cleanupSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Danger Zone: Restablecimiento del Sistema */}
      <div className="bg-rose-50/70 border-2 border-rose-200 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs border border-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm sm:text-base font-extrabold text-rose-950">
                Zona Crítica: Restablecer / Vaciar Base de Datos
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 uppercase tracking-wider">
                Acción Restringida
              </span>
            </div>
            <p className="text-xs text-rose-900/80 leading-relaxed">
              Esta función borra de forma definitiva todas las citas reservadas, médicos registrados, especialidades y horarios bloqueados. Úsala únicamente si deseas reiniciar el sistema por completo para una nueva clínica o comenzar de cero.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-rose-200/80">
          <div className="text-xs text-rose-900 font-medium space-x-1">
            <span>Registros actuales:</span>
            <span className="font-bold text-rose-950">
              {appointments.length} citas, {doctors.length} médicos, {specialties.length} especialidades
            </span>
          </div>

          <button
            type="button"
            id="btn-open-clear-data-modal"
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Vaciar Todos los Datos del Sistema</span>
          </button>
        </div>
      </div>

      {/* Clear Data Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-rose-200 text-slate-800 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black text-rose-600 tracking-wider bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200 inline-block mb-1">
                  ⚠️ Advertencia: Acción Irreversible
                </span>
                <h4 className="font-extrabold text-base sm:text-lg text-slate-900">
                  ¿Confirmas vaciar todos los datos?
                </h4>
              </div>
            </div>

            <div className="p-4 bg-rose-50/90 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-2.5 leading-relaxed">
              <p className="font-bold text-rose-900">
                Esta acción eliminará de forma permanente los siguientes registros:
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-rose-900 text-xs pl-1 font-medium">
                <li>
                  Todas las <strong>{appointments.length} citas registradas</strong> (historial de pacientes y reservas).
                </li>
                <li>
                  Los <strong>{doctors.length} médicos y especialistas</strong> registrados con sus horarios.
                </li>
                <li>
                  Las <strong>{specialties.length} especialidades médicas</strong> y consultorios.
                </li>
                <li>
                  Todos los bloqueos de agenda y vacaciones.
                </li>
              </ul>
              <div className="p-2.5 bg-white/80 rounded-xl border border-rose-200 text-[11px] text-slate-600">
                <strong>Resultado:</strong> El sistema quedará en blanco con la configuración inicial para que puedas ingresar los datos de una nueva clínica o consultorio desde cero.
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors text-center"
              >
                Cancelar y Mantener Datos
              </button>
              <button
                type="button"
                id="btn-confirm-wipe-all-data"
                onClick={handleReset}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Vaciar Todos los Datos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
