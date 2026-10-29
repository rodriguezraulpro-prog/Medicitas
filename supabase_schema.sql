-- ==============================================================
-- MEDICITAS - ESQUEMA DE BASE DE DATOS EN LA NUBE (POSTGRESQL)
-- Instrucciones para clonar en un nuevo consultorio / clínica:
-- 1. Crea un nuevo proyecto en tu proveedor de Base de Datos en la Nube.
-- 2. En el panel izquierdo ve a "SQL Editor" -> "New query".
-- 3. Pega todo este archivo y presiona "Run" (ejecutar).
-- 4. En Settings -> API copia:
--      - Project URL
--      - anon public key
-- 5. Pégalas directamente en la sección "Base de Datos (Nube)" del Panel de Administración.
-- ==============================================================

-- 1. Tabla de Configuración de la Clínica
CREATE TABLE IF NOT EXISTS public.clinic_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL DEFAULT 'Mi Consultorio Médico',
    tagline TEXT DEFAULT 'Gestión y Reserva Médica por WhatsApp',
    phone TEXT DEFAULT '',
    whatsapp_country_code TEXT DEFAULT '',
    whatsapp_number TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    currency_symbol TEXT DEFAULT '$',
    welcome_message TEXT DEFAULT 'Te damos la bienvenida a nuestro sistema de reservas por WhatsApp. Selecciona tu especialidad y horario para agendar tu cita.',
    open_days_text TEXT DEFAULT 'Lunes a Sábado',
    admin_pin TEXT DEFAULT 'enc:eaca5e7d984d326d',
    default_slot_duration_minutes INTEGER DEFAULT 30,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Especialidades
CREATE TABLE IF NOT EXISTS public.specialties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon_name TEXT DEFAULT 'Stethoscope',
    color TEXT DEFAULT 'blue',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Médicos y Especialistas
CREATE TABLE IF NOT EXISTS public.doctors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty_id TEXT REFERENCES public.specialties(id) ON DELETE SET NULL,
    photo_url TEXT DEFAULT '',
    consultorio TEXT DEFAULT '',
    fee NUMERIC DEFAULT 0,
    rating NUMERIC DEFAULT 5.0,
    available_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    start_hour TEXT DEFAULT '08:00',
    end_hour TEXT DEFAULT '18:00',
    slot_duration_minutes INTEGER DEFAULT 30,
    lunch_start TEXT,
    lunch_end TEXT,
    active BOOLEAN DEFAULT TRUE,
    phone TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Citas Médicas
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    patient_email TEXT,
    patient_dni TEXT,
    reason TEXT DEFAULT '',
    type TEXT DEFAULT 'presencial',
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    doctor_id TEXT REFERENCES public.doctors(id) ON DELETE CASCADE,
    doctor_name TEXT NOT NULL,
    specialty_id TEXT,
    specialty_name TEXT DEFAULT '',
    status TEXT DEFAULT 'pendiente_whatsapp',
    created_at TEXT DEFAULT NOW()::TEXT,
    fee NUMERIC DEFAULT 0,
    consultorio TEXT DEFAULT '',
    notes TEXT,
    cancellation_reason TEXT,
    cancelled_by TEXT,
    cancelled_at TEXT
);

-- 5. Tabla de Horarios Bloqueados / Vacaciones
CREATE TABLE IF NOT EXISTS public.blocked_slots (
    id TEXT PRIMARY KEY,
    doctor_id TEXT REFERENCES public.doctors(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_phone ON public.appointments(patient_phone);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON public.doctors(specialty_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.clinic_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- Políticas para acceso anónimo de la app
DROP POLICY IF EXISTS "Anon public access to clinic_config" ON public.clinic_config;
CREATE POLICY "Anon public access to clinic_config" ON public.clinic_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access to specialties" ON public.specialties;
CREATE POLICY "Anon public access to specialties" ON public.specialties FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access to doctors" ON public.doctors;
CREATE POLICY "Anon public access to doctors" ON public.doctors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access to appointments" ON public.appointments;
CREATE POLICY "Anon public access to appointments" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon public access to blocked_slots" ON public.blocked_slots;
CREATE POLICY "Anon public access to blocked_slots" ON public.blocked_slots FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinic_config;

-- Insertar configuración inicial por defecto
INSERT INTO public.clinic_config (id, name, tagline, phone, whatsapp_country_code, whatsapp_number, address, city, currency_symbol, welcome_message, open_days_text, admin_pin, default_slot_duration_minutes)
VALUES (
    'default',
    'Mi Consultorio Médico',
    'Gestión y Reserva Médica',
    '',
    '',
    '',
    '',
    '',
    '$',
    'Te damos la bienvenida a nuestro sistema de reservas por WhatsApp. Selecciona tu especialidad y horario para agendar tu cita.',
    'Lunes a Sábado',
    'enc:eaca5e7d984d326d',
    30
) ON CONFLICT (id) DO NOTHING;

-- Compatibilidad para bases de datos existentes:
ALTER TABLE IF EXISTS public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE IF EXISTS public.appointments ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE IF EXISTS public.appointments ADD COLUMN IF NOT EXISTS cancelled_at TEXT;
NOTIFY pgrst, 'reload schema';
