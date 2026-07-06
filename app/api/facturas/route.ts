import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { query } from "../../../lib/db";

const sanitizeInput = (str: any) => {
  if (typeof str !== 'string') return str;
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

// GET: Obtener facturas (invoices) filtradas por rango de fecha y rol
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const search = searchParams.get("search");

    const isRrhh = (session.user as any).role === "rrhh";
    let sql: string;
    let params: any[];

    if (isRrhh) {
      if (search && search.length > 2) {
        sql = `
          SELECT 
            id, 
            user_id,
            TO_CHAR(date, 'YYYY-MM-DD') as date, 
            invoice_number, 
            parking_name, 
            location, 
            amount, 
            image_url, 
            vehicle_type, 
            report_sequence, 
            created_at 
          FROM invoices 
          WHERE user_id ILIKE $1 OR invoice_number ILIKE $1 OR parking_name ILIKE $1
          ORDER BY date DESC, id DESC
          LIMIT 100
        `;
        params = [`%${search}%`];
      } else {
        if (!start || !end) {
          return NextResponse.json({ error: "Faltan parámetros start y end" }, { status: 400 });
        }
        sql = `
          SELECT 
            id, 
            user_id,
            TO_CHAR(date, 'YYYY-MM-DD') as date, 
            invoice_number, 
            parking_name, 
            location, 
            amount, 
            image_url, 
            vehicle_type, 
            report_sequence, 
            created_at 
          FROM invoices 
          WHERE date >= $1 AND date <= $2 
          ORDER BY date DESC, id DESC
        `;
        params = [start, end];
      }
    } else {
      sql = `
        SELECT 
          id, 
          user_id,
          TO_CHAR(date, 'YYYY-MM-DD') as date, 
          invoice_number, 
          parking_name, 
          location, 
          amount, 
          image_url, 
          vehicle_type, 
          report_sequence, 
          created_at 
        FROM invoices 
        WHERE user_id = $1 AND date >= $2 AND date <= $3 
        ORDER BY date DESC, id DESC
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

// POST: Registrar nueva factura (invoice)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    let {
      date,
      invoice_number,
      amount,
      image_url,
      parking_name,
      location,
      vehicle_type
    } = body;

    parking_name = sanitizeInput(parking_name);
    location = sanitizeInput(location);
    invoice_number = sanitizeInput(invoice_number);
    vehicle_type = sanitizeInput(vehicle_type);

    if (!date || !invoice_number || amount === undefined) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 1000000000) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    if (parsedDate > now || parsedDate < sixMonthsAgo) {
      return NextResponse.json({ error: "Fecha inválida: La fecha no puede ser futura o más antigua a 6 meses." }, { status: 400 });
    }

    // Verificar si ya existe una factura en la misma fecha para este usuario
    const checkSql = `SELECT id FROM invoices WHERE user_id = $1 AND date = $2 LIMIT 1`;
    const checkRes = await query(checkSql, [session.user.email, date]);
    
    if (checkRes.rows && checkRes.rows.length > 0) {
      return NextResponse.json({ error: "Ya tienes una factura registrada con esta fecha. Solo se permite una por día." }, { status: 400 });
    }

    // Control de unicidad estricto: mismo usuario y mismo número de factura
    const checkInvoiceSql = `SELECT id FROM invoices WHERE user_id = $1 AND invoice_number = $2 LIMIT 1`;
    const checkInvoiceRes = await query(checkInvoiceSql, [session.user.email, invoice_number]);
    
    if (checkInvoiceRes.rows && checkInvoiceRes.rows.length > 0) {
      return NextResponse.json({ error: "Ya tienes registrada una factura con este mismo número." }, { status: 400 });
    }

    const sql = `
      INSERT INTO invoices (
        user_id,
        date, 
        invoice_number, 
        parking_name, 
        location, 
        amount, 
        image_url, 
        vehicle_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
    `;
    
    const params = [
      session.user.email,
      date,
      invoice_number,
      parking_name || null,
      location || null,
      amount,
      image_url || null,
      vehicle_type || null
    ];

    const res = await query(sql, params);
    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Error al registrar factura:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

// PUT: Actualizar factura existente (invoice)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    let {
      id,
      date,
      invoice_number,
      parking_name,
      location,
      amount,
      image_url,
      vehicle_type,
      report_sequence
    } = body;

    parking_name = sanitizeInput(parking_name);
    location = sanitizeInput(location);
    invoice_number = sanitizeInput(invoice_number);
    vehicle_type = sanitizeInput(vehicle_type);

    if (!id) {
      return NextResponse.json({ error: "Falta ID de factura" }, { status: 400 });
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 1000000000) {
        return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
      }
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      if (parsedDate > now || parsedDate < sixMonthsAgo) {
        return NextResponse.json({ error: "Fecha inválida: La fecha no puede ser futura o más antigua a 6 meses." }, { status: 400 });
      }
    }

    // Mitigación de IDOR (Obligatorio)
    const ownerRes = await query("SELECT user_id, TO_CHAR(date, 'YYYY-MM-DD') as date, invoice_number FROM invoices WHERE id = $1 LIMIT 1", [id]);
    if (ownerRes.rows.length === 0) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    const owner = ownerRes.rows[0];
    const ownerEmail = owner.user_id;
    const isRrhh = (session.user as any).role === "rrhh";

    if (ownerEmail !== session.user.email && !isRrhh) {
      return NextResponse.json({ error: "Acceso denegado: No puedes editar registros de otros usuarios" }, { status: 403 });
    }

    const targetDate = date !== undefined ? date : owner.date;
    const targetInvoice = invoice_number !== undefined ? invoice_number : owner.invoice_number;

    if (date) {
      const checkSql = `SELECT id FROM invoices WHERE user_id = $1 AND date = $2 AND id != $3 LIMIT 1`;
      const checkRes = await query(checkSql, [ownerEmail, targetDate, id]);
      
      if (checkRes.rows && checkRes.rows.length > 0) {
        return NextResponse.json({ error: "Ya existe otra factura registrada para esta fecha. Solo se permite una por día." }, { status: 400 });
      }
    }

    if (invoice_number !== undefined) {
      // Control de unicidad estricto
      const checkInvoiceSql = `SELECT id FROM invoices WHERE user_id = $1 AND invoice_number = $2 AND id != $3 LIMIT 1`;
      const checkInvoiceRes = await query(checkInvoiceSql, [ownerEmail, targetInvoice, id]);
      
      if (checkInvoiceRes.rows && checkInvoiceRes.rows.length > 0) {
        return NextResponse.json({ error: "Ya tienes registrada otra factura con este mismo número." }, { status: 400 });
      }
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

    addField("date", date);
    addField("invoice_number", invoice_number);
    addField("parking_name", parking_name);
    addField("location", location);
    addField("amount", amount);
    addField("image_url", image_url);
    addField("vehicle_type", vehicle_type);
    addField("report_sequence", report_sequence);

    if (fields.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(id);
    const sql = `
      UPDATE invoices 
      SET ${fields.join(", ")} 
      WHERE id = $${paramIndex}
      RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
    `;

    const res = await query(sql, values);
    return NextResponse.json(res.rows[0] || {});
  } catch (error: any) {
    console.error("Error al actualizar factura:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
