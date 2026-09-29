/**
 * Helper para obtener la tasa oficial del BCV
 */
export async function getBcvRate(): Promise<number> {
  let currentBcvRate = 587.40;
  try {
    const res = await fetch("http://172.16.202.58:8000/api/rates/", {
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
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
        currentBcvRate = parseFloat(usdData.bd_venta_ask);
      }
    }
  } catch (e) {
    console.warn("No se pudo obtener la tasa BCV:", e);
  }
  return currentBcvRate;
}
