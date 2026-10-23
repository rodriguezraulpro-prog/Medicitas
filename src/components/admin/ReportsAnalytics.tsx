import React, { useState, useMemo } from 'react';
import { useClinic } from '../../context/ClinicContext';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle,
  Stethoscope,
  Building,
  Video,
} from 'lucide-react';

export const ReportsAnalytics: React.FC = () => {
  const { appointments, doctors, specialties, clinicConfig } = useClinic();
  const [period, setPeriod] = useState<'all' | 'month' | 'week' | 'today'>('all');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter appointments according to selected period
  const filteredAppointments = useMemo(() => {
    if (period === 'today') {
      return appointments.filter(a => a.date === todayStr);
    }
    if (period === 'week') {
      const now = new Date();
      return appointments.filter(a => {
        const d = new Date(a.date);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        return diffDays >= -7 && diffDays <= 7;
      });
    }
    if (period === 'month') {
      const now = new Date();
      const curMonth = now.getMonth();
      const curYear = now.getFullYear();
      return appointments.filter(a => {
        const d = new Date(a.date);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      });
    }
    return appointments;
  }, [appointments, period, todayStr]);

  // Key Metrics
  const totalCount = filteredAppointments.length;
  const attendedCount = filteredAppointments.filter(a => a.status === 'atendida').length;
  const confirmedCount = filteredAppointments.filter(a => a.status === 'confirmada').length;
  const pendingCount = filteredAppointments.filter(a => a.status === 'pendiente_whatsapp').length;
  const cancelledCount = filteredAppointments.filter(a => a.status === 'cancelada').length;

  const attendanceRate = totalCount > 0 ? Math.round((attendedCount / (totalCount - cancelledCount || 1)) * 100) : 0;

  // Revenues
  const earnedRevenue = filteredAppointments
    .filter(a => a.status === 'atendida')
    .reduce((sum, a) => sum + (a.fee || 0), 0);

  const projectedRevenue = filteredAppointments
    .filter(a => a.status !== 'cancelada')
    .reduce((sum, a) => sum + (a.fee || 0), 0);

  // Distribution by Specialty
  const specialtyStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};

    specialties.forEach(s => {
      map[s.id] = { name: s.name, count: 0, revenue: 0 };
    });

    filteredAppointments.forEach(a => {
      if (a.status !== 'cancelada') {
        if (!map[a.specialtyId]) {
          map[a.specialtyId] = { name: a.specialtyName, count: 0, revenue: 0 };
        }
        map[a.specialtyId].count += 1;
        map[a.specialtyId].revenue += a.fee || 0;
      }
    });

    return Object.values(map)
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [specialties, filteredAppointments]);

  // Distribution by Doctor
  const doctorStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; specialty: string; attended: number }> = {};

    doctors.forEach(d => {
      const spec = specialties.find(s => s.id === d.specialtyId);
      map[d.id] = { name: d.name, count: 0, specialty: spec?.name || '', attended: 0 };
    });

    filteredAppointments.forEach(a => {
      if (a.status !== 'cancelada') {
        if (!map[a.doctorId]) {
          map[a.doctorId] = { name: a.doctorName, count: 0, specialty: a.specialtyName, attended: 0 };
        }
        map[a.doctorId].count += 1;
        if (a.status === 'atendida') {
          map[a.doctorId].attended += 1;
        }
      }
    });

    return Object.values(map)
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [doctors, specialties, filteredAppointments]);

  // Peak hours distribution (08:00 to 19:00)
  const hourlyStats = useMemo(() => {
    const hours: { hour: string; label: string; count: number }[] = [];
    for (let h = 8; h <= 19; h++) {
      const hourStr = h.toString().padStart(2, '0');
      const label = `${h > 12 ? h - 12 : h} ${h >= 12 ? 'PM' : 'AM'}`;
      const count = filteredAppointments.filter(
        a => a.time.startsWith(hourStr) && a.status !== 'cancelada'
      ).length;
      hours.push({ hour: hourStr, label, count });
    }
    return hours;
  }, [filteredAppointments]);

  const maxHourCount = Math.max(...hourlyStats.map(h => h.count), 1);

  // Modality stats
  const presencialCount = filteredAppointments.filter(
    a => a.type === 'presencial' && a.status !== 'cancelada'
  ).length;
  const teleconsultaCount = filteredAppointments.filter(
    a => a.type === 'teleconsulta' && a.status !== 'cancelada'
  ).length;

  return (
    <div className="space-y-4">
      {/* Header with period toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Reportes de Atención en Tiempo Real
            </h3>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Estadísticas clínicas actualizadas al instante con cada cita enviada por WhatsApp o registrada en recepción.
          </p>
        </div>

        {/* Period toggle buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'month', label: 'Este Mes' },
            { id: 'week', label: 'Esta Semana' },
            { id: 'today', label: 'Hoy' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                period === p.id
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Citas */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Citas</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="font-bold text-blue-600">{attendedCount}</span> atendidas • <span className="font-bold text-amber-600">{pendingCount}</span> pendientes
          </div>
        </div>

        {/* Tasa de Atención */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Tasa de Atención</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {attendanceRate}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(attendanceRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Ingresos Cobrados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Ingresos Cobrados</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">
            {clinicConfig.currencySymbol}{earnedRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            De {attendedCount} consultas completadas
          </div>
        </div>

        {/* Ingresos Proyectados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Proyectado</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {clinicConfig.currencySymbol}{projectedRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Incluye citas confirmadas y pendientes
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Chart 1: Especialidades más solicitadas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Demanda por Especialidad Médica
              </h4>
              <p className="text-xs text-slate-500">
                Distribución de citas activas por área
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {specialtyStats.map(item => {
              const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{item.name}</span>
                    <span className="font-bold text-slate-600">
                      {item.count} citas ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {specialtyStats.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                No hay datos en el período seleccionado.
              </p>
            )}
          </div>
        </div>

        {/* Chart 2: Desempeño y volumen por Médico */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                Volumen de Atención por Médico
              </h4>
              <p className="text-xs text-slate-500">
                Citas agendadas y atendidas por profesional
              </p>
            </div>
            <Stethoscope className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {doctorStats.map(doc => {
              const maxDocsCount = Math.max(...doctorStats.map(d => d.count), 1);
              const barWidth = Math.round((doc.count / maxDocsCount) * 100);

              return (
                <div key={doc.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{doc.name}</span>
                      <span className="text-[11px] text-slate-500 ml-1.5">({doc.specialty})</span>
                    </div>
                    <span className="font-bold text-slate-700">
                      {doc.count} citas ({doc.attended} atendidas)
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {doctorStats.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                No hay médicos con citas en este rango.
              </p>
            )}
          </div>
        </div>

        {/* Chart 3: Horas Pico (Histograma de 08:00 a 19:00) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              Horarios con Mayor Demanda (Horas Pico)
            </h4>
            <p className="text-xs text-slate-500">
              Distribución de citas agendadas a lo largo de la jornada
            </p>
          </div>

          <div className="flex items-end justify-between gap-1 h-36 pt-4 border-b border-slate-100">
            {hourlyStats.map(h => {
              const heightPct = Math.round((h.count / maxHourCount) * 100);

              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                    {h.count} {h.count === 1 ? 'cita' : 'citas'}
                  </div>

                  <div className="w-full max-w-[18px] bg-slate-100 rounded-t-md h-24 flex items-end">
                    <div
                      className="w-full bg-blue-600 hover:bg-blue-500 rounded-t-md transition-all duration-300"
                      style={{ height: `${Math.max(heightPct, h.count > 0 ? 10 : 0)}%` }}
                    />
                  </div>

                  <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                    {h.hour}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 4: Estado y Modalidad */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              Estado de Reservas & Modalidad
            </h4>
            <p className="text-xs text-slate-500">
              Seguimiento operativo y formato de consulta
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Modalidad Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Modalidad de Consulta
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Building className="w-3.5 h-3.5 text-blue-600" />
                    Presencial:
                  </span>
                  <span className="font-bold text-slate-800">{presencialCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Video className="w-3.5 h-3.5 text-indigo-600" />
                    Teleconsulta:
                  </span>
                  <span className="font-bold text-slate-800">{teleconsultaCount}</span>
                </div>
              </div>
            </div>

            {/* Status breakdown */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Desglose por Estado
              </span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700 font-semibold">• Confirmadas:</span>
                  <span className="font-bold text-slate-800">{confirmedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-700 font-semibold">• Por WhatsApp:</span>
                  <span className="font-bold text-slate-800">{pendingCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 font-semibold">• Atendidas:</span>
                  <span className="font-bold text-slate-800">{attendedCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-rose-700 font-semibold">• Canceladas:</span>
                  <span className="font-bold text-slate-800">{cancelledCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
