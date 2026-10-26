import React, { useState, useRef } from 'react';
import { useClinic } from '../../context/ClinicContext';
import { Doctor, Specialty } from '../../types';
import { SpecialtyIcon } from '../common/SpecialtyIcon';
import {
  UserPlus,
  Edit2,
  Clock,
  Calendar,
  DollarSign,
  MapPin,
  CheckCircle,
  XCircle,
  Plus,
  Stethoscope,
  Save,
  X,
  Sparkles,
  Trash2,
  AlertTriangle,
  Upload,
  Camera,
  Link as LinkIcon,
} from 'lucide-react';
import { uploadDoctorPhoto } from '../../utils/imageUpload';

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const calculateNextSlot = (start: string, duration: number): string => {
  if (!start) return '';
  const [hStr, mStr] = start.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const total = h * 60 + m + (duration || 30);
  const nextH = Math.floor(total / 60) % 24;
  const nextM = total % 60;
  return `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;
};

export const DoctorsManager: React.FC = () => {
  const {
    doctors,
    specialties,
    appointments,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    toggleDoctorActive,
    addSpecialty,
    updateSpecialty,
    deleteSpecialty,
    clinicConfig,
  } = useClinic();

  const [activeTab, setActiveTab] = useState<'doctors' | 'specialties'>('doctors');

  // Deletion confirmation dialog states
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [specialtyToDelete, setSpecialtyToDelete] = useState<Specialty | null>(null);

  // Doctor modal states
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docSpecialtyId, setDocSpecialtyId] = useState('');
  const [docConsultorio, setDocConsultorio] = useState('');
  const [docFee, setDocFee] = useState(40);
  const [docPhoto, setDocPhoto] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [photoInputMode, setPhotoInputMode] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docStartHour, setDocStartHour] = useState('09:00');
  const [docEndHour, setDocEndHour] = useState('18:00');
  const [docDuration, setDocDuration] = useState<number>(30);
  const [docDays, setDocDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Specialty modal states
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [specName, setSpecName] = useState('');
  const [specDesc, setSpecDesc] = useState('');
  const [specIcon, setSpecIcon] = useState('Stethoscope');

  const processSelectedFile = async (file: File) => {
    // Validate image file type
    if (!file.type.startsWith('image/')) {
      setPhotoError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoError('');

    try {
      const result = await uploadDoctorPhoto(file, editingDoctorId || undefined);
      setDocPhoto(result.url);
      setPhotoSizeKb(result.sizeKb);
    } catch (err: any) {
      console.error('Error al subir foto:', err);
      setPhotoError(err.message || 'Error al procesar la imagen seleccionada.');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const openNewDoctorModal = () => {
    if (specialties.length === 0) {
      setActiveTab('specialties');
      openNewSpecModal();
      return;
    }
    setEditingDoctorId(null);
    setDocName('');
    setDocSpecialtyId(specialties[0]?.id || '');
    setDocConsultorio('Consultorio 101');
    setDocFee(40);
    setDocPhoto('');
    setPhotoError('');
    setPhotoSizeKb(null);
    setIsDraggingPhoto(false);
    setIsProcessingPhoto(false);
    setPhotoInputMode('upload');
    setDocStartHour('09:00');
    setDocEndHour('18:00');
    setDocDuration(clinicConfig.defaultSlotDurationMinutes || 30);
    setDocDays([1, 2, 3, 4, 5]);
    setShowDoctorModal(true);
  };

  const openEditDoctorModal = (doc: Doctor) => {
    setEditingDoctorId(doc.id);
    setDocName(doc.name);
    setDocSpecialtyId(doc.specialtyId);
    setDocConsultorio(doc.consultorio);
    setDocFee(doc.fee);
    setDocPhoto(doc.photoUrl || '');
    setPhotoError('');
    setPhotoSizeKb(null);
    setIsDraggingPhoto(false);
    setIsProcessingPhoto(false);
    setPhotoInputMode(doc.photoUrl?.startsWith('http') && !doc.photoUrl.includes('supabase.co') ? 'url' : 'upload');
    setDocStartHour(doc.startHour);
    setDocEndHour(doc.endHour);
    setDocDuration(doc.slotDurationMinutes || 30);
    setDocDays(doc.availableDays);
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    if (editingDoctorId) {
      updateDoctor(editingDoctorId, {
        name: docName.trim(),
        specialtyId: docSpecialtyId,
        consultorio: docConsultorio.trim(),
        fee: Number(docFee),
        photoUrl: docPhoto.trim(),
        startHour: docStartHour,
        endHour: docEndHour,
        slotDurationMinutes: Number(docDuration) || 30,
        availableDays: docDays,
      });
    } else {
      addDoctor({
        name: docName.trim(),
        specialtyId: docSpecialtyId,
        consultorio: docConsultorio.trim(),
        fee: Number(docFee),
        rating: 5.0,
        availableDays: docDays,
        startHour: docStartHour,
        endHour: docEndHour,
        slotDurationMinutes: Number(docDuration) || 30,
        active: true,
        photoUrl: docPhoto.trim(),
      });
    }

    setShowDoctorModal(false);
  };

  const toggleDaySelection = (dayIndex: number) => {
    if (docDays.includes(dayIndex)) {
      if (docDays.length > 1) {
        setDocDays(docDays.filter(d => d !== dayIndex));
      }
    } else {
      setDocDays([...docDays, dayIndex].sort());
    }
  };

  const openNewSpecModal = () => {
    setEditingSpecId(null);
    setSpecName('');
    setSpecDesc('');
    setSpecIcon('Stethoscope');
    setShowSpecModal(true);
  };

  const openEditSpecModal = (spec: Specialty) => {
    setEditingSpecId(spec.id);
    setSpecName(spec.name);
    setSpecDesc(spec.description);
    setSpecIcon(spec.iconName);
    setShowSpecModal(true);
  };

  const handleSaveSpec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specName.trim()) return;

    if (editingSpecId) {
      updateSpecialty(editingSpecId, {
        name: specName.trim(),
        description: specDesc.trim(),
        iconName: specIcon,
      });
    } else {
      addSpecialty({
        name: specName.trim(),
        description: specDesc.trim(),
        iconName: specIcon,
        color: 'emerald',
        active: true,
      });
    }

    setShowSpecModal(false);
  };

  const handleConfirmDeleteDoctor = () => {
    if (!doctorToDelete) return;
    deleteDoctor(doctorToDelete.id);
    if (editingDoctorId === doctorToDelete.id) {
      setShowDoctorModal(false);
      setEditingDoctorId(null);
    }
    setDoctorToDelete(null);
  };

  const handleConfirmDeleteSpecialty = () => {
    if (!specialtyToDelete) return;
    deleteSpecialty(specialtyToDelete.id);
    if (editingSpecId === specialtyToDelete.id) {
      setShowSpecModal(false);
      setEditingSpecId(null);
    }
    setSpecialtyToDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Tab switch bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('doctors')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'doctors'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Médicos ({doctors.length})
          </button>
          <button
            onClick={() => setActiveTab('specialties')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'specialties'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Especialidades ({specialties.length})
          </button>
        </div>

        {activeTab === 'doctors' ? (
          <button
            id="btn-admin-add-doctor"
            onClick={openNewDoctorModal}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Agregar Nuevo Médico</span>
          </button>
        ) : (
          <button
            id="btn-admin-add-specialty"
            onClick={openNewSpecModal}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Especialidad</span>
          </button>
        )}
      </div>

      {/* Tab 1: Doctors List */}
      {activeTab === 'doctors' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {doctors.map(doctor => {
            const spec = specialties.find(s => s.id === doctor.specialtyId);

            return (
              <div
                key={doctor.id}
                id={`admin-doctor-${doctor.id}`}
                className={`p-4 rounded-2xl border transition-all bg-white shadow-xs space-y-3 ${
                  doctor.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {doctor.photoUrl ? (
                      <img
                        src={doctor.photoUrl}
                        alt={doctor.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200 shrink-0">
                        {doctor.name.slice(0, 2).toUpperCase() || 'DR'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        {doctor.name}
                      </h4>
                      <p className="text-xs text-blue-700 font-medium">
                        {spec?.name || 'Sin especialidad'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {doctor.consultorio}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      doctor.active
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {doctor.active ? 'Activo' : 'Pausado'}
                  </span>
                </div>

                {/* Hours & Fee */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-600 block">Horario atención:</span>
                    <span className="font-semibold text-slate-800">
                      {doctor.startHour} - {doctor.endHour}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block">Tarifa por cita:</span>
                    <span className="font-bold text-slate-900">
                      {clinicConfig.currencySymbol}{doctor.fee}
                    </span>
                  </div>
                </div>

                {/* Consultation Duration Pill */}
                <div
                  onClick={() => openEditDoctorModal(doctor)}
                  className="flex items-center justify-between text-xs bg-blue-50/70 hover:bg-blue-100/80 px-2.5 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer group"
                  title="Haz clic para personalizar la duración de la consulta e intervalo de horarios"
                >
                  <span className="text-[11px] text-blue-900 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Intervalo de consulta:</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs group-hover:border-blue-400">
                    <span>{doctor.slotDurationMinutes || 30} min</span>
                    <Edit2 className="w-2.5 h-2.5 text-blue-500" />
                  </span>
                </div>

                {/* Days */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-600 mr-1">Días:</span>
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const works = doctor.availableDays.includes(d);
                    return (
                      <span
                        key={d}
                        className={`w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center ${
                          works
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-300'
                        }`}
                      >
                        {dayNames[d][0]}
                      </span>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => toggleDoctorActive(doctor.id)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {doctor.active ? 'Pausar disponibilidad' : 'Activar médico'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditDoctorModal(doctor)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => setDoctorToDelete(doctor)}
                      className="p-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer"
                      title="Eliminar médico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {doctors.length === 0 && (
            <div className="col-span-full py-12 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Aún no hay médicos registrados</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {specialties.length === 0
                    ? 'Primero debes crear al menos una especialidad médica antes de registrar a los doctores.'
                    : 'Registra a tus médicos, consultorios, tarifas y horarios para comenzar a recibir citas.'}
                </p>
              </div>
              <div>
                {specialties.length === 0 ? (
                  <button
                    onClick={() => setActiveTab('specialties')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Primera Especialidad</span>
                  </button>
                ) : (
                  <button
                    onClick={openNewDoctorModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Agregar Primer Médico</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Specialties List */}
      {activeTab === 'specialties' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {specialties.map(spec => {
            const docCount = doctors.filter(d => d.specialtyId === spec.id).length;

            return (
              <div
                key={spec.id}
                id={`admin-specialty-${spec.id}`}
                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <SpecialtyIcon name={spec.iconName} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {spec.name}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {spec.description}
                    </p>
                    <span className="text-[11px] font-semibold text-blue-700 mt-1 inline-block">
                      {docCount} {docCount === 1 ? 'médico asignado' : 'médicos asignados'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditSpecModal(spec)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Editar especialidad"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSpecialtyToDelete(spec)}
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Eliminar especialidad"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {specialties.length === 0 && (
            <div className="col-span-full py-12 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-200">
                <Plus className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Aún no hay especialidades creadas</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Crea las áreas de atención clínica de tu consultorio (ej. Medicina General, Odontología, Pediatría...).
                </p>
              </div>
              <div>
                <button
                  onClick={openNewSpecModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear Nueva Especialidad</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Doctor Add / Edit Modal */}
      {showDoctorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4">
          <div className="bg-white max-w-lg w-full my-auto rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header: Siempre visible en la parte superior */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3.5 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                    {editingDoctorId ? 'Editar Médico y Horarios' : 'Agregar Nuevo Médico'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingDoctorId ? 'Actualiza los datos y la agenda del profesional' : 'Completa los datos del médico para habilitar sus citas'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDoctorModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Cuerpo del Formulario con Desplazamiento Táctil Fluido en Celular */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs touch-pan-y">
                {/* Nombre del Médico (Primer campo, siempre visible al abrir) */}
                <div className="space-y-1.5 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
                  <label className="font-bold text-slate-800 block text-xs flex items-center justify-between">
                    <span>Nombre Completo del Médico:</span>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-100/70 px-2 py-0.5 rounded-md">* Obligatorio</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ej. Dr. Andrés Soto"
                    value={docName}
                    onChange={e => setDocName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-500">
                    Este nombre se mostrará a los pacientes al reservar su turno.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Especialidad:</label>
                    <select
                      value={docSpecialtyId}
                      onChange={e => setDocSpecialtyId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                    >
                      {specialties.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Tarifa Consulta ({clinicConfig.currencySymbol}):</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={docFee}
                      onChange={e => setDocFee(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Consultorio / Ubicación:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Consultorio 204 (Piso 2)"
                    value={docConsultorio}
                    onChange={e => setDocConsultorio(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                {/* Working Hours */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Hora Inicio:</label>
                    <input
                      type="time"
                      required
                      value={docStartHour}
                      onChange={e => setDocStartHour(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Hora Fin:</label>
                    <input
                      type="time"
                      required
                      value={docEndHour}
                      onChange={e => setDocEndHour(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Consultation Duration / Slot Interval Customization */}
                <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Duración de la Consulta (Intervalo):</span>
                    </label>
                    <span className="font-extrabold text-xs text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                      {docDuration} min
                    </span>
                  </div>

                  {/* Quick preset buttons */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[15, 20, 30, 40, 45, 60].map(mins => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDocDuration(mins)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                          docDuration === mins
                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50/70 hover:border-blue-300'
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>

                  {/* Custom duration input */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-slate-600 font-semibold text-[11px]">Otro intervalo:</span>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      required
                      value={docDuration}
                      onChange={e => setDocDuration(Math.max(5, Number(e.target.value)))}
                      className="w-20 px-2 py-1 bg-white rounded-lg border border-slate-300 text-xs text-center font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-500 text-[11px]">minutos por paciente</span>
                  </div>

                  <div className="p-2 bg-white rounded-xl border border-blue-100 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Ejemplo de horarios generados:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {docStartHour} → {calculateNextSlot(docStartHour, docDuration)} → {calculateNextSlot(calculateNextSlot(docStartHour, docDuration), docDuration)}...
                    </span>
                  </div>
                </div>

                {/* Working Days */}
                <div className="space-y-1 pt-1">
                  <label className="font-bold text-slate-700 block">
                    Días de Atención Semanal:
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[0, 1, 2, 3, 4, 5, 6].map(d => {
                      const isSelected = docDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDaySelection(d)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {dayNames[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Doctor Photo Section with Direct File Upload & URL Option */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-blue-600" />
                      <span>Foto del Médico (Subir Archivo):</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setPhotoInputMode(photoInputMode === 'upload' ? 'url' : 'upload')}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {photoInputMode === 'upload' ? (
                        <>
                          <LinkIcon className="w-3 h-3" />
                          <span>O pegar enlace URL web</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3" />
                          <span>O subir archivo desde celular (Recomendado)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Hidden native file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {docPhoto ? (
                    /* Preview with Remove / Change actions */
                    <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="relative shrink-0">
                        <img
                          src={docPhoto}
                          alt="Vista previa del médico"
                          className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-500/30 shadow-xs bg-white"
                          onError={() => setPhotoError('No se pudo cargar la vista previa de la imagen.')}
                        />
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] ring-2 ring-white font-bold">
                          ✓
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            Foto lista para guardar
                          </span>
                          {photoSizeKb && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {photoSizeKb} KB
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-600 block truncate">
                          {docPhoto.startsWith('data:')
                            ? '📁 Archivo local optimizado (< 50KB)'
                            : docPhoto.includes('doctor-photos')
                            ? '☁️ Alojada en Almacenamiento en la Nube (doctor-photos)'
                            : '🌐 Enlace web externo'}
                        </span>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessingPhoto}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-blue-600 border border-slate-200 shadow-2xs cursor-pointer flex items-center gap-1 transition-colors"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Cambiar archivo</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDocPhoto('');
                              setPhotoSizeKb(null);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Quitar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : photoInputMode === 'upload' ? (
                    /* Upload Zone with Drag & Drop */
                    <div
                      onDragOver={e => {
                        e.preventDefault();
                        setIsDraggingPhoto(true);
                      }}
                      onDragLeave={() => setIsDraggingPhoto(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDraggingPhoto(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) processSelectedFile(file);
                      }}
                      onClick={() => !isProcessingPhoto && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                        isDraggingPhoto
                          ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/20'
                          : isProcessingPhoto
                          ? 'border-blue-400 bg-blue-50/50 cursor-wait'
                          : 'border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 bg-slate-50/60'
                      }`}
                    >
                      {isProcessingPhoto ? (
                        <div className="space-y-2 py-2">
                          <div className="w-8 h-8 mx-auto border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-bold text-blue-700 block">
                            Optimizando y subiendo archivo...
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Comprimiendo a WebP liviano para carga instantánea
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-2xs border border-blue-100">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Haz clic o arrastra aquí la foto del médico
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              Sube directamente un archivo JPG, PNG o WebP desde tu celular o computadora
                            </span>
                          </div>

                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Elegir Archivo / Tomar Foto</span>
                            </button>
                          </div>

                          <div className="pt-1 flex items-center justify-center gap-2 text-[10px] text-slate-500 font-medium">
                            <span>✓ Compatible con Almacenamiento en la Nube</span>
                            <span>•</span>
                            <span>✓ Compresión automática &lt;50KB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* URL Input */
                    <div className="space-y-1">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={docPhoto}
                        onChange={e => setDocPhoto(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                      />
                      <span className="text-[11px] text-slate-500 block">
                        Pega la dirección URL de una imagen web existente (ej. Unsplash, web de la clínica).
                      </span>
                    </div>
                  )}

                  {photoError && (
                    <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                      {photoError}
                    </p>
                  )}
                </div>
              </div>

              {/* Pie de acciones (Footer) Fijo abajo con botones siempre al alcance */}
              <div className="shrink-0 bg-slate-50 border-t border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
                {editingDoctorId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const doc = doctors.find(d => d.id === editingDoctorId);
                      if (doc) setDoctorToDelete(doc);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Eliminar Médico</span>
                    <span className="sm:hidden">Eliminar</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDoctorModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs text-xs transition-colors"
                  >
                    {editingDoctorId ? 'Guardar Cambios' : 'Guardar Médico'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Specialty Modal */}
      {showSpecModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4">
          <div className="bg-white max-w-md w-full my-auto rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3.5 shrink-0 bg-white">
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                {editingSpecId ? 'Editar Especialidad' : 'Nueva Especialidad'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSpecModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpec} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5 text-xs touch-pan-y">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Nombre:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Neurología"
                    value={specName}
                    onChange={e => setSpecName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Descripción breve:</label>
                  <textarea
                    rows={2}
                    placeholder="Ej. Diagnóstico y tratamiento del sistema nervioso..."
                    value={specDesc}
                    onChange={e => setSpecDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs resize-none bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Ícono:</label>
                  <select
                    value={specIcon}
                    onChange={e => setSpecIcon(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="Stethoscope">Stethoscope (Estetoscopio)</option>
                    <option value="Baby">Baby (Pediatría)</option>
                    <option value="HeartPulse">HeartPulse (Cardiología)</option>
                    <option value="Smile">Smile (Odontología)</option>
                    <option value="Sparkles">Sparkles (Dermatología)</option>
                    <option value="Users">Users (Ginecología)</option>
                    <option value="Activity">Activity (Traumatología)</option>
                    <option value="Eye">Eye (Oftalmología)</option>
                    <option value="Brain">Brain (Neurología)</option>
                    <option value="Bone">Bone (Ortopedia)</option>
                    <option value="Pill">Pill (Farmacia)</option>
                  </select>
                </div>
              </div>

              <div className="shrink-0 bg-slate-50 border-t border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
                {editingSpecId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const sp = specialties.find(s => s.id === editingSpecId);
                      if (sp) setSpecialtyToDelete(sp);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Especialidad</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSpecModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer text-xs transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-xs text-xs transition-colors"
                  >
                    Guardar Especialidad
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Deletion Confirmation Dialog */}
      {doctorToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">¿Eliminar Médico?</h3>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center gap-2.5">
                {doctorToDelete.photoUrl ? (
                  <img
                    src={doctorToDelete.photoUrl}
                    alt={doctorToDelete.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {doctorToDelete.name.slice(0, 2).toUpperCase() || 'DR'}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900">{doctorToDelete.name}</h4>
                  <p className="text-slate-500 text-[11px]">
                    {specialties.find(s => s.id === doctorToDelete.specialtyId)?.name || 'Sin especialidad'} • {doctorToDelete.consultorio}
                  </p>
                </div>
              </div>

              {appointments.filter(a => a.doctorId === doctorToDelete.id && a.status !== 'cancelada').length > 0 && (
                <div className="p-2.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-[11px] flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Este médico tiene <strong>{appointments.filter(a => a.doctorId === doctorToDelete.id && a.status !== 'cancelada').length} cita(s) activa(s)</strong>. Si lo eliminas, los turnos se retirarán de la agenda.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDoctorToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDoctor}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar Médico</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specialty Deletion Confirmation Dialog */}
      {specialtyToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">¿Eliminar Especialidad?</h3>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                  <SpecialtyIcon name={specialtyToDelete.iconName} className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{specialtyToDelete.name}</h4>
                  <p className="text-slate-500 text-[11px]">{specialtyToDelete.description || 'Sin descripción'}</p>
                </div>
              </div>

              {doctors.filter(d => d.specialtyId === specialtyToDelete.id).length > 0 && (
                <div className="p-2.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-[11px] flex items-start gap-1.5 mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Hay <strong>{doctors.filter(d => d.specialtyId === specialtyToDelete.id).length} médico(s)</strong> con esta especialidad asignada. Al eliminarla, deberás reasignarlos a otra área médica.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSpecialtyToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSpecialty}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar Especialidad</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
