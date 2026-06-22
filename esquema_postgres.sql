-- Esquema de Base de Datos PostgreSQL para el Sistema de Estacionamiento (parking)
-- Ejecutar este script en el servidor de base de datos (172.16.205.47) en la base de datos 'parking'.

-- Tabla: invoices
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    parking_name VARCHAR(255),
    location VARCHAR(255),
    amount NUMERIC(15, 2) NOT NULL,
    image_url TEXT,
    vehicle_type VARCHAR(50),
    report_sequence VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar las búsquedas frecuentes por fecha y empleado
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON invoices (user_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices (date);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices (invoice_number);
