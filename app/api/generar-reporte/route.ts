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

    const facturasFormat = facturas?.map((f) => {
      total_monto += Number(f.monto);
      return {
        ...f,
        monto: `Bs. ${numberFormat.format(Number(f.monto))}`,
        fecha: new Date(f.fecha).toLocaleDateString("es-ES", { timeZone: "America/Caracas" }),
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

    // Inyectamos las variables dinámicas
    doc.render({
      facturas: facturasFormat,
      total_monto: `Bs. ${numberFormat.format(total_monto)}`,
      fecha_generacion: new Date().toLocaleDateString("es-ES", { timeZone: "America/Caracas" }),
      // Si es RRHH generando el reporte global, ponemos RRHH. Si no, el nombre del empleado.
      nombres: isRrhh ? (emailFilter || "Consolidado RRHH") : session.user.name || session.user.email,
      cedula: "N/A (SSO)",
      cargo: isRrhh ? "Departamento de Recursos Humanos" : "Empleado"
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
