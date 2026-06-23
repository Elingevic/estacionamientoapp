"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Download, Calendar, Search, ExternalLink, Activity, DollarSign, Receipt, AlertCircle, X, ShieldAlert, Loader2, Building2, FileText, LogOut, BarChart3, Car, Bike } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function RrhhDashboard() {
  const { data: session, status } = useSession();
  
  const getInitialDates = () => {
    const d = new Date();
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday.toISOString().split("T")[0], end: sunday.toISOString().split("T")[0] };
  };

  const getInitialWeek = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  };

  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFactura, setEditingFactura] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  
  const { start: initStart, end: initEnd } = getInitialDates();
  const [startDate, setStartDate] = useState(initStart);
  const [endDate, setEndDate] = useState(initEnd);
  const [selectedWeek, setSelectedWeek] = useState(getInitialWeek);
  const [bcvRate, setBcvRate] = useState<number>(587.40);

  const [searchTerm, setSearchTerm] = useState("");

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"general" | "individual">("general");
  const [exportEmployee, setExportEmployee] = useState<string>("");

  const [exportEmployeeSearch, setExportEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFactura) return;
    setEditLoading(true);
    try {
      const amountVal = parseFloat(editingFactura.amount) || 0;
      const dataToUpdate: any = {
        date: editingFactura.date,
        invoice_number: editingFactura.invoice_number,
        amount: amountVal,
        parking_name: editingFactura.parking_name || "",
        location: editingFactura.location || "",
        vehicle_type: editingFactura.vehicle_type
      };

      const res = await fetch("/api/facturas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingFactura.id, ...dataToUpdate })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al actualizar");
      }

      alert("Registro actualizado correctamente");
      setEditingFactura(null);
      fetchFacturas(true);
    } catch (err: any) {
      alert("Error actualizando: " + (err?.message || "Desconocido"));
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/bcv")
      .then(res => res.json())
      .then(data => { if (data.tasa) setBcvRate(data.tasa); })
      .catch(e => console.error(e));
  }, []);

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedWeek(val);
    if (!val) return;
    
    const [year, week] = val.split('-W').map(Number);
    const jan4 = new Date(year, 0, 4);
    const dayOfJan4 = jan4.getDay() || 7;
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - dayOfJan4 + 1);
    
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
    
    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);

    setStartDate(targetMonday.toISOString().split('T')[0]);
    setEndDate(targetSunday.toISOString().split('T')[0]);
  };
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetchFacturas();
    }
  }, [status, startDate, endDate]);

  const fetchFacturas = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/facturas?start=${startDate}&end=${endDate}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      if (data) {
        setFacturas(data);
      }
    } catch (error) {
      console.error("Error fetching facturas:", error);
      alert("Error cargando la data.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filteredFacturas = facturas.filter(f => 
    f.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const facturasPorEmpleado = filteredFacturas.reduce((acc, f) => {
    if (!acc[f.user_id]) acc[f.user_id] = [];
    acc[f.user_id].push(f);
    return acc;
  }, {} as Record<string, any[]>);

  const listaEmpleados = Object.keys(facturasPorEmpleado).map(email => ({
    email,
    facturas: facturasPorEmpleado[email],
    totalMonto: facturasPorEmpleado[email].reduce((sum: number, f: any) => sum + Number(f.amount), 0),
    totalMontoUsd: facturasPorEmpleado[email].reduce((sum: number, f: any) => sum + Number(f.amount) / bcvRate, 0),
    totalTickets: facturasPorEmpleado[email].length
  }));

  const totalMonto = filteredFacturas.reduce((acc, f) => acc + Number(f.amount), 0);
  const totalMontoUsd = filteredFacturas.reduce((acc, f) => acc + Number(f.amount) / bcvRate, 0);
  const totalTickets = filteredFacturas.length;
  const promedioTicket = totalTickets > 0 ? totalMonto / totalTickets : 0;
  const promedioTicketUsd = totalTickets > 0 ? totalMontoUsd / totalTickets : 0;

  const triggerExportModal = () => {
    setExportType(selectedEmployee ? "individual" : "general");
    const initialEmp = selectedEmployee || "";
    setExportEmployee(initialEmp);
    setExportEmployeeSearch(initialEmp);
    setExportModalOpen(true);
  };

  const handleExportConfirm = () => {
    let dataSource = filteredFacturas;
    if (exportType === "individual") {
      dataSource = facturasPorEmpleado[exportEmployee] || [];
    }

    const dataToExport = dataSource.map((f: any) => ({
      "Fecha Escaneo": f.date,
      "Empleado (SSO)": f.user_id,
      "Nro. Factura": f.invoice_number,
      "Estacionamiento": f.parking_name || "Sin nombre",
      "Lugar": f.location || "Sin lugar",
      "Monto": Number(f.amount),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturas");
    XLSX.writeFile(workbook, `Consolidado_Nomina_${exportType}_${startDate}_${endDate}.xlsx`);
    setExportModalOpen(false);
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-brand-blue flex items-center justify-center text-white"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  }

  if (status === "unauthenticated") {
    if (typeof window !== "undefined") window.location.href = "/";
    return <div className="min-h-screen bg-slate-50" />;
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
        <div className="flex gap-4 w-full md:w-auto flex-wrap justify-end">
          <Link href="/" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 transition-all shadow-sm">
            <Receipt className="w-5 h-5" /> Mis Cargas
          </Link>
          <Link href="/dashboard" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-100 text-brand-blue font-bold hover:bg-blue-200 transition-all shadow-sm">
            <BarChart3 className="w-5 h-5" /> Estadísticas
          </Link>
          <button onClick={async () => {
            const keycloakIssuer = "http://172.16.205.33:8080/realms/sudeaseg";
            const clientId = "sudeparking";
            const idToken = (session as any)?.id_token;
            
            let logoutUrl = `${keycloakIssuer}/protocol/openid-connect/logout?client_id=${clientId}&post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
            if (idToken) {
              logoutUrl += `&id_token_hint=${idToken}`;
            }
            
            await signOut({ callbackUrl: logoutUrl });
          }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
            <LogOut className="w-5 h-5" /> Cerrar Sesión
          </button>
          <button onClick={triggerExportModal} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/30 transition-all">
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Semana</label>
                <input type="week" value={selectedWeek} onChange={handleWeekChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium text-slate-700" />
              </div>
              <div className="text-xs text-slate-400 font-medium">
                Cargando facturas del <strong className="text-slate-600">{new Date(startDate + "T12:00:00").toLocaleDateString("es-ES")}</strong> al <strong className="text-slate-600">{new Date(endDate + "T12:00:00").toLocaleDateString("es-ES")}</strong>
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
                <p className="text-4xl font-extrabold text-white">Bs. {totalMonto.toFixed(2)}</p>
                <p className="text-sm font-bold text-emerald-300 mt-1">≈ ${totalMontoUsd.toFixed(2)} USD</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
                  <p className="text-xs text-blue-200 mb-1 font-medium">Tickets</p>
                  <p className="text-2xl font-bold text-white">{totalTickets}</p>
                </div>
                <div className="bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
                  <p className="text-xs text-blue-200 mb-1 font-medium">Promedio</p>
                  <p className="text-xl font-bold text-white">Bs. {promedioTicket.toFixed(2)}</p>
                  <p className="text-xs font-bold text-emerald-300">≈ ${promedioTicketUsd.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* TABLA CENTRAL */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl shadow-xl flex flex-col h-[800px] overflow-hidden">
          
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            {selectedEmployee ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedEmployee(null)} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-200 transition-colors font-bold text-sm px-4">
                  Volver a Lista
                </button>
                <h2 className="text-xl font-bold text-brand-blue flex items-center gap-2"><Receipt className="w-5 h-5"/> Facturas de: <span className="text-slate-600">{selectedEmployee}</span></h2>
              </div>
            ) : (
              <h2 className="text-xl font-bold text-brand-blue flex items-center gap-2"><Receipt className="w-5 h-5"/> Registros de Empleados</h2>
            )}
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
                    {selectedEmployee ? (
                      <>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs">Fecha</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs">Nro. Factura</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Monto Bs.</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Monto USD</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Auditoría</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs">Empleado</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Tickets</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Monto Bs.</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right">Monto USD</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Acciones</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedEmployee ? (
                    facturasPorEmpleado[selectedEmployee]?.map((f: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-slate-600 font-medium">
                           <div className="flex flex-col items-start">
                             <span>{new Date(f.date + "T12:00:00").toLocaleDateString("es-ES")}</span>
                             {f.vehicle_type === "moto" ? (
                               <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-brand-red px-2 py-0.5 rounded-full font-bold mt-1 w-max"><Bike className="w-3 h-3"/> Moto</span>
                             ) : (
                               <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-brand-blue px-2 py-0.5 rounded-full font-bold mt-1 w-max"><Car className="w-3 h-3"/> Carro</span>
                             )}
                             <span className="text-xs font-semibold text-slate-700 mt-1">{f.parking_name || "Sin nombre"}</span>
                             <span className="text-[11px] text-slate-400">{f.location || "Sin lugar"}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-500">{f.invoice_number}</td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-emerald-600">Bs. {Number(f.amount).toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-bold text-slate-500">${(Number(f.amount) / bcvRate).toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 flex items-center justify-center gap-2">
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
                    ))
                  ) : (
                    listaEmpleados.map((emp: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-800">{emp.email}</td>
                        <td className="px-6 py-4 text-center font-medium text-slate-600">
                          <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">{emp.totalTickets} tickets</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-brand-blue">Bs. {emp.totalMonto.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-emerald-600">${emp.totalMontoUsd.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4 flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setSelectedEmployee(emp.email)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-bold text-xs"
                          >
                            Ver Detalles
                          </button>
                          <button 
                            onClick={() => window.open(`/api/generar-reporte?start=${startDate}&end=${endDate}&email=${encodeURIComponent(emp.email)}`, "_blank")}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-red text-white hover:bg-brand-darkred shadow-md transition-colors font-bold text-xs"
                          >
                            <FileText className="w-4 h-4" /> Word
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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

      {/* MODAL PARA EDITAR FACTURA */}
      {editingFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-brand-blue flex items-center gap-2">
                Editar Registro (RRHH)
              </h3>
              <button onClick={() => setEditingFactura(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</label>
                <input type="date" required value={editingFactura.date || ""} onChange={(e) => setEditingFactura({ ...editingFactura, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Estacionamiento</label>
                <input type="text" value={editingFactura.parking_name || ""} onChange={(e) => setEditingFactura({ ...editingFactura, parking_name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lugar</label>
                <input type="text" value={editingFactura.location || ""} onChange={(e) => setEditingFactura({ ...editingFactura, location: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nro. de Factura</label>
                <input type="text" required value={editingFactura.invoice_number || ""} onChange={(e) => setEditingFactura({ ...editingFactura, invoice_number: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Vehículo</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingFactura({...editingFactura, vehicle_type: "carro"})} className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${editingFactura.vehicle_type === "carro" ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-slate-200 text-slate-500"}`}>
                    <Car className="w-4 h-4" /> Carro
                  </button>
                  <button type="button" onClick={() => setEditingFactura({...editingFactura, vehicle_type: "moto"})} className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${editingFactura.vehicle_type === "moto" ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-slate-200 text-slate-500"}`}>
                    <Bike className="w-4 h-4" /> Moto
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monto (Bs.)</label>
                <input type="number" step="0.01" required value={editingFactura.amount || ""} onChange={(e) => setEditingFactura({ ...editingFactura, amount: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-semibold" />
              </div>
              
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setEditingFactura(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm">Cancelar</button>
                <button type="submit" disabled={editLoading} className="flex-1 py-2.5 rounded-xl bg-brand-blue text-white font-bold flex justify-center items-center shadow-md text-sm">
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA EXPORTAR */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="relative max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-brand-blue mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" /> Opciones de Exportación
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Exportación</label>
                <select value={exportType} onChange={e => setExportType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-medium">
                  <option value="general">General (Todos los registros)</option>
                  <option value="individual">Individual (Un empleado)</option>
                </select>
              </div>

              {exportType === "individual" && (
                <div className="space-y-1 relative" onMouseLeave={() => setShowEmployeeDropdown(false)}>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buscar Empleado</label>
                  <input 
                    type="text" 
                    placeholder="Escribe para buscar..."
                    value={exportEmployeeSearch}
                    onChange={e => {
                      setExportEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                      setExportEmployee(""); // Limpiar selección si tipea
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-medium"
                  />
                  {showEmployeeDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {listaEmpleados
                        .filter(e => e.email.toLowerCase().includes(exportEmployeeSearch.toLowerCase()))
                        .map(e => (
                          <div 
                            key={e.email} 
                            className="px-4 py-2.5 hover:bg-brand-blue/5 cursor-pointer text-sm font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setExportEmployee(e.email);
                              setExportEmployeeSearch(e.email);
                              setShowEmployeeDropdown(false);
                            }}
                          >
                            {e.email}
                          </div>
                      ))}
                      {listaEmpleados.filter(e => e.email.toLowerCase().includes(exportEmployeeSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500 italic text-center">No se encontraron resultados</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setExportModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm transition-colors">Cancelar</button>
                <button type="button" disabled={exportType === "individual" && !exportEmployee} onClick={handleExportConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Descargar Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
