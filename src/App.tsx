import React, { useState, useEffect } from 'react';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { Header } from './components/common/Header';
import { PatientBooking } from './components/patient/PatientBooking';
import { AdminApp } from './AdminApp';
import {
  MessageCircle,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

function AppContent() {
  const { clinicConfig } = useClinic();
  const [isMobileDeviceView, setIsMobileDeviceView] = useState<boolean>(false);
  const [lastTouchTime, setLastTouchTime] = useState<number>(0);

  // Allow visiting /admin or #admin directly on single page as well as admin.html
  const [isAdminPath, setIsAdminPath] = useState<boolean>(() => {
    return (
      window.location.pathname.endsWith('/admin') ||
      window.location.pathname.endsWith('/admin/') ||
      window.location.pathname.endsWith('admin.html') ||
      window.location.hash === '#admin'
    );
  });

  const handleOpenAdmin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsAdminPath(true);
    if (!window.location.pathname.endsWith('/admin') && window.location.hash !== '#admin') {
      try {
        window.history.pushState({ admin: true }, '', '/admin');
      } catch {
        window.location.hash = '#admin';
      }
    }
  };

  const handleTouchEnd = () => {
    const now = Date.now();
    // Double tap within 350ms
    if (now - lastTouchTime < 350) {
      handleOpenAdmin();
    }
    setLastTouchTime(now);
  };

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminPath(
        window.location.pathname.endsWith('/admin') ||
        window.location.pathname.endsWith('/admin/') ||
        window.location.pathname.endsWith('admin.html') ||
        window.location.hash === '#admin'
      );
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  useEffect(() => {
    document.title = isAdminPath
      ? 'Panel Administrativo - MediCitas'
      : 'MediCitas - Gestión y Reserva Médica';
  }, [isAdminPath]);

  if (isAdminPath) {
    return <AdminApp />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        isMobileDeviceView={isMobileDeviceView}
        setIsMobileDeviceView={setIsMobileDeviceView}
      />

      {/* Main Container - Dedicated to Patient Appointments */}
      <main className="flex-1 py-4 sm:py-6 px-3 sm:px-6">
        <div
          className={`mx-auto transition-all duration-200 ${
            isMobileDeviceView
              ? 'max-w-sm sm:max-w-md bg-white rounded-3xl sm:rounded-[36px] p-3 sm:p-4 shadow-2xl border-4 sm:border-8 border-slate-900 ring-1 ring-slate-900/20'
              : 'max-w-4xl'
          }`}
        >
          {/* Mobile phone speaker notch if in mobile simulation view */}
          {isMobileDeviceView && (
            <div className="hidden sm:flex justify-center mb-3">
              <div className="w-20 h-4 bg-slate-900 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-800 mr-2" />
                <div className="w-8 h-1 rounded-full bg-slate-800" />
              </div>
            </div>
          )}

          {/* Patient Booking Flow */}
          <PatientBooking />
        </div>
      </main>

      {/* Bottom Medical Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <p className="font-bold text-slate-800">
              {clinicConfig.name}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-slate-500">
              {(clinicConfig.address || clinicConfig.city) && (
                <>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {[clinicConfig.address, clinicConfig.city].filter(Boolean).join(', ')}
                  </span>
                  <span>•</span>
                </>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {clinicConfig.openDaysText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {clinicConfig.whatsappNumber ? (
              <a
                href={`https://wa.me/${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600/20" />
                <span>WhatsApp de Recepción</span>
              </a>
            ) : null}

            {/* Clinic Staff link */}
            <a
              href="/admin"
              onClick={handleOpenAdmin}
              id="admin-footer-link"
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold tracking-tight transition-colors py-1 px-2 rounded-lg hover:bg-blue-50/80 cursor-pointer"
              title="Acceso administrativo"
            >
              Acceso personal de clínica
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ClinicProvider>
      <AppContent />
    </ClinicProvider>
  );
}
