-- ============================================================================
-- SUDEPARKING - SCRIPT DE MIGRACIÓN: MÓDULO DE AUDITORÍA (IMP-14 / N-11)
-- Base de datos: parking (PostgreSQL 172.16.205.47)
-- Ejecutar como usuario administrador / superusuario (postgres o jlandaeta)
-- ============================================================================

-- 1. Otorgar permisos de creación y uso sobre el esquema public al usuario parking
GRANT USAGE, CREATE ON SCHEMA public TO parking;
GRANT ALL ON SCHEMA public TO parking;

-- 2. Asegurar que la tabla invoice tenga el campo updated_at
ALTER TABLE invoice ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Crear la tabla audit_log para registro de auditoría de RRHH
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_invoice_id VARCHAR(100),
    target_user_email VARCHAR(255),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear índices para optimizar búsquedas por fecha, factura y usuario
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_invoice ON audit_log (target_invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_user ON audit_log (target_user_email);

-- 5. Otorgar permisos completos al usuario de aplicación 'parking'
GRANT ALL PRIVILEGES ON TABLE audit_log TO parking;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO parking;
GRANT ALL PRIVILEGES ON SEQUENCE audit_log_id_seq TO parking;

-- Confirmación
SELECT 'Migración de auditoría aplicada con éxito' AS status;
