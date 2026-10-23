import React from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Doctor, Specialty } from '../../types';
import { SpecialtyIcon } from '../common/SpecialtyIcon';
import { ArrowLeft, Star, MapPin, Calendar, Clock, DollarSign, ChevronRight } from 'lucide-react';

interface DoctorSelectorProps {
  specialty: Specialty;
  onSelectDoctor: (doctor: Doctor) => void;
  onBack: () => void;
  selectedDoctorId?: string;
}

const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DoctorSelector: React.FC<DoctorSelectorProps> = ({
  specialty,
  onSelectDoctor,
  onBack,
  selectedDoctorId,
}) => {
  const { doctors, clinicConfig } = useClinic();

  const availableDoctors = doctors.filter(
    d => d.specialtyId === specialty.id && d.active
  );

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            id="btn-back-to-specialties"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cambiar especialidad</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Paso 2 de 4
          </span>
        </div>

        {/* Selected Specialty Badge */}
        <div className="flex items-center gap-2.5 p-2.5 bg-blue-50/70 rounded-xl border border-blue-200">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <SpecialtyIcon name={specialty.iconName} className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider">
              Especialidad elegida:
            </span>
            <p className="text-xs sm:text-sm font-semibold text-slate-900">
              {specialty.name}
            </p>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-slate-900 pt-1">
          Elige a tu especialista médico
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Selecciona el profesional con quien deseas agendar tu consulta.
        </p>
      </div>

      {/* Doctor Cards */}
      <div className="grid grid-cols-1 gap-3">
        {availableDoctors.map(doctor => {
          const isSelected = selectedDoctorId === doctor.id;

          return (
            <div
              key={doctor.id}
              id={`doctor-card-${doctor.id}`}
              className={`p-4 rounded-2xl border transition-all duration-150 bg-white ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-slate-200 hover:border-blue-300 hover:shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Doctor Avatar & Info */}
                <div className="flex items-start gap-3.5">
                  <div className="relative shrink-0">
                    {doctor.photoUrl ? (
                      <img
                        src={doctor.photoUrl}
                        alt={doctor.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-blue-100 shadow-xs"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-100 text-blue-700 font-extrabold text-base sm:text-lg flex items-center justify-center border-2 border-blue-200 shadow-xs">
                        {doctor.name.slice(0, 2).toUpperCase() || 'DR'}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-0.5 rounded-full ring-2 ring-white">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {doctor.name}
                      </h3>
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {doctor.rating}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>{doctor.slotDurationMinutes || 30} min</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{doctor.consultorio}</span>
                    </p>

                    {/* Available Days and Hours */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="text-[11px] text-slate-600 font-medium">
                        {doctor.startHour} - {doctor.endHour}
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1">
                        {doctor.availableDays.map(d => (
                          <span
                            key={d}
                            className="px-1 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700"
                          >
                            {dayNamesShort[d]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price & Selection Action */}
                <div className="flex items-center sm:flex-col justify-between sm:items-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-600 font-medium block">
                      Consulta
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-900">
                      {clinicConfig.currencySymbol}{doctor.fee}
                    </span>
                  </div>

                  <button
                    id={`btn-select-doctor-${doctor.id}`}
                    onClick={() => onSelectDoctor(doctor)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    <span>Elegir Horario</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {availableDoctors.length === 0 && (
          <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs text-slate-500">
              No hay médicos activos asignados actualmente a esta especialidad.
            </p>
            <button
              onClick={onBack}
              className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
            >
              Volver y seleccionar otra especialidad
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
