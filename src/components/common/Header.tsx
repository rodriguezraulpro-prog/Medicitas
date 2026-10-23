import React from 'react';
import { useClinic } from '../../context/ClinicContext';
import { MessageCircle, Building2, Smartphone } from 'lucide-react';

interface HeaderProps {
  isMobileDeviceView?: boolean;
  setIsMobileDeviceView?: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isMobileDeviceView,
  setIsMobileDeviceView,
}) => {
  const { clinicConfig } = useClinic();

  return (
    <>
      <header id="main-header" className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-2">
            
            {/* Logo & Clinic Info */}
            <a href="./" className="flex items-center gap-2.5 cursor-pointer text-inherit no-underline">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base sm:text-lg text-slate-900 leading-tight">
                    {clinicConfig.name}
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Online
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block truncate max-w-xs">
                  {clinicConfig.tagline}
                </p>
              </div>
            </a>

            {/* Quick Action Navigation */}
            <div className="flex items-center gap-2">
              
              {/* WhatsApp direct help pill */}
              {clinicConfig.whatsappNumber && (
                <a
                  id="btn-header-whatsapp"
                  href={`https://wa.me/${clinicConfig.whatsappCountryCode}${clinicConfig.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                  title="WhatsApp de Recepción"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-blue-600 fill-blue-600/20" />
                  <span>WhatsApp: +{clinicConfig.whatsappCountryCode} {clinicConfig.whatsappNumber}</span>
                </a>
              )}

              {/* Toggle Device Frame (Desktop only preview helper) */}
              {setIsMobileDeviceView && (
                <button
                  id="btn-toggle-device-frame"
                  onClick={() => setIsMobileDeviceView(!isMobileDeviceView)}
                  className={`hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isMobileDeviceView
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Simular pantalla de teléfono"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{isMobileDeviceView ? 'Marco Móvil' : 'Pantalla Completa'}</span>
                </button>
              )}

            </div>

          </div>
        </div>
      </header>
    </>
  );
};
