import React, { useState } from 'react';
import { useClinic } from './context/ClinicContext';
import { AdminDashboard, AdminSection } from './components/admin/AdminDashboard';
import {
  ShieldCheck,
  Building2,
  Lock,
  MessageCircle,
  Clock,
  MapPin,
  CalendarCheck,
  UserCheck,
  CheckCircle2,
  LogOut,
  RefreshCw,
  ExternalLink,
  CalendarDays,
  UserCog,
  BarChart3,
  Settings,
  ArrowLeft,
  Database,
  HelpCircle,
  KeyRound,
  Mail,
  Copy,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  verifyAdminPin,
  verifyMasterRecoveryKey,
  encodePinForStorage,
} from './utils/pinSecurity';

export const AdminApp: React.FC = () => {
  const {
    clinicConfig,
    updateClinicConfig,
    appointments,
    isCloudConnected,
    syncFromCloud,
  } = useClinic();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('medicitas_admin_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [activeSection, setActiveSection] = useState<AdminSection>('appointments');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // PIN Recovery & Support Modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [newRecoveryPin, setNewRecoveryPin] = useState('');
  const [recoveryFeedback, setRecoveryFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copiedSupportEmail, setCopiedSupportEmail] = useState(false);
  const [isSyncingPin, setIsSyncingPin] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPin(pinInput, clinicConfig.adminPin)) {
      setIsAuthenticated(true);
      setPinError(false);
      setPinInput('');
      try {
        sessionStorage.setItem('medicitas_admin_auth', 'true');
      } catch (err) {
        console.warn('SessionStorage unavailable', err);
      }
    } else {
      setPinError(true);
    }
  };

  const handleRecoveryReset = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryFeedback(null);

    if (!verifyMasterRecoveryKey(recoveryKeyInput)) {
      setRecoveryFeedback({
        type: 'error',
        message: 'La llave de soporte ingresada no es válida. Solicítala al soporte técnico (rodriguezraul.pro@gmail.com).',
      });
      return;
    }

    const cleanNewPin = newRecoveryPin.trim();
    if (cleanNewPin.length < 4 || cleanNewPin.length > 6) {
      setRecoveryFeedback({
        type: 'error',
        message: 'El nuevo PIN debe tener entre 4 y 6 caracteres.',
      });
      return;
    }

    updateClinicConfig({
      adminPin: encodePinForStorage(cleanNewPin),
    });

    setRecoveryFeedback({
      type: 'success',
      message: '¡Tu nuevo PIN ha sido configurado y encriptado con éxito! Ya puedes ingresar al panel.',
    });
    setRecoveryKeyInput('');
    setNewRecoveryPin('');
    setPinInput('');
    setPinError(false);
  };

  const handleSyncPinFromCloud = async () => {
    setIsSyncingPin(true);
    setRecoveryFeedback(null);
    const res = await syncFromCloud();
    setIsSyncingPin(false);
    setRecoveryFeedback({
      type: res.success ? 'success' : 'error',
      message: res.success
        ? 'Se sincronizó la configuración más reciente desde la Nube. Intenta iniciar sesión con tu PIN actualizado.'
        : res.message,
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem('medicitas_admin_auth');
    } catch (err) {
      console.warn('SessionStorage unavailable', err);
    }
  };

  const pendingCount = appointments.filter(a => a.status === 'pendiente_whatsapp').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar for Clinic Staff with Navigation Tabs (Sticky on Scroll, Light Blue & White Theme) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Left: Brand + Clinic Name & Mobile Logout */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                      {clinicConfig.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Panel Administrativo
                  </span>
                </div>
              </div>

              {/* Mobile Right Action: Logout or Return to Patient Portal */}
              <div className="lg:hidden flex items-center gap-2">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Salir</span>
                  </button>
                ) : (
                  <a
                    href="./"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                    title="Regresar a la página de citas de los pacientes"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Citas Pacientes</span>
                  </a>
                )}
              </div>
            </div>

            {/* Center: Menu Tabs with Active Blue Highlight (Fixed upon scroll) */}
            {isAuthenticated && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5">
                <button
                  id="header-nav-appointments"
                  onClick={() => setActiveSection('appointments')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeSection === 'appointments'
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Gestión de Citas</span>
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-900 shadow-xs">
                      {pendingCount}
                    </span>
                  )}
                </button>

                <button
                  id="header-nav-doctors"
                  onClick={() => setActiveSection('doctors')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeSection === 'doctors'
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <UserCog className="w-3.5 h-3.5" />
                  <span>Médicos y Especialistas</span>
                </button>

                <button
                  id="header-nav-reports"
                  onClick={() => setActiveSection('reports')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeSection === 'reports'
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Reporte en Tiempo Real</span>
                </button>

                <button
                  id="header-nav-settings"
                  onClick={() => setActiveSection('settings')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeSection === 'settings'
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configuración</span>
                </button>

                <button
                  id="header-nav-database"
                  onClick={() => setActiveSection('database')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeSection === 'database'
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Base de Datos (Nube)</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                    }`}
                    title={isCloudConnected ? 'Conectado a la Nube' : 'Modo local offline'}
                  />
                </button>
              </div>
            )}

            {/* Right: Desktop Actions */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                  title="Cerrar sesión del panel"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              ) : (
                <a
                  href="./"
                  id="header-btn-back-to-patients"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                  title="Regresar a la página de citas de los pacientes"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
                  <span>Página de Citas Pacientes</span>
                </a>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-6 px-3 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {!isAuthenticated ? (
            /* Login Gate for the Admin Panel (Light Blue & White Theme) */
            <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl">
              {/* Back to patient portal navigation header */}
              <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                <a
                  href="./"
                  id="btn-login-back-patients-top"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-700 transition-colors py-1 px-2.5 -ml-2 rounded-xl hover:bg-blue-50/70"
                  title="Regresar a la página de citas de los pacientes"
                >
                  <ArrowLeft className="w-4 h-4 text-blue-600" />
                  <span>Regresar a la página de citas</span>
                </a>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  Web Pacientes
                </span>
              </div>

              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8" />
              </div>

              <div className="text-center space-y-1 mb-6">
                <h2 className="text-xl font-black text-slate-900">
                  Acceso Administrativo
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Página exclusiva para el equipo del consultorio. Ingresa el código PIN para gestionar citas, médicos y reportes.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
                    PIN de Seguridad de la Clínica
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    autoFocus
                    placeholder="••••"
                    value={pinInput}
                    onChange={e => {
                      setPinInput(e.target.value);
                      setPinError(false);
                    }}
                    className="w-full text-center text-2xl tracking-widest font-mono py-3 px-4 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-bold"
                  />
                  {pinError && (
                    <p className="text-rose-600 text-xs text-center mt-2 font-medium">
                      PIN de acceso incorrecto. Verifica tu clave o utiliza la opción de recuperación abajo.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ingresar al Panel de Gestión</span>
                </button>

                {/* Forgot PIN / Contact Support trigger */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    id="btn-forgot-admin-pin"
                    onClick={() => {
                      setRecoveryFeedback(null);
                      setShowRecoveryModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-700 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-100"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                    <span>¿Olvidaste tu PIN o necesitas contactar a soporte?</span>
                  </button>
                </div>

                {/* Return to patient portal button */}
                <div className="pt-3 border-t border-slate-100">
                  <a
                    href="./"
                    id="btn-return-patient-booking"
                    className="w-full py-2.5 px-4 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 hover:text-blue-900 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-4 h-4 text-blue-600" />
                    <span>Regresar a la Página de Citas de Pacientes</span>
                  </a>
                </div>
              </form>

              {/* Direct Access reminder */}
              <div className="mt-8 pt-5 border-t border-slate-100 text-center">
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 text-left space-y-1.5 text-xs text-slate-600">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Enlace directo para el personal:</span>
                  </div>
                  <p className="text-[11px] font-mono text-blue-700 break-all select-all bg-white p-2.5 rounded-xl border border-blue-200 font-semibold">
                    {`${window.location.origin}${window.location.pathname.replace(/\/(index\.html|admin\.html)?$/, '')}/admin.html`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Puedes guardar este enlace en los marcadores del navegador o teléfono de la clínica.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Authenticated Admin Dashboard (White & Blue Medical Theme) */
            <div className="space-y-4">
              {/* Quick direct notification header */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Panel Administrativo en Tiempo Real</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cualquier cita reservada por los pacientes en la página principal se sincroniza inmediatamente aquí.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <a
                    href="./"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                    title="Ver vista página de citas pacientes"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver Página Citas Pacientes</span>
                  </a>
                </div>
              </div>

              {/* The full Admin Dashboard component */}
              <div>
                <AdminDashboard
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* PIN Recovery & Support Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                  <KeyRound className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Recuperación de PIN y Soporte Técnico
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Restablece el acceso al panel o contacta con el administrador del sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Section 1: Contact Support */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>1. Contactar con Soporte Técnico / Desarrollador</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Si el consultorio o clínica olvidó su PIN de acceso, comunícate con soporte técnico para solicitar la <strong>Llave de Recuperación</strong> o el restablecimiento remoto en la Nube:
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Correo Oficial de Soporte
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono truncate block select-all">
                      rodriguezraul.pro@gmail.com
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('rodriguezraul.pro@gmail.com');
                        setCopiedSupportEmail(true);
                        setTimeout(() => setCopiedSupportEmail(false), 2500);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedSupportEmail ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`mailto:rodriguezraul.pro@gmail.com?subject=${encodeURIComponent(
                        `Recuperación de PIN Administrativo - ${clinicConfig.name}`
                      )}`}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Solicitar Ayuda</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Section 2: Reset PIN using Support Recovery Key */}
              <form onSubmit={handleRecoveryReset} className="space-y-3.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    <span>2. Restablecer PIN con Llave de Soporte</span>
                  </div>
                  {isCloudConnected && (
                    <button
                      type="button"
                      onClick={handleSyncPinFromCloud}
                      disabled={isSyncingPin}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      title="Si soporte actualizó tu PIN en la Nube, pulsa aquí"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingPin ? 'animate-spin' : ''}`} />
                      <span>Sincronizar desde Nube</span>
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  Si ya tienes la llave de autorización proporcionada por soporte técnico, ingrésala aquí junto con tu nuevo PIN:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Llave de Soporte:
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Ingresa la llave de soporte"
                      value={recoveryKeyInput}
                      onChange={e => setRecoveryKeyInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nuevo PIN (4 a 6 dígitos):
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      placeholder="Tu nuevo PIN"
                      value={newRecoveryPin}
                      onChange={e => setNewRecoveryPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {recoveryFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                      recoveryFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {recoveryFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{recoveryFeedback.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Guardar Nuevo PIN</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin Dedicated Footer (Light Theme) */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-800">{clinicConfig.name}</span>
            <span>—</span>
            <span className="text-slate-500">Módulo Administrativo Seguro</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1 font-medium">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp: {clinicConfig.whatsappNumber ? `+${clinicConfig.whatsappCountryCode} ${clinicConfig.whatsappNumber}` : 'Por configurar'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
