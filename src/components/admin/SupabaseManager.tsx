import React, { useState, useEffect } from 'react';
import { useClinic } from '../../context/ClinicContext';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileCode,
  Key,
  Globe,
  Trash2,
  Mail,
  ArrowLeft,
  Lock,
  Unlock,
  Code2,
  CloudOff,
} from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../../data/supabaseSqlScript';

interface SupabaseManagerProps {
  onBackToSafeSection?: () => void;
}

export const SupabaseManager: React.FC<SupabaseManagerProps> = ({
  onBackToSafeSection,
}) => {
  const {
    isCloudConnected,
    isCloudSyncing,
    cloudError,
    lastCloudSync,
    supabaseConfig,
    setCloudConfig,
    syncFromCloud,
    syncToCloud,
    doctors,
    specialties,
    appointments,
  } = useClinic();

  const [hasDevPermission, setHasDevPermission] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('medicitas_db_dev_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [urlInput, setUrlInput] = useState(supabaseConfig.url);
  const [anonKeyInput, setAnonKeyInput] = useState(supabaseConfig.anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    if (supabaseConfig.url && !urlInput) {
      setUrlInput(supabaseConfig.url);
    }
    if (supabaseConfig.anonKey && !anonKeyInput) {
      setAnonKeyInput(supabaseConfig.anonKey);
    }
  }, [supabaseConfig.url, supabaseConfig.anonKey]);

  const handleSaveAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    const res = await setCloudConfig({
      url: urlInput.trim(),
      anonKey: anonKeyInput.trim(),
    });

    setIsTesting(false);
    setTestResult(res);
  };

  const handleDisconnect = () => {
    setShowDisconnectModal(true);
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      setUrlInput('');
      setAnonKeyInput('');
      await setCloudConfig({ url: '', anonKey: '' });
      setTestResult({
        success: true,
        message: 'Se ha desconectado de la Nube exitosamente. El sistema funciona ahora en modo local (offline).',
      });
      setShowDisconnectModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SQL_SCHEMA], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicitas_nube_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Warning gate: Show access restriction if developer permission has not been confirmed
  if (!hasDevPermission) {
    return (
      <div className="max-w-2xl mx-auto my-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl border-2 border-amber-300 shadow-xl overflow-hidden">
          {/* Top Warning Ribbon */}
          <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 text-white p-6 sm:p-7 text-center relative">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner ring-4 ring-white/10">
              <ShieldAlert className="w-9 h-9 text-white" />
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-black/25 text-amber-100 border border-white/20 inline-block mb-2">
              🔒 Módulo Técnico Restringido
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Advertencia: Configuración de Base de Datos
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-lg mx-auto">
              Infraestructura en la Nube y persistencia de datos (PostgreSQL)
            </p>
          </div>

          {/* Warning Content */}
          <div className="p-6 sm:p-7 space-y-5 text-slate-700">
            {/* Warning Message Box */}
            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs sm:text-sm leading-relaxed space-y-2.5 text-amber-950 font-medium">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Atención: Riesgo de afectación a la funcionalidad del sistema</span>
              </div>
              <p>
                Este módulo debe ser manipulado <strong>únicamente por el desarrollador del sistema</strong> o el <strong>administrador técnico</strong> calificado.
              </p>
              <p className="text-amber-900">
                Si no cuentas con conocimientos técnicos avanzados al respecto, <strong>por favor no accedas ni modifiques estos parámetros</strong>, ya que cualquier cambio incorrecto en las credenciales o tablas podría suspender la sincronización en tiempo real y afectar la funcionalidad integral del sistema y las citas de los pacientes.
              </p>
              <p className="font-bold text-slate-800">
                En caso contrario, si eres el programador responsable o personal técnico autorizado, puedes continuar con precaución o ponerte en contacto con soporte técnico.
              </p>
            </div>

            {/* Developer Contact Card */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                <Code2 className="w-4 h-4 text-blue-600" />
                <span>Datos de Contacto del Desarrollador / Soporte Técnico</span>
              </div>
              <p className="text-xs text-slate-600">
                Si necesitas crear una nueva base de datos para una clínica, configurar dominios individuales o requieres asistencia técnica especializada:
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Desarrollador / Soporte</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono truncate block select-all">
                      rodriguezraul.pro@gmail.com
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('rodriguezraul.pro@gmail.com');
                      setCopiedEmail(true);
                      setTimeout(() => setCopiedEmail(false), 2500);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copiar correo</span>
                      </>
                    )}
                  </button>

                  <a
                    href="mailto:rodriguezraul.pro@gmail.com?subject=Soporte%20T%C3%A9cnico%20MediCitas%20-%20Base%20de%20Datos"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Contactar</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="button"
                id="btn-db-warning-back"
                onClick={onBackToSafeSection}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-500" />
                <span>Volver al Panel Principal (Recomendado)</span>
              </button>

              <button
                type="button"
                id="btn-db-warning-continue"
                onClick={() => {
                  setHasDevPermission(true);
                  try {
                    sessionStorage.setItem('medicitas_db_dev_unlocked', 'true');
                  } catch (e) {
                    console.warn(e);
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-black shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Soy el Programador / Continuar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dev Mode Banner */}
      <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Modo Técnico Activo:</strong> Cualquier cambio en la base de datos se refleja inmediatamente en el sistema.
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href="mailto:rodriguezraul.pro@gmail.com?subject=Soporte%20T%C3%A9cnico%20MediCitas"
            className="text-[11px] font-bold text-amber-900 hover:underline flex items-center gap-1"
          >
            <Mail className="w-3 h-3 text-amber-700" />
            <span>Soporte: rodriguezraul.pro@gmail.com</span>
          </a>
          <button
            type="button"
            onClick={() => {
              setHasDevPermission(false);
              try {
                sessionStorage.removeItem('medicitas_db_dev_unlocked');
              } catch (e) {
                console.warn(e);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 text-[11px] font-bold border border-amber-300 transition-colors cursor-pointer flex items-center gap-1"
            title="Bloquear acceso técnico"
          >
            <Lock className="w-3 h-3" />
            <span>Bloquear Módulo</span>
          </button>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white rounded-3xl p-5 sm:p-6 shadow-md shadow-teal-900/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">Base de Datos en la Nube</h3>
                <span className="text-[10px] font-extrabold bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  PostgreSQL
                </span>
              </div>
              <p className="text-xs sm:text-sm text-teal-100 mt-0.5">
                Conecta tu consultorio a la Nube para tener persistencia multiusuario, tiempo real y clonar bases de datos independientes por clínica.
              </p>
            </div>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 shrink-0">
            {isCloudConnected ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                </span>
                <span className="text-xs font-bold text-white">Nube Activa y Conectada</span>
              </>
            ) : (
              <>
                <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                <span className="text-xs font-bold text-amber-100">Modo Local (Offline)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Connection Form & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 cols): Configuration Form */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Key className="w-5 h-5 text-teal-600" />
              <span>Credenciales de Conexión</span>
            </div>
            {isCloudConnected && (
              <span className="text-xs text-slate-500 font-medium">
                {lastCloudSync ? `Última sincronización: ${lastCloudSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </span>
            )}
          </div>

          {/* Info pill about Mobile & Multi-Device Auto-Sync */}
          <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 text-xs text-teal-900 flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block text-teal-950 mb-0.5">
                📱 Sincronización Automática con Celulares y Pacientes:
              </span>
              Al guardar la conexión aquí, el servidor distribuye automáticamente las credenciales. Cuando tú o tus pacientes abran el sistema desde un <strong>teléfono móvil (Android, iPhone)</strong> o tablet, verán inmediatamente todas las especialidades y médicos guardados en la Nube.
            </div>
          </div>

          <form onSubmit={handleSaveAndConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-slate-500" />
                <span>URL del Proyecto en la Nube</span>
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://tu-proyecto-clinica.nube.co"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                La encuentras en el panel de tu proveedor de Nube &gt; Project Settings &gt; API &gt; Project URL.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span>Clave Pública Anónima (Anon Key)</span>
              </label>
              <input
                type="password"
                value={anonKeyInput}
                onChange={e => setAnonKeyInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Clave pública anónima (anon public key) con Row Level Security habilitado.
              </span>
            </div>

            {/* Test or Feedback Messages */}
            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-medium flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{testResult.message}</p>
                </div>
              </div>
            )}

            {cloudError && !testResult && (
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{cloudError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isTesting || isCloudSyncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Conectando y Probando...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>Guardar y Probar Conexión</span>
                  </>
                )}
              </button>

              {isCloudConnected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Desconectar Nube</span>
                </button>
              )}
            </div>
          </form>

          {/* Sync Local / Cloud Toolbar */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Sincronización Manual</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  setTestResult(null);
                  const res = await syncToCloud();
                  setTestResult(res);
                }}
                disabled={!isCloudConnected || isCloudSyncing}
                className="p-3 rounded-2xl border border-slate-200 hover:border-teal-300 bg-slate-50 hover:bg-teal-50/50 text-left transition flex items-start gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Subir datos locales a la Nube</span>
                  <span className="text-[11px] text-slate-500">
                    Copia tus {doctors.length} médicos, {specialties.length} especialidades y {appointments.length} citas actuales a la Nube.
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setTestResult(null);
                  const res = await syncFromCloud();
                  setTestResult(res);
                }}
                disabled={!isCloudConnected || isCloudSyncing}
                className="p-3 rounded-2xl border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/50 text-left transition flex items-start gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <DownloadCloud className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Descargar datos desde la Nube</span>
                  <span className="text-[11px] text-slate-500">
                    Trae las citas y configuración más recientes almacenadas en el servidor PostgreSQL.
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Steps & Guides */}
        <div className="space-y-4">
          {/* Quick Steps Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
            <h4 className="font-extrabold text-sm text-slate-900 mb-2.5 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-teal-600" />
              <span>Instrucciones</span>
            </h4>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Entra a{' '}
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-600 underline font-semibold"
                >
                  supabase.com
                </a>{' '}
                y crea un nuevo proyecto con el nombre de la clínica.
              </li>
              <li>Abre el <strong>SQL Editor</strong> en el panel de administración de la Nube.</li>
              <li>Pega el script base (botón abajo) y dale a <strong>Run</strong>.</li>
              <li>Copia la <strong>URL</strong> y el <strong>Anon Key</strong> en este formulario o en las variables de entorno de su dominio.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* SQL Script Section for 1-Click Database Creation */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Script SQL Base para Clonar en la Nube
              </h4>
              <p className="text-xs text-slate-500">
                Crea las 5 tablas necesarias (configuración, especialidades, médicos, citas y bloqueos), índices y reglas de seguridad con 1 clic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition cursor-pointer"
            >
              {copiedSql ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>¡Copiado al Portapapeles!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Script SQL</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadSql}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Descargar archivo .sql"
            >
              <DownloadCloud className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar .sql</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSqlPreview(!showSqlPreview)}
              className="p-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Ver código SQL"
            >
              {showSqlPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* SQL Code Block preview toggle */}
        {showSqlPreview && (
          <div className="relative">
            <pre className="bg-slate-950 text-slate-200 text-xs p-4 rounded-2xl overflow-x-auto max-h-96 font-mono leading-relaxed border border-slate-800">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        )}
      </div>

      {/* Modern Disconnection Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <CloudOff className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  ¿Desconectar Base de Datos?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Base de Datos en la Nube (PostgreSQL)
                </p>
              </div>
            </div>

            {/* Explanation card */}
            <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-2 leading-relaxed">
              <p>
                Al desconectar, el sistema <strong>dejará de sincronizarse con la Nube</strong> y volverá a guardar los datos en el <strong>almacenamiento local</strong> de este navegador.
              </p>
              <div className="p-2.5 bg-white/90 rounded-xl border border-rose-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Nota:</strong> Los datos ya guardados en tu proyecto en la Nube permanecerán seguros. Puedes reconectarte en cualquier momento ingresando nuevamente la URL y Anon Key.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDisconnecting}
                onClick={() => setShowDisconnectModal(false)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors text-center disabled:opacity-50"
              >
                Cancelar y Mantener Conexión
              </button>
              <button
                type="button"
                id="btn-confirm-disconnect-supabase"
                disabled={isDisconnecting}
                onClick={handleConfirmDisconnect}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Desconectando...</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>Sí, Desconectar de la Nube</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
