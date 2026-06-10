"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { createClient } from "@supabase/supabase-js";
import { Download, Calendar, Search, ExternalLink, Activity, DollarSign, Receipt, AlertCircle, X, ShieldAlert, Loader2, Building2 } from "lucide-react";
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
    return <div className="min-h-screen bg-brand-blue flex items-center justify-center text-white"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  }

  if (!session || (session.user as any).role !== "rrhh") {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-800">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-2xl border border-brand-red/20 text-center">
          <ShieldAlert className="w-20 h-20 text-brand-red mx-auto drop-shadow-md" />
          <h1 className="text-3xl font-extrabold text-brand-blue">Acceso Denegado</h1>
          <p className="text-slate-500 font-medium">Esta área es de uso exclusivo para el departamento de Recursos Humanos de SUDEASEG.</p>
          <Link href="/" className="inline-block mt-4 w-full py-3.5 bg-brand-blue hover:bg-[#1f2a54] text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">
            Volver al Inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      
      {/* HEADER */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 mb-10 bg-white p-6 rounded-3xl shadow-md border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="bg-brand-blue p-3 rounded-xl shadow-md">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-brand-blue tracking-tight">SudeParking RRHH</h1>
            <p className="text-slate-500 font-medium">Auditoría y Gestión de Reembolsos</p>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Link href="/" className="flex-1 md:flex-none text-center px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
            Volver a App
          </Link>
          <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/30 transition-all">
            <Download className="w-5 h-5" /> Exportar Nómina
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* FILTROS Y ESTADÍSTICAS LADO IZQUIERDO */}
        <div className="lg:col-span-1 space-y-8">
          
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-lg">
            <h3 className="text-brand-blue font-bold flex items-center gap-2 text-lg mb-6"><Calendar className="w-5 h-5"/> Periodo a Pagar</h3>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desde</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium text-slate-700" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasta</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium text-slate-700" />
              </div>
            </div>
          </div>

          <div className="bg-brand-blue rounded-3xl p-6 shadow-xl relative overflow-hidden">
            {/* Efecto de fondo */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <h3 className="text-white font-bold flex items-center gap-2 text-lg mb-6"><Activity className="w-5 h-5 text-emerald-400"/> Consolidado Global</h3>
            
            <div className="space-y-4 relative z-10">
              <div className="bg-black/20 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                <p className="text-sm text-blue-200 flex items-center gap-2 mb-1 font-medium"><DollarSign className="w-4 h-4"/> Deuda Total</p>
                <p className="text-4xl font-extrabold text-white">${totalMonto.toFixed(2)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
                  <p className="text-xs text-blue-200 mb-1 font-medium">Tickets</p>
                  <p className="text-2xl font-bold text-white">{totalTickets}</p>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
                  <p className="text-xs text-blue-200 mb-1 font-medium">Promedio</p>
                  <p className="text-xl font-bold text-white">${promedioTicket.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* TABLA CENTRAL */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl shadow-xl flex flex-col h-[800px] overflow-hidden">
          
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <h2 className="text-xl font-bold text-brand-blue flex items-center gap-2"><Receipt className="w-5 h-5"/> Registros de Facturas</h2>
            <div className="relative w-full sm:w-80">
              <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por correo o factura..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium text-slate-700 shadow-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-0">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-blue" />
                <span className="font-medium">Sincronizando con base de datos...</span>
              </div>
            ) : filteredFacturas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <AlertCircle className="w-16 h-16 mb-4 text-slate-300" />
                <p className="font-medium">No se encontraron facturas en este periodo.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs">Fecha</th>
                    <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs">Empleado</th>
                    <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs">Nro. Factura</th>
                    <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Monto</th>
                    <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFacturas.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 text-slate-600 font-medium">{new Date(f.fecha).toLocaleDateString("es-ES")}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{f.user_id}</td>
                      <td className="px-6 py-4 font-mono font-medium text-slate-500">{f.nro_factura}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">${Number(f.monto).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        {f.image_url ? (
                          <button 
                            onClick={() => setSelectedImage(f.image_url)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 transition-colors font-bold text-xs"
                          >
                            <ExternalLink className="w-4 h-4" /> Ver Ticket
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium italic">Sin evidencia</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-white rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-brand-blue flex items-center gap-2"><Receipt className="w-5 h-5"/> Ticket Original</h3>
              <button onClick={() => setSelectedImage(null)} className="p-2 bg-slate-200 hover:bg-brand-red/10 hover:text-brand-red rounded-xl transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100/50 flex items-center justify-center min-h-[50vh]">
              <img src={selectedImage} alt="Evidencia del Ticket" className="max-w-full h-auto object-contain rounded-xl shadow-lg border border-slate-200" />
            </div>
            <div className="p-5 border-t border-slate-100 bg-white text-center">
              <a href={selectedImage} target="_blank" rel="noreferrer" className="text-brand-blue hover:text-brand-red hover:underline text-sm font-bold inline-flex items-center gap-2 transition-colors">
                <ExternalLink className="w-4 h-4"/> Abrir en pestaña completa
              </a>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
