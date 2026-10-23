import React, { useState, useMemo } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Doctor, Specialty } from '../../types';
import { ArrowLeft, Calendar as CalendarIcon, Clock, Sun, Moon, AlertCircle, ChevronRight } from 'lucide-react';
import { formatTimePretty, formatDatePretty, calculateEndTime } from '../../utils/whatsapp';

interface DateTimeSelectorProps {
  specialty: Specialty;
  doctor: Doctor;
  onSelectDateTime: (date: string, time: string) => void;
  onBack: () => void;
  initialDate?: string;
  initialTime?: string;
}

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const monthNames = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  specialty,
  doctor,
  onSelectDateTime,
  onBack,
  initialDate,
  initialTime,
}) => {
  const { getAvailableSlotsForDoctor } = useClinic();

  // Generate the next 14 calendar days starting from today
  const upcomingDays = useMemo(() => {
    const list: {
      dateStr: string;
      dayOfWeek: number;
      dayName: string;
      dayNumber: number;
      monthName: string;
      isAvailable: boolean;
    }[] = [];

    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayOfWeek = d.getDay();

      const isAvailable = doctor.availableDays.includes(dayOfWeek);

      list.push({
        dateStr,
        dayOfWeek,
        dayName: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : dayNames[dayOfWeek],
        dayNumber: d.getDate(),
        monthName: monthNames[d.getMonth()],
        isAvailable,
      });
    }

    return list;
  }, [doctor]);

  // Default to first available day or initialDate
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate && upcomingDays.some(d => d.dateStr === initialDate && d.isAvailable)) {
      return initialDate;
    }
    const firstAvailable = upcomingDays.find(d => d.isAvailable);
    return firstAvailable ? firstAvailable.dateStr : upcomingDays[0]?.dateStr || '';
  });

  const [selectedTime, setSelectedTime] = useState<string>(initialTime || '');

  // Fetch real-time available time slots for the chosen doctor and date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableSlotsForDoctor(doctor.id, selectedDate);
  }, [doctor.id, selectedDate, getAvailableSlotsForDoctor]);

  // Group slots into Morning (< 13:00) and Afternoon (>= 13:00)
  const morningSlots = useMemo(() => {
    return availableSlots.filter(t => {
      const h = parseInt(t.split(':')[0], 10);
      return h < 13;
    });
  }, [availableSlots]);

  const afternoonSlots = useMemo(() => {
    return availableSlots.filter(t => {
      const h = parseInt(t.split(':')[0], 10);
      return h >= 13;
    });
  }, [availableSlots]);

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onSelectDateTime(selectedDate, selectedTime);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            id="btn-back-to-doctors"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cambiar médico</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Paso 3 de 4
          </span>
        </div>

        {/* Selected Doctor Summary Card */}
        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
          {doctor.photoUrl ? (
            <img
              src={doctor.photoUrl}
              alt={doctor.name}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover border border-blue-200 shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
              {doctor.name.slice(0, 2).toUpperCase() || 'DR'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {doctor.name}
            </h4>
            <p className="text-xs text-blue-700 font-medium truncate">
              {specialty.name} • {doctor.consultorio}
            </p>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-slate-900 pt-1">
          Elige la fecha y hora de tu cita
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Los horarios se actualizan en tiempo real para evitar cruces.
        </p>
      </div>

      {/* Date Carousel */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>1. Selecciona el Día de Consulta:</span>
        </label>

        {/* Horizontal scroll container */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
          {upcomingDays.map(item => {
            const isSelected = selectedDate === item.dateStr;
            const isDisabled = !item.isAvailable;

            return (
              <button
                key={item.dateStr}
                id={`date-pill-${item.dateStr}`}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  setSelectedDate(item.dateStr);
                  setSelectedTime(''); // Reset time selection on date change
                }}
                className={`flex flex-col items-center justify-center min-w-[64px] sm:min-w-[70px] py-2.5 px-2 rounded-xl border transition-all shrink-0 ${
                  isDisabled
                    ? 'opacity-40 bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700 hover:bg-blue-50/40'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isSelected ? 'text-blue-100' : 'text-slate-600'
                  }`}
                >
                  {item.dayName}
                </span>
                <span className="text-base sm:text-lg font-extrabold my-0.5">
                  {item.dayNumber}
                </span>
                <span
                  className={`text-[10px] font-medium ${
                    isSelected ? 'text-blue-100' : 'text-slate-600'
                  }`}
                >
                  {item.monthName}
                </span>
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <p className="text-xs text-slate-600 font-medium capitalize">
            📅 Fecha seleccionada: <span className="text-blue-700 font-bold">{formatDatePretty(selectedDate)}</span>
          </p>
        )}
      </div>

      {/* Time Slots Container */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>2. Horas Disponibles para este Día:</span>
          </label>
          <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
            Turnos de {doctor.slotDurationMinutes || 30} min
          </span>
        </div>

        {availableSlots.length === 0 ? (
          <div className="p-5 text-center bg-slate-50 rounded-xl border border-slate-200">
            <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1.5" />
            <h5 className="text-xs font-bold text-slate-800">
              No hay turnos disponibles para esta fecha
            </h5>
            <p className="text-xs text-slate-500 mt-0.5">
              Todos los horarios están reservados o el médico no atiende hoy. Por favor selecciona otro día en el calendario arriba.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Morning Slots */}
            {morningSlots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Turno Mañana ({morningSlots.length} disponibles)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {morningSlots.map(timeStr => {
                    const isSelected = selectedTime === timeStr;
                    const endTimeStr = calculateEndTime(timeStr, doctor.slotDurationMinutes || 30);
                    return (
                      <button
                        key={timeStr}
                        id={`time-slot-${timeStr}`}
                        type="button"
                        onClick={() => setSelectedTime(timeStr)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <span className="font-extrabold text-xs sm:text-sm">{formatTimePretty(timeStr)}</span>
                        <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-600'}`}>
                          hasta {formatTimePretty(endTimeStr)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Afternoon Slots */}
            {afternoonSlots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Turno Tarde ({afternoonSlots.length} disponibles)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {afternoonSlots.map(timeStr => {
                    const isSelected = selectedTime === timeStr;
                    const endTimeStr = calculateEndTime(timeStr, doctor.slotDurationMinutes || 30);
                    return (
                      <button
                        key={timeStr}
                        id={`time-slot-${timeStr}`}
                        type="button"
                        onClick={() => setSelectedTime(timeStr)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50'
                        }`}
                      >
                        <span className="font-extrabold text-xs sm:text-sm">{formatTimePretty(timeStr)}</span>
                        <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-600'}`}>
                          hasta {formatTimePretty(endTimeStr)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating or Bottom Continue Button */}
      <div className="pt-3 border-t border-slate-100">
        <button
          id="btn-confirm-datetime"
          type="button"
          disabled={!selectedDate || !selectedTime}
          onClick={handleContinue}
          className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
            selectedDate && selectedTime
              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          <span>
            {selectedTime
              ? `Continuar con ${formatDatePretty(selectedDate)} a las ${formatTimePretty(selectedTime)} (${doctor.slotDurationMinutes || 30} min)`
              : 'Selecciona una hora para continuar'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
