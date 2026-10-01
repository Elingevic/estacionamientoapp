import { query } from "./db";
import fs from "fs";
import path from "path";

export interface AuditLogEntry {
  id?: number | string;
  user_email: string;
  action: "EDIT" | "DELETE";
  target_invoice_id: string;
  target_user_email?: string | null;
  details?: any;
  created_at?: string;
}

export interface AuditFilterParams {
  start?: string | null;
  end?: string | null;
  invoice_id?: string | null;
  user_id?: string | null;
  limit?: number | null;
  offset?: number | null;
  page?: number | null;
}

let auditTableInitialized = false;

function getDataFilePath(): string {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore directory creation error if already exists
    }
  }
  return path.join(dir, "audit_log.json");
}

function readLocalAuditLogs(): AuditLogEntry[] {
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content || "[]");
    }
  } catch (err) {
    console.error("Error leyendo audit_log local:", err);
  }
  return [];
}

function writeLocalAuditLog(entry: AuditLogEntry) {
  try {
    const logs = readLocalAuditLogs();
    const newEntry: AuditLogEntry = {
      id: logs.length > 0 ? Number(logs[0].id || 0) + 1 : 1,
      ...entry,
      created_at: entry.created_at || new Date().toISOString(),
    };
    logs.unshift(newEntry);
    const filePath = getDataFilePath();
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.error("Error guardando audit_log local:", err);
  }
}

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
    // Si el usuario no tiene permisos de CREATE TABLE en el esquema public, registramos la advertencia
    console.warn("Aviso: No se pudo crear audit_log en PostgreSQL (usando persistencia dual):", (err as any)?.message);
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
  const details = { old: oldValues, new: newValues };
  const entry: AuditLogEntry = {
    user_email: userEmail,
    action,
    target_invoice_id: targetInvoiceId,
    target_user_email: targetUserEmail || null,
    details,
    created_at: new Date().toISOString(),
  };

  // Siempre guardamos copia local persistente para máxima resiliencia
  writeLocalAuditLog(entry);

  try {
    await ensureAuditTable();
    await query(
      `INSERT INTO audit_log (user_email, action, target_invoice_id, target_user_email, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userEmail, action, targetInvoiceId, targetUserEmail || null, JSON.stringify(details)]
    );
  } catch (err) {
    console.warn("Aviso: Guardado en audit_log de PostgreSQL no disponible, preservado en almacenamiento local:", (err as any)?.message);
  }
}

/**
 * Consulta los registros de auditoría aplicando filtros opcionales
 */
export async function getAuditLogs(params: AuditFilterParams = {}) {
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 500);
  const page = Math.max(Number(params.page) || 1, 1);
  const offset = params.offset !== undefined && params.offset !== null ? Math.max(Number(params.offset), 0) : (page - 1) * limit;

  // 1. Intentar consultar PostgreSQL
  try {
    await ensureAuditTable();

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.start) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(params.start.includes("T") ? params.start : `${params.start} 00:00:00`);
    }
    if (params.end) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(params.end.includes("T") ? params.end : `${params.end} 23:59:59.999`);
    }
    if (params.invoice_id) {
      conditions.push(`target_invoice_id = $${idx++}`);
      values.push(params.invoice_id);
    }
    if (params.user_id) {
      conditions.push(`(target_user_email ILIKE $${idx} OR user_email ILIKE $${idx})`);
      idx++;
      values.push(`%${params.user_id}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) as total FROM audit_log ${whereClause}`, values);
    const total = parseInt(countRes.rows[0]?.total || "0", 10);

    const querySql = `
      SELECT id, user_email, action, target_invoice_id, target_user_email, details, created_at 
      FROM audit_log 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const logsRes = await query(querySql, [...values, limit, offset]);

    return {
      success: true,
      logs: logsRes.rows,
      total,
      limit,
      offset,
      source: "postgres",
    };
  } catch (pgErr) {
    // 2. Si falla PostgreSQL (por permisos o falta de tabla), consultar almacén local persistente
    console.warn("Consultando almacén local de auditoría:", (pgErr as any)?.message);
    const allLogs = readLocalAuditLogs();

    let filtered = allLogs;

    if (params.start) {
      const startTime = new Date(params.start.includes("T") ? params.start : `${params.start}T00:00:00`).getTime();
      filtered = filtered.filter((l) => new Date(l.created_at || "").getTime() >= startTime);
    }
    if (params.end) {
      const endTime = new Date(params.end.includes("T") ? params.end : `${params.end}T23:59:59.999`).getTime();
      filtered = filtered.filter((l) => new Date(l.created_at || "").getTime() <= endTime);
    }
    if (params.invoice_id) {
      filtered = filtered.filter((l) => l.target_invoice_id === params.invoice_id);
    }
    if (params.user_id) {
      const u = params.user_id.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          (l.target_user_email && l.target_user_email.toLowerCase().includes(u)) ||
          (l.user_email && l.user_email.toLowerCase().includes(u))
      );
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      success: true,
      logs: paginated,
      total,
      limit,
      offset,
      source: "local_store",
    };
  }
}
