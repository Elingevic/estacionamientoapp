-- 1. ADAPTAR LA BASE DE DATOS PARA NEXTAUTH (SSO)
-- Desactivamos la seguridad de fila (RLS) porque ahora NextAuth protege las rutas web.
-- Y eliminamos las políticas viejas que usaban el uuid de Supabase.
DROP POLICY IF EXISTS "Los usuarios solo ven sus facturas" ON public.facturas;
DROP POLICY IF EXISTS "Los usuarios solo insertan sus facturas" ON public.facturas;
ALTER TABLE public.facturas DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_user_id_fkey;
ALTER TABLE public.facturas ALTER COLUMN user_id TYPE TEXT;

-- 2. CREAR EL BUCKET PARA GUARDAR LAS FOTOS (STORAGE)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tickets', 'tickets', true)
ON CONFLICT (id) DO NOTHING;

-- Dar permisos para que cualquiera (en este caso nuestra app web con su key) pueda subir y leer fotos.
DROP POLICY IF EXISTS "Permitir subida pública de tickets" ON storage.objects;
CREATE POLICY "Permitir subida pública de tickets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tickets');

DROP POLICY IF EXISTS "Permitir lectura pública de tickets" ON storage.objects;
CREATE POLICY "Permitir lectura pública de tickets" ON storage.objects FOR SELECT USING (bucket_id = 'tickets');

DROP POLICY IF EXISTS "Permitir borrado público de tickets" ON storage.objects;
CREATE POLICY "Permitir borrado público de tickets" ON storage.objects FOR DELETE USING (bucket_id = 'tickets');

-- 3. AÑADIR LA COLUMNA PARA GUARDAR LA FOTO EN LA TABLA
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 4. FUNCIÓN AUTOMÁTICA PARA BORRAR FACTURAS Y FOTOS VIEJAS (> 2 semanas)
-- Nota: En Supabase Free, las tareas programadas (pg_cron) a veces requieren habilitar la extensión.
-- Vamos a crear la función, y si tienes un plan Pro/Pagado puedes activarla con pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION limpiar_facturas_viejas() RETURNS void AS $$
BEGIN
  -- Borrar de la tabla facturas aquellas con más de 14 días
  DELETE FROM public.facturas WHERE created_at < NOW() - INTERVAL '14 days';
  -- Nota: El borrado físico de Storage requiere llamar a la API de Storage, 
  -- pero al borrar el registro, RRHH ya no lo verá.
END;
$$ LANGUAGE plpgsql;

-- Programar para que corra todos los domingos a las 3:00 AM
-- (Esto puede fallar si estás en la capa gratis sin pg_cron habilitado)
-- SELECT cron.schedule('borrado_semanal', '0 3 * * 0', 'SELECT limpiar_facturas_viejas();');
