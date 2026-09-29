import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { query } from "../../../lib/db";
import { ensureAuditTable } from "../../../lib/audit";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const isRrhh = (session.user as any).role === "rrhh";
    if (!isRrhh) {
      return NextResponse.json(
        { error: "Acceso denegado: Solo el rol RRHH puede consultar auditoría" },
        { status: 403 }
      );
    }

    await ensureAuditTable();
    const res = await query(
      `SELECT id, user_email, action, target_invoice_id, target_user_email, details, created_at 
       FROM audit_log 
       ORDER BY created_at DESC 
       LIMIT 100`
    );

    return NextResponse.json({ success: true, logs: res.rows });
  } catch (error: any) {
    console.error("Error al consultar auditoría:", error);
    return NextResponse.json(
      { error: "Error interno al consultar auditoría" },
      { status: 500 }
    );
  }
}
