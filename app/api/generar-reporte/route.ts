import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const emailFilter = searchParams.get("email");

    if (!start || !end) {
      return NextResponse.json({ error: "Faltan fechas start y end" }, { status: 400 });
    }

    const isRrhh = (session.user as any).role === "rrhh";

    let query = supabase
      .from("facturas")
      .select("*")
      .gte("fecha", start)
      .lte("fecha", end)
      .order("fecha", { ascending: true });

    // Si no es RRHH, solo puede ver sus propias facturas
    if (!isRrhh) {
      query = query.eq("user_id", session.user.email);
    } else if (emailFilter) {
      // Si es RRHH y buscó un correo específico, filtramos por ese correo
      query = query.ilike("user_id", `%${emailFilter}%`);
    }

    const { data: facturas, error } = await query;

    if (error) throw error;

    let total_monto = 0;
    const numberFormat = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const uniqueFacturas: any[] = [];
    const seenFacturas = new Set();
    facturas?.forEach(f => {
      const key = `${f.fecha}-${f.nro_factura}`;
      if (!seenFacturas.has(key)) {
        seenFacturas.add(key);
        uniqueFacturas.push(f);
      }
    });

    const facturasFormat = uniqueFacturas.map((f) => {
      total_monto += Number(f.monto);
      
      const [y, m, d] = f.fecha.split("-");
      const currentFecha = `${d}/${m}/${y}`;

      return {
        ...f,
        monto: `Bs. ${numberFormat.format(Number(f.monto))}`,
        fecha: currentFecha,
        // Añadimos datos más cortos para que la tabla en Word no se desborde
        empleado: f.user_id,
        nombre_estacionamiento: f.nombre_estacionamiento || f.estacionamiento || "No especificado",
        estacionamiento: f.nombre_estacionamiento || f.estacionamiento || "No especificado",
        lugar: f.lugar || "No especificado"
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
      const { error: updateError } = await supabase
        .from("facturas")
        .update({ correlativo_reporte: correlativo })
        .in("id", facturaIds);
      
      if (updateError) {
        console.error("Error guardando el correlativo en BD (¿falta la columna?):", updateError);
      }
    }

    // Inyectamos las variables dinámicas
    const userName = session.user.name || `${(session.user as any).given_name || ''} ${(session.user as any).family_name || ''}`.trim() || session.user.email;
    const userCedula = (session.user as any).cedula || "N/A (SSO)";
    let userCargo = (session.user as any).cargo || "Empleado";

    // Si el cargo es un número (ej. "47"), consultamos la API de catálogos para obtener el nombre real
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
