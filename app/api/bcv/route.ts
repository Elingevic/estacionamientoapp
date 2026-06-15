import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("http://172.16.202.58:8000/api/rates/", {
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Error en API BCV: ${response.status}`);
    }

    const data = await response.json();
    
    // Buscar la tasa del USD (el API retorna un array y currency como string)
    let usdData = null;
    if (Array.isArray(data)) {
      usdData = data.find((item: any) => 
        item.currency === "USD" || 
        (typeof item.currency === "object" && item.currency?.code === "USD")
      );
    } else if (data && data.value && Array.isArray(data.value)) {
      usdData = data.value.find((item: any) => 
        item.currency === "USD" || 
        (typeof item.currency === "object" && item.currency?.code === "USD")
      );
    }

    if (usdData && usdData.bd_venta_ask) {
      return NextResponse.json({ 
        success: true, 
        tasa: parseFloat(usdData.bd_venta_ask),
        fecha_valor: usdData.fecha_valor
      });
    } else {
      throw new Error("No se encontró la tasa del USD en la respuesta");
    }

  } catch (error: any) {
    console.error("Error al obtener la tasa del BCV:", error);
    // Tasa de fallback por seguridad si la API falla
    return NextResponse.json({ 
      success: false, 
      tasa: 587.40, // Fallback aproximado a la tasa actual
      error: error.message 
    }, { status: 200 }); // Status 200 para que el frontend no se caiga
  }
}
