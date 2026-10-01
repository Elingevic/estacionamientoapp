import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getAuditLogs } from "../../../lib/audit";

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

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const invoice_id = searchParams.get("invoice_id") || searchParams.get("target_invoice_id");
    const user_id = searchParams.get("user_id") || searchParams.get("target_user_email");
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined;

    const result = await getAuditLogs({
      start,
      end,
      invoice_id,
      user_id,
      limit,
      page,
      offset,
    });

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error: any) {
    console.error("Error al consultar auditoría:", error);
    return NextResponse.json(
      { error: "Error interno al consultar auditoría" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: "Método no permitido" }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: "Método no permitido" }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Método no permitido" }, { status: 405 });
}
