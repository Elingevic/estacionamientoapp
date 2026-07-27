import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { query } from "../../../lib/db";
import { randomUUID } from "crypto";


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
            i.id, 
            u.email as user_id,
            TO_CHAR(i.issued_at, 'YYYY-MM-DD') as date, 
            i.invoice_number, 
            p.description as parking_name, 
            p.address as location, 
            i.amount, 
            i.image_url, 
            v.description as vehicle_type, 
            i.report_sequence, 
            i.created_at 
          FROM invoice i 
          JOIN "user" u ON i.user_id = u.uuid
          LEFT JOIN parking_lot p ON i.parking_lot_id = p.id
          LEFT JOIN vehicle_type v ON i.vehicle_type_id = v.id
          WHERE u.email ILIKE $1 OR i.invoice_number ILIKE $1 OR p.description ILIKE $1
          ORDER BY i.issued_at DESC, i.id DESC
          LIMIT 100
        `;
        params = [`%${search}%`];
      } else {
        if (!start || !end) {
          return NextResponse.json({ error: "Faltan parámetros start y end" }, { status: 400 });
        }
        sql = `
          SELECT 
            i.id, 
            u.email as user_id,
            TO_CHAR(i.issued_at, 'YYYY-MM-DD') as date, 
            i.invoice_number, 
            p.description as parking_name, 
            p.address as location, 
            i.amount, 
            i.image_url, 
            v.description as vehicle_type, 
            i.report_sequence, 
            i.created_at 
          FROM invoice i 
          JOIN "user" u ON i.user_id = u.uuid
          LEFT JOIN parking_lot p ON i.parking_lot_id = p.id
          LEFT JOIN vehicle_type v ON i.vehicle_type_id = v.id
          WHERE i.issued_at >= $1 AND i.issued_at <= $2 
          ORDER BY i.issued_at DESC, i.id DESC
        `;
        params = [start, end];
      }
    } else {
      sql = `
        SELECT 
          i.id, 
          u.email as user_id,
          TO_CHAR(i.issued_at, 'YYYY-MM-DD') as date, 
          i.invoice_number, 
          p.description as parking_name, 
          p.address as location, 
          i.amount, 
          i.image_url, 
          v.description as vehicle_type, 
          i.report_sequence, 
          i.created_at 
        FROM invoice i 
        JOIN "user" u ON i.user_id = u.uuid
        LEFT JOIN parking_lot p ON i.parking_lot_id = p.id
        LEFT JOIN vehicle_type v ON i.vehicle_type_id = v.id
        WHERE u.email = $1 AND i.issued_at >= $2 AND i.issued_at <= $3 
        ORDER BY i.issued_at DESC, i.id DESC
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

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: "Monto inválido (El monto excede el tope permitido)" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    if (parsedDate > now || parsedDate < sixMonthsAgo) {
      return NextResponse.json({ error: "Fecha inválida: La fecha no puede ser futura o más antigua a 6 meses." }, { status: 400 });
    }

    const userUuid = (session.user as any).id;
    const userEmail = session.user.email;
    const userRole = (session.user as any).role || "empleado";
    const officeId = (session.user as any).office_id || null;
    const positionId = (session.user as any).position_id || null;

    // 1. Asegurar la existencia y actualización de datos del usuario
    await query(`
      INSERT INTO "user" (uuid, email, role_id, office_id, position_id, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (uuid) DO UPDATE 
      SET email = EXCLUDED.email, role_id = EXCLUDED.role_id, office_id = EXCLUDED.office_id, position_id = EXCLUDED.position_id, updated_at = NOW()
    `, [userUuid, userEmail, userRole, officeId, positionId]);

    // 2. Mapear dinámicamente el parking_lot
    let parkingLotId = 1; // Default
    if (parking_name) {
      const cleanName = parking_name.trim();
      const cleanLoc = (location || "").trim();
      const parkRes = await query(
        'SELECT id FROM parking_lot WHERE LOWER(description) = LOWER($1) AND LOWER(address) = LOWER($2) LIMIT 1',
        [cleanName, cleanLoc]
      );
      if (parkRes.rows.length > 0) {
        parkingLotId = parkRes.rows[0].id;
      } else {
        const newPark = await query(
          'INSERT INTO parking_lot (description, address, is_active) VALUES ($1, $2, true) RETURNING id',
          [cleanName, cleanLoc]
        );
        parkingLotId = newPark.rows[0].id;
      }
    }

    // 3. Mapear tipo de vehículo
    let vehicleTypeId = 1; // Carro por defecto
    if (vehicle_type) {
      const vt = vehicle_type.toLowerCase().trim();
      if (vt === "moto") {
        vehicleTypeId = 2;
      }
    }

    // 4. Verificar si ya existe una factura en la misma fecha para este usuario
    const checkSql = `SELECT id FROM invoice WHERE user_id = $1 AND DATE(issued_at) = $2 LIMIT 1`;
    const checkRes = await query(checkSql, [userUuid, date]);
    
    if (checkRes.rows && checkRes.rows.length > 0) {
      return NextResponse.json({ error: "Ya tienes una factura registrada con esta fecha. Solo se permite una por día." }, { status: 400 });
    }

    // 5. Control de unicidad estricto: mismo usuario y mismo número de factura
    const checkInvoiceSql = `SELECT id FROM invoice WHERE user_id = $1 AND invoice_number = $2 LIMIT 1`;
    const checkInvoiceRes = await query(checkInvoiceSql, [userUuid, invoice_number]);
    
    if (checkInvoiceRes.rows && checkInvoiceRes.rows.length > 0) {
      return NextResponse.json({ error: "Ya tienes registrada una factura con este mismo número." }, { status: 400 });
    }

    // 6. Insertar la factura
    const invoiceId = randomUUID();
    const sql = `
      INSERT INTO invoice (
        id,
        user_id,
        issued_at, 
        invoice_number, 
        amount, 
        image_url, 
        parking_lot_id, 
        vehicle_type_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    const params = [
      invoiceId,
      userUuid,
      date,
      invoice_number,
      amount,
      image_url || null,
      parkingLotId,
      vehicleTypeId
    ];

    await query(sql, params);
    
    return NextResponse.json({
      id: invoiceId,
      user_id: userEmail,
      date: date,
      invoice_number,
      parking_name,
      location,
      amount,
      image_url,
      vehicle_type,
      created_at: new Date().toISOString()
    });
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
      if (typeof amount !== 'number' || isNaN(amount) || amount <= 0 || amount > 100000) {
        return NextResponse.json({ error: "Monto inválido (El monto excede el tope permitido)" }, { status: 400 });
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
    const ownerRes = await query(`
      SELECT i.user_id, u.email as user_email, TO_CHAR(i.issued_at, 'YYYY-MM-DD') as date, i.invoice_number 
      FROM invoice i
      JOIN "user" u ON i.user_id = u.uuid
      WHERE i.id = $1 
      LIMIT 1
    `, [id]);
    
    if (ownerRes.rows.length === 0) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    const owner = ownerRes.rows[0];
    const ownerEmail = owner.user_email;
    const ownerUuid = owner.user_id;
    const isRrhh = (session.user as any).role === "rrhh";

    if (ownerEmail !== session.user.email && !isRrhh) {
      return NextResponse.json({ error: "Acceso denegado: No puedes editar registros de otros usuarios" }, { status: 403 });
    }

    const targetDate = date !== undefined ? date : owner.date;
    const targetInvoice = invoice_number !== undefined ? invoice_number : owner.invoice_number;

    if (date) {
      const checkSql = `SELECT id FROM invoice WHERE user_id = $1 AND DATE(issued_at) = $2 AND id != $3 LIMIT 1`;
      const checkRes = await query(checkSql, [ownerUuid, targetDate, id]);
      
      if (checkRes.rows && checkRes.rows.length > 0) {
        return NextResponse.json({ error: "Ya existe otra factura registrada para esta fecha. Solo se permite una por día." }, { status: 400 });
      }
    }

    if (invoice_number !== undefined) {
      // Control de unicidad estricto
      const checkInvoiceSql = `SELECT id FROM invoice WHERE user_id = $1 AND invoice_number = $2 AND id != $3 LIMIT 1`;
      const checkInvoiceRes = await query(checkInvoiceSql, [ownerUuid, targetInvoice, id]);
      
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

    if (date !== undefined) {
      addField("issued_at", date);
    }
    addField("invoice_number", invoice_number);
    
    // Si parking_name o location cambian, resolver el parking_lot_id
    if (parking_name !== undefined || location !== undefined) {
      const currentInvoicePark = await query(`
        SELECT p.description, p.address 
        FROM invoice i 
        LEFT JOIN parking_lot p ON i.parking_lot_id = p.id 
        WHERE i.id = $1
      `, [id]);
      const currentName = currentInvoicePark.rows[0]?.description || "";
      const currentLoc = currentInvoicePark.rows[0]?.address || "";
      
      const newName = parking_name !== undefined ? parking_name.trim() : currentName;
      const newLoc = location !== undefined ? location.trim() : currentLoc;
      
      let parkingLotId = 1;
      const parkRes = await query(
        'SELECT id FROM parking_lot WHERE LOWER(description) = LOWER($1) AND LOWER(address) = LOWER($2) LIMIT 1',
        [newName, newLoc]
      );
      if (parkRes.rows.length > 0) {
        parkingLotId = parkRes.rows[0].id;
      } else {
        const newPark = await query(
          'INSERT INTO parking_lot (description, address, is_active) VALUES ($1, $2, true) RETURNING id',
          [newName, newLoc]
        );
        parkingLotId = newPark.rows[0].id;
      }
      addField("parking_lot_id", parkingLotId);
    }

    addField("amount", amount);
    addField("image_url", image_url);
    
    if (vehicle_type !== undefined) {
      let vehicleTypeId = 1;
      if (vehicle_type.toLowerCase().trim() === "moto") {
        vehicleTypeId = 2;
      }
      addField("vehicle_type_id", vehicleTypeId);
    }
    
    addField("report_sequence", report_sequence);

    if (fields.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(id);
    const sql = `
      UPDATE invoice 
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `;

    await query(sql, values);
    
    const finalRes = await query(`
      SELECT 
        i.id, 
        u.email as user_id,
        TO_CHAR(i.issued_at, 'YYYY-MM-DD') as date, 
        i.invoice_number, 
        p.description as parking_name, 
        p.address as location, 
        i.amount, 
        i.image_url, 
        v.description as vehicle_type, 
        i.report_sequence, 
        i.created_at 
      FROM invoice i
      JOIN "user" u ON i.user_id = u.uuid
      LEFT JOIN parking_lot p ON i.parking_lot_id = p.id
      LEFT JOIN vehicle_type v ON i.vehicle_type_id = v.id
      WHERE i.id = $1
    `, [id]);
    
    return NextResponse.json(finalRes.rows[0] || {});
  } catch (error: any) {
    console.error("Error al actualizar factura:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
