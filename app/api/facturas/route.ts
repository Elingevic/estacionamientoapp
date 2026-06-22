import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { query } from "../../../lib/db";

// GET: Obtener facturas filtradas por rango de fecha y rol
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "Faltan parámetros start y end" }, { status: 400 });
    }

    const isRrhh = (session.user as any).role === "rrhh";
    let sql: string;
    let params: any[];

    if (isRrhh) {
      sql = `
        SELECT 
          id, 
          TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, 
          nro_factura, 
          monto, 
          user_id, 
          image_url, 
          nombre_estacionamiento, 
          lugar, 
          tipo_vehiculo, 
          tasa_usd, 
          monto_usd, 
          correlativo_reporte, 
          created_at 
        FROM facturas 
        WHERE fecha >= $1 AND fecha <= $2 
        ORDER BY fecha DESC, id DESC
      `;
      params = [start, end];
    } else {
      sql = `
        SELECT 
          id, 
          TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, 
          nro_factura, 
          monto, 
          user_id, 
          image_url, 
          nombre_estacionamiento, 
          lugar, 
          tipo_vehiculo, 
          tasa_usd, 
          monto_usd, 
          correlativo_reporte, 
          created_at 
        FROM facturas 
        WHERE user_id = $1 AND fecha >= $2 AND fecha <= $3 
        ORDER BY fecha DESC, id DESC
      `;
      params = [session.user.email, start, end];
    }

    const res = await query(sql, params);
    return NextResponse.json(res.rows);
  } catch (error: any) {
    console.error("Error al consultar facturas:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// POST: Registrar nueva factura
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      fecha,
      nro_factura,
      monto,
      image_url,
      nombre_estacionamiento,
      lugar,
      tipo_vehiculo,
      tasa_usd,
      monto_usd
    } = body;

    if (!fecha || !nro_factura || monto === undefined) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const sql = `
      INSERT INTO facturas (
        fecha, 
        nro_factura, 
        monto, 
        user_id, 
        image_url, 
        nombre_estacionamiento, 
        lugar, 
        tipo_vehiculo, 
        tasa_usd, 
        monto_usd
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha
    `;
    
    const params = [
      fecha,
      nro_factura,
      monto,
      session.user.email,
      image_url || null,
      nombre_estacionamiento || null,
      lugar || null,
      tipo_vehiculo || null,
      tasa_usd || null,
      monto_usd || null
    ];

    const res = await query(sql, params);
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Error al registrar factura:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// PUT: Actualizar factura existente
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      fecha,
      nro_factura,
      monto,
      nombre_estacionamiento,
      lugar,
      tipo_vehiculo,
      tasa_usd,
      monto_usd,
      correlativo_reporte
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Falta ID de factura" }, { status: 400 });
    }

    // Construir actualización dinámica
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const addField = (name: string, val: any) => {
      if (val !== undefined) {
        fields.push(`${name} = $${paramIndex++}`);
        values.push(val);
      }
    };

    addField("fecha", fecha);
    addField("nro_factura", nro_factura);
    addField("monto", monto);
    addField("nombre_estacionamiento", nombre_estacionamiento);
    addField("lugar", lugar);
    addField("tipo_vehiculo", tipo_vehiculo);
    addField("tasa_usd", tasa_usd);
    addField("monto_usd", monto_usd);
    addField("correlativo_reporte", correlativo_reporte);

    if (fields.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(id);
    const sql = `
      UPDATE facturas 
      SET ${fields.join(", ")} 
      WHERE id = $${paramIndex}
      RETURNING *, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha
    `;

    const res = await query(sql, values);
    return NextResponse.json(res.rows[0] || {});
  } catch (error: any) {
    console.error("Error al actualizar factura:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
