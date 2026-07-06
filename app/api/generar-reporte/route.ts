import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { query } from "../../../lib/db";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const emailFilter = searchParams.get("email");

    if (!start || !end) {
      return NextResponse.json({ error: "Faltan fechas start y end" }, { status: 400 });
    }

    const isRrhh = (session.user as any).role === "rrhh";
    let sql: string;
    let params: any[];

    if (isRrhh) {
      if (emailFilter) {
        sql = `
          SELECT 
            id, 
            TO_CHAR(date, 'YYYY-MM-DD') as date, 
            invoice_number, 
            amount, 
            user_id, 
            image_url, 
            parking_name, 
            location, 
            vehicle_type, 
            report_sequence 
          FROM invoices 
          WHERE date >= $1 AND date <= $2 AND user_id ILIKE $3
          ORDER BY date ASC, id ASC
        `;
        params = [start, end, `%${emailFilter}%`];
      } else {
        sql = `
          SELECT 
            id, 
            TO_CHAR(date, 'YYYY-MM-DD') as date, 
            invoice_number, 
            amount, 
            user_id, 
            image_url, 
            parking_name, 
            location, 
            vehicle_type, 
            report_sequence 
          FROM invoices 
          WHERE date >= $1 AND date <= $2 
          ORDER BY date ASC, id ASC
        `;
        params = [start, end];
      }
    } else {
      sql = `
        SELECT 
          id, 
          TO_CHAR(date, 'YYYY-MM-DD') as date, 
          invoice_number, 
          amount, 
          user_id, 
          image_url, 
          parking_name, 
          location, 
          vehicle_type, 
          report_sequence 
        FROM invoices 
        WHERE user_id = $1 AND date >= $2 AND date <= $3 
        ORDER BY date ASC, id ASC
      `;
      params = [session.user.email, start, end];
    }

    const res = await query(sql, params);
    const facturas = res.rows;

    let total_monto = 0;
    const numberFormat = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const uniqueFacturas: any[] = [];
    const seenFacturas = new Set();
    facturas?.forEach(f => {
      const key = `${f.date}-${f.invoice_number}`;
      if (!seenFacturas.has(key)) {
        seenFacturas.add(key);
        uniqueFacturas.push(f);
      }
    });

    // Ordenar explícitamente de forma cronológica por fecha
    uniqueFacturas.sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const facturasFormat = uniqueFacturas.map((f) => {
      total_monto += Number(f.amount);
      
      const [y, m, d] = f.date.split("-");
      const currentFecha = `${d}/${m}/${y}`;

      return {
        ...f,
        monto: `Bs. ${numberFormat.format(Number(f.amount))}`,
        fecha: currentFecha,
        nro_factura: f.invoice_number,
        nombre_estacionamiento: f.parking_name || "No especificado",
        estacionamiento: f.parking_name || "No especificado",
        lugar: f.location || "No especificado",
        empleado: f.user_id
      };
    }) || [];

    const templatePath = path.resolve(process.cwd(), "public", "template.docx");
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontró la plantilla en: ${templatePath}`);
    }

    const content = fs.readFileSync(templatePath, "binary");

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const correlativo = `DOC-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;

    const facturaIds = uniqueFacturas.map((f: any) => f.id).filter(id => id);
    if (facturaIds.length > 0) {
      try {
        const sqlUpdate = `
          UPDATE invoices 
          SET report_sequence = $1 
          WHERE id = ANY($2::int[])
        `;
        await query(sqlUpdate, [correlativo, facturaIds]);
      } catch (updateError) {
        console.error("Error guardando el correlativo en BD:", updateError);
      }
    }

    const userName = session.user.name || `${(session.user as any).given_name || ''} ${(session.user as any).family_name || ''}`.trim() || session.user.email;
    const userCedula = (session.user as any).cedula || "N/A (SSO)";
    let userCargo = (session.user as any).cargo || "Empleado";

    if (userCargo && !isNaN(Number(userCargo))) {
      try {
        const res = await fetch(`http://172.16.205.33:8000/api/catalogs/position/?id=${userCargo}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const catalogData = await res.json();
          if (Array.isArray(catalogData) && catalogData.length > 0 && catalogData[0].description) {
            userCargo = catalogData[0].description;
          }
        }
      } catch (err) {
        console.error("Error consultando el catálogo de cargos:", err);
      }
    }

    doc.render({
      correlativo: correlativo,
      facturas: facturasFormat,
      total_monto: `Bs. ${numberFormat.format(total_monto)}`,
      fecha_generacion: new Date().toLocaleDateString("es-ES", { timeZone: "America/Caracas" }),
      // Si es RRHH generando el reporte global, indicamos RRHH o la busqueda. Si no, usamos el nombre real.
      nombres: isRrhh && !emailFilter ? "Consolidado RRHH" : userName,
      cedula: isRrhh && !emailFilter ? "N/A" : userCedula,
      cargo: isRrhh && !emailFilter ? "Departamento de Recursos Humanos" : userCargo
    });

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Reporte_${isRrhh ? 'RRHH' : 'Empleado'}_${new Date().toISOString().split("T")[0]}.docx"`,
      },
    });

  } catch (error: any) {
    console.error("Error generando reporte:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
