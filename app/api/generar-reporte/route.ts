import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Crear cliente de supabase pasando el token del usuario
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "Faltan fechas start y end" }, { status: 400 });
    }

    // Obtener perfil del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    // Obtener facturas filtradas por fecha (y que pertenezcan al usuario gracias al RLS)
    const { data: facturas, error } = await supabase
      .from("facturas")
      .select("*")
      .gte("fecha", start)
      .lte("fecha", end)
      .order("fecha", { ascending: true });

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
        monto: `Bs.S ${numberFormat.format(Number(f.monto))}`,
        fecha: new Date(f.fecha).toLocaleDateString("es-ES"),
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

    // Inyectamos las variables dinámicas del usuario y sus facturas
    doc.render({
      facturas: facturasFormat,
      total_monto: `Bs.S ${numberFormat.format(total_monto)}`,
      fecha_generacion: new Date().toLocaleDateString("es-ES"),
      nombres: profile.nombres,
      cedula: profile.cedula,
      cargo: profile.cargo
    });

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    return new NextResponse(buf as any, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Reporte_Semanal_${new Date().toISOString().split("T")[0]}.docx"`,
      },
    });

  } catch (error: any) {
    console.error("Error generando reporte:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
