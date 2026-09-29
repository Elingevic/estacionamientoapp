import { query } from "./db";

let auditTableInitialized = false;

/**
 * Asegura la creación de la tabla de auditoría si no existe en la base de datos PostgreSQL
 */
export async function ensureAuditTable() {
  if (auditTableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        target_invoice_id VARCHAR(100),
        target_user_email VARCHAR(255),
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_invoice ON audit_log (target_invoice_id);
    `);
    auditTableInitialized = true;
  } catch (err) {
    console.error("Error al inicializar tabla audit_log:", err);
  }
}

/**
 * Registra una acción administrativa de auditoría sobre facturas
 */
export async function logAuditAction({
  userEmail,
  action,
  targetInvoiceId,
  targetUserEmail,
  oldValues,
  newValues,
}: {
  userEmail: string;
  action: "EDIT" | "DELETE";
  targetInvoiceId: string;
  targetUserEmail?: string;
  oldValues?: any;
  newValues?: any;
}) {
  try {
    await ensureAuditTable();
    await query(
      `INSERT INTO audit_log (user_email, action, target_invoice_id, target_user_email, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userEmail,
        action,
        targetInvoiceId,
        targetUserEmail || null,
        JSON.stringify({ old: oldValues, new: newValues }),
      ]
    );
  } catch (err) {
    console.error("Error registrando log de auditoría:", err);
  }
}
