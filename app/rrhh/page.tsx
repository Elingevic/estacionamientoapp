"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { createClient } from "@supabase/supabase-js";
import { Download, Calendar, Search, ExternalLink, Activity, DollarSign, Receipt, AlertCircle, X, ShieldAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function RrhhDashboard() {
  const { data: session, status } = useSession();
  
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetchFacturas();
    }
  }, [status, startDate, endDate]);

  const fetchFacturas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("facturas")
        .select("*")
        .gte("fecha", startDate)
        .lte("fecha", endDate)
        .order("fecha", { ascending: false });

      if (error) throw error;
      setFacturas(data || []);
    } catch (error) {
      console.error("Error fetching facturas:", error);
      alert("Error cargando la data.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFacturas = facturas.filter(f => 
    f.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.nro_factura?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMonto = filteredFacturas.reduce((acc, f) => acc + Number(f.monto), 0);
  const totalTickets = filteredFacturas.length;
  const promedioTicket = totalTickets > 0 ? totalMonto / totalTickets : 0;

  const exportToExcel = () => {
    // Generar formato plano para Excel
    const dataToExport = filteredFacturas.map(f => ({
      "Fecha Escaneo": f.fecha,
      "Empleado (SSO)": f.user_id,
      "Nro. Factura": f.nro_factura,
      "Monto": Number(f.monto),
      "Link a Foto": f.image_url || "Sin foto"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
    XLSX.writeFile(workbook, `Consolidado_Nomina_${startDate}_${endDate}.xlsx`);
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando panel seguro...</div>;
  }

  // Protección de ruta: Solo los que tengan role "rrhh" pueden entrar.
  // (Asumimos que nuestro [...nextauth] route ya asocia este rol al correo del usuario)
  if (!session || (session.user as any).role !== "rrhh") {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full space-y-4 bg-slate-800 p-8 rounded-3xl shadow-xl border border-red-500/50 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Acceso Denegado</h1>
          <p className="text-slate-400 text-sm">Esta área es de uso exclusivo para el departamento de Recursos Humanos.</p>
          <Link href="/" className="inline-block mt-4 px-6 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition">
            Volver al Inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-300 font-sans p-4 md:p-8">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-400">Panel Central RRHH</h1>
          <p className="text-slate-500">Gestión de Reembolsos de Estacionamiento</p>
        </div>
        <div className="flex gap-4">
          <Link href="/" className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 transition text-sm font-medium">
            Ver App Móvil
          </Link>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-500/20 transition">
            <Download className="w-4 h-4" /> Exportar a Nómina (.xlsx)
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* FILTROS Y ESTADÍSTICAS LADO IZQUIERDO */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <h3 className="text-white font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-400"/> Periodo a Pagar</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Desde</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 text-white [color-scheme:dark]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Hasta</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 text-white [color-scheme:dark]" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <h3 className="text-white font-semibold flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-400"/> Consolidado Global</h3>
            
            <div className="space-y-4">
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/50">
                <p className="text-sm text-slate-500 flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4"/> Deuda Total</p>
                <p className="text-3xl font-bold text-white">${totalMonto.toFixed(2)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1">Tickets</p>
                  <p className="text-xl font-bold text-white">{totalTickets}</p>
                </div>
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/50">
                  <p className="text-xs text-slate-500 mb-1">Promedio</p>
                  <p className="text-xl font-bold text-white">${promedioTicket.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* TABLA CENTRAL */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col h-[800px]">
          
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2"><Receipt className="w-5 h-5"/> Auditoría de Facturas</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar por empleado o factura..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-blue-500 text-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-0">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                Sincronizando con base de datos...
              </div>
            ) : filteredFacturas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <AlertCircle className="w-12 h-12 mb-4 text-slate-700" />
                <p>No se encontraron facturas en este periodo.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-400">Fecha</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Empleado (Correo SSO)</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Nro. Factura</th>
                    <th className="px-6 py-4 font-semibold text-slate-400 text-right">Monto</th>
                    <th className="px-6 py-4 font-semibold text-slate-400 text-center">Auditoría (Foto)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredFacturas.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition group">
                      <td className="px-6 py-4 text-slate-400">{new Date(f.fecha).toLocaleDateString("es-ES")}</td>
                      <td className="px-6 py-4 font-medium text-white">{f.user_id}</td>
                      <td className="px-6 py-4 font-mono text-slate-400">{f.nro_factura}</td>
                      <td className="px-6 py-4 text-right font-medium text-emerald-400">${Number(f.monto).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        {f.image_url ? (
                          <button 
                            onClick={() => setSelectedImage(f.image_url)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition font-medium text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver Ticket
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600 italic">No disponible</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* MODAL PARA VER FOTOS (AUDITORÍA) */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="font-semibold text-white">Auditoría de Ticket Original</h3>
              <button onClick={() => setSelectedImage(null)} className="p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-900 flex items-center justify-center min-h-[50vh]">
              <img src={selectedImage} alt="Evidencia del Ticket" className="max-w-full h-auto object-contain rounded-xl shadow-lg border border-slate-800" />
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950 text-center">
              <a href={selectedImage} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm inline-flex items-center gap-2">
                <ExternalLink className="w-4 h-4"/> Abrir en pestaña nueva
              </a>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
