import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import PrintButton from "./PrintButton";
import { query } from "../../lib/db";

export default async function ReportePage({
  searchParams,
}: {
  searchParams: Promise<{ start: string; end: string; email?: string }>;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const start = resolvedSearchParams.start;
  const end = resolvedSearchParams.end;
  const emailFilter = resolvedSearchParams.email;

  if (!start || !end) {
    return <div className="p-10 text-center">Faltan parámetros de fecha.</div>;
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

  let facturas: any[] = [];
  try {
    const res = await query(sql, params);
    facturas = res.rows;
  } catch (dbErr: any) {
    return <div className="p-10 text-center text-red-500">Error cargando facturas: {dbErr.message}</div>;
  }

  // Deduplicar facturas
  const uniqueFacturas: any[] = [];
  const seenFacturas = new Set();
  let total_monto = 0;

  facturas?.forEach(f => {
    const key = `${f.date}-${f.invoice_number}`;
    if (!seenFacturas.has(key)) {
      seenFacturas.add(key);
      uniqueFacturas.push(f);
      total_monto += Number(f.amount);
    }
  });

  const numberFormat = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const correlativo = `DOC-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;

  // Actualizar correlativo en DB si hay facturas
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

  // Obtener nombre de usuario
  const userName = isRrhh && !emailFilter 
    ? "Consolidado RRHH" 
    : session.user.name || `${(session.user as any).given_name || ''} ${(session.user as any).family_name || ''}`.trim() || session.user.email;
  
  const userCedula = isRrhh && !emailFilter ? "N/A" : (session.user as any).cedula || "N/A (SSO)";
  
  let userCargo = isRrhh && !emailFilter ? "Departamento de Recursos Humanos" : ((session.user as any).cargo || "Empleado");

  // Obtener cargo de la API si es un número
  if (userCargo && !isNaN(Number(userCargo)) && (!isRrhh || emailFilter)) {
    try {
      const res = await fetch(`http://172.16.205.33:8000/api/catalogs/position/?id=${userCargo}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache'
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

  const currentDate = new Date().toLocaleDateString("es-ES", { timeZone: "America/Caracas" });

  return (
    <div className="min-h-screen bg-gray-200 py-8 print:bg-white print:py-0 text-black font-sans">
      <div className="max-w-4xl mx-auto bg-white p-12 shadow-2xl print:shadow-none print:p-0 print:max-w-none">
        
        {/* ENCABEZADO */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold text-[#9e1b22] tracking-tight">SUDEASEG</h1>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest mt-1">Ministerio del Poder Popular de Economía y Finanzas</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-700">Fecha: <span className="font-semibold">{currentDate}</span></p>
            <p className="text-sm text-gray-700 mt-1">Correlativo: <span className="font-semibold">{correlativo}</span></p>
          </div>
        </div>

        {/* TÍTULO */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold uppercase underline underline-offset-4 decoration-2">Relación de Facturas de Estacionamiento</h2>
        </div>

        {/* DATOS DEL EMPLEADO */}
        <div className="mb-8 space-y-2">
          <p className="text-base"><span className="font-bold">Nombres y Apellidos:</span> {userName}</p>
          <p className="text-base"><span className="font-bold">Cédula de Identidad:</span> {userCedula}</p>
          <p className="text-base"><span className="font-bold">Cargo:</span> {userCargo}</p>
        </div>

        {/* TABLA */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-gray-400 text-sm text-center">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 py-2 px-3 font-bold w-24">Fecha</th>
                <th className="border border-gray-400 py-2 px-3 font-bold w-32">Nro. Factura</th>
                <th className="border border-gray-400 py-2 px-3 font-bold">Nombre del Estacionamiento</th>
                <th className="border border-gray-400 py-2 px-3 font-bold w-48">Lugar</th>
                <th className="border border-gray-400 py-2 px-3 font-bold w-32">Monto</th>
              </tr>
            </thead>
            <tbody>
              {uniqueFacturas.map((f, i) => {
                const [y, m, d] = f.date.split("-");
                const formattedDate = `${d}/${m}/${y}`;
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border border-gray-400 py-2 px-3">{formattedDate}</td>
                    <td className="border border-gray-400 py-2 px-3">{f.invoice_number}</td>
                    <td className="border border-gray-400 py-2 px-3">{f.parking_name || "No especificado"}</td>
                    <td className="border border-gray-400 py-2 px-3">{f.location || "No especificado"}</td>
                    <td className="border border-gray-400 py-2 px-3 font-medium">Bs. {numberFormat.format(Number(f.amount))}</td>
                  </tr>
                );
              })}
              {uniqueFacturas.length === 0 && (
                <tr>
                  <td colSpan={5} className="border border-gray-400 py-4 text-gray-500 italic">No hay facturas registradas en este período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* DECLARACIÓN JURADA */}
        <p className="text-sm text-justify mb-8">
          Declaro bajo fe de juramento que la información suministrada y los documentos adjuntos son veraces y auténticos.
        </p>

        {/* TOTAL */}
        <div className="flex justify-end mb-16">
          <div className="flex items-center gap-4 text-lg">
            <span className="font-bold">Total:</span>
            <span className="font-extrabold border-b-2 border-black pb-1 min-w-[120px] text-right">Bs. {numberFormat.format(total_monto)}</span>
          </div>
        </div>

        {/* FIRMAS */}
        <div className="flex justify-between mt-12 mb-8">
          <div className="w-64 text-center">
            <div className="border-b border-black mb-2 h-10"></div>
            <p className="font-bold text-sm">Firma</p>
          </div>
          <div className="w-64 text-center">
            <div className="border-b border-black mb-2 h-10"></div>
            <p className="font-bold text-sm">Recibido Por:</p>
          </div>
        </div>

        {/* PIE DE PÁGINA */}
        <div className="text-[10px] text-center text-gray-500 mt-20 print:fixed print:bottom-4 print:w-full">
          <p>SUPERINTENDENCIA DE LA ACTIVIDAD ASEGURADORA (SUDEASEG) | RIF: G-20008047-7 | FINAL DE LA AV. VENEZUELA, TORRE DEL DESARROLLO,</p>
          <p>EL ROSAL, MUNICIPIO CHACAO, ZONA METROPOLITANA DE CARACAS, VENEZUELA, CÓDIGO POSTAL 1060.</p>
        </div>

        <PrintButton />
      </div>
    </div>
  );
}
