import { NextRequest, NextResponse } from "next/server";
import Tesseract from "tesseract.js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó imagen" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Ejecutar OCR en idioma español
    const { data: { text } } = await Tesseract.recognize(buffer, "spa");

    // Expresiones regulares heurísticas (puedes ajustarlas según el formato exacto del ticket)
    const nroFacturaMatch = text.match(/(?:Factura|Nro|Ticket|Fact)[\s:#]+(\d{4,8})/i);
    const montoMatch = text.match(/(?:Total|Monto|Pagar)[\s:$]+([\d.,]+)/i);

    let nro_factura = nroFacturaMatch ? nroFacturaMatch[1] : "";
    let monto = montoMatch ? montoMatch[1].replace(",", ".") : "";

    return NextResponse.json({
      nro_factura,
      monto,
      raw_text: text, // Se incluye para debugging o validaciones adicionales
    });

  } catch (error) {
    console.error("OCR Error:", error);
    return NextResponse.json({ error: "Error procesando OCR" }, { status: 500 });
  }
}
