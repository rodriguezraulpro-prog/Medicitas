import React, { useState } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Specialty } from '../../types';
import { SpecialtyIcon } from '../common/SpecialtyIcon';
import { Search, ChevronRight, Sparkles } from 'lucide-react';

interface SpecialtySelectorProps {
  onSelectSpecialty: (specialty: Specialty) => void;
  selectedSpecialtyId?: string;
}

export const SpecialtySelector: React.FC<SpecialtySelectorProps> = ({
  onSelectSpecialty,
  selectedSpecialtyId,
}) => {
  const { specialties, doctors } = useClinic();
  const [searchTerm, setSearchTerm] = useState('');

  const activeSpecialties = specialties.filter(s => s.active);

  const filtered = activeSpecialties.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDoctorCount = (specialtyId: string) => {
    return doctors.filter(d => d.specialtyId === specialtyId && d.active).length;
  };

  return (
    <div className="space-y-4">
      {/* Search and Guidance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Paso 1 de 4
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {activeSpecialties.length} especialidades disponibles
          </span>
        </div>
        
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
          ¿Qué especialidad médica necesitas?
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Selecciona el área de atención para ver los especialistas y horarios disponibles.
        </p>

        {/* Search input */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-specialty"
            type="text"
            placeholder="Buscar especialidad (ej. Cardiología, Pediatría, Dental...)"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Grid of specialties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {filtered.map(specialty => {
          const docCount = getDoctorCount(specialty.id);
          const isSelected = selectedSpecialtyId === specialty.id;

          return (
            <button
              key={specialty.id}
              id={`specialty-card-${specialty.id}`}
              onClick={() => onSelectSpecialty(specialty)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3 group relative overflow-hidden ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/70 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-100/70 text-blue-800'
                  }`}
                >
                  <SpecialtyIcon name={specialty.iconName} className="w-5 h-5" />
                </div>
                
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {specialty.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {specialty.description}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
                    <span className="font-medium text-blue-700">
                      {docCount} {docCount === 1 ? 'médico disponible' : 'médicos disponibles'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="self-center text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all">
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}

        {activeSpecialties.length === 0 ? (
          <div className="col-span-full py-12 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Sistema listo para configurar desde cero
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Aún no hay especialidades ni médicos registrados. Puedes ingresar al panel administrativo para agregar tus primeras especialidades, médicos y horarios de atención.
              </p>
            </div>
            <div>
              <a
                href="./admin.html"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Ir al Panel Administrativo</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500">
              No encontramos especialidades con "{searchTerm}".
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
