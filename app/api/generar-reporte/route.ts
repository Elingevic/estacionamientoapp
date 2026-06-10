import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Obtener facturas
    const { data: facturas, error } = await supabase
      .from("facturas")
      .select("*")
      .order("fecha", { ascending: true });

    if (error) throw error;

    let total_monto = 0;
    const facturasFormat = facturas?.map((f) => {
      total_monto += Number(f.monto);
      return {
        ...f,
        monto: Number(f.monto).toFixed(2),
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

    doc.render({
      facturas: facturasFormat,
      total_monto: total_monto.toFixed(2),
      fecha_generacion: new Date().toLocaleDateString("es-ES"),
    });

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    return new NextResponse(buf, {
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
