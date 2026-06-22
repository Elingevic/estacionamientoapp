-- Esquema de Base de Datos PostgreSQL para el Sistema de Estacionamiento (parking)
-- Ejecutar este script en el servidor de base de datos (172.16.205.47) en la base de datos 'parking'.

-- Tabla: facturas
CREATE TABLE IF NOT EXISTS facturas (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    nro_factura VARCHAR(50) NOT NULL,
    monto NUMERIC(15, 2) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    image_url TEXT,
    nombre_estacionamiento VARCHAR(255),
    lugar VARCHAR(255),
    tipo_vehiculo VARCHAR(50),
    tasa_usd NUMERIC(15, 4),
    monto_usd NUMERIC(15, 2),
    correlativo_reporte VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar las búsquedas frecuentes por fecha y empleado
CREATE INDEX IF NOT EXISTS idx_facturas_user_fecha ON facturas (user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas (fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_nro_factura ON facturas (nro_factura);
