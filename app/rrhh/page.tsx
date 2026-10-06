"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Download, Calendar, Search, ExternalLink, Activity, DollarSign, Receipt, AlertCircle, X, ShieldAlert, Loader2, Building2, FileText, LogOut, BarChart3, Car, Bike, Pencil, Lock, Info, Trash2, Filter, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

import { getCurrentPayrollCycle, getPreviousPayrollCycle, getPayrollWeekString } from "../../lib/dates";
import { round2 } from "../../lib/formatters";

export default function RrhhDashboard() {
  const { data: session, status } = useSession();
  
  const getInitialDates = () => {
    return getCurrentPayrollCycle();
  };

  const getInitialWeek = () => {
    return getPayrollWeekString();
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
  const [infoModal, setInfoModal] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAllEmployeeHistory, setShowAllEmployeeHistory] = useState<boolean>(false);


  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"general" | "individual">("general");
  const [exportEmployee, setExportEmployee] = useState<string>("");
  const [exportWeek, setExportWeek] = useState(getInitialWeek);
  const [exportStartDate, setExportStartDate] = useState(initStart);
  const [exportEndDate, setExportEndDate] = useState(initEnd);
  const [isExporting, setIsExporting] = useState(false);

  const formatName = (email: string) => {
    if (!email) return "Desconocido";
    const namePart = email.split('@')[0];
    return namePart.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este registro? El empleado tendrá que cargarlo nuevamente.")) return;
    try {
      const res = await fetch(`/api/facturas?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al eliminar");
      }
      alert("Factura eliminada correctamente");
      fetchFacturas(true);
    } catch (err: any) {
      alert(err.message);
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
    
    const targetSaturday = new Date(targetMonday);
    targetSaturday.setDate(targetMonday.getDate() - 2);
    
    const targetFriday = new Date(targetSaturday);
    targetFriday.setDate(targetSaturday.getDate() + 6);

    setStartDate(targetSaturday.toISOString().split('T')[0]);
    setEndDate(targetFriday.toISOString().split('T')[0]);
  };

  const handleExportWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setExportWeek(val);
    if (!val) return;
    
    const [year, week] = val.split('-W').map(Number);
    const jan4 = new Date(year, 0, 4);
    const dayOfJan4 = jan4.getDay() || 7;
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - dayOfJan4 + 1);
    
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (week - 1) * 7);

    const targetSaturday = new Date(targetMonday);
    targetSaturday.setDate(targetMonday.getDate() - 2);
    
    const targetFriday = new Date(targetSaturday);
    targetFriday.setDate(targetSaturday.getDate() + 6);

    setExportStartDate(targetSaturday.toISOString().split('T')[0]);
    setExportEndDate(targetFriday.toISOString().split('T')[0]);
  };
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchFacturas();
    }
  }, [status, startDate, endDate, debouncedSearch, filterVehicle, filterStatus, showAllEmployeeHistory, selectedEmployee]);

  const fetchFacturas = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let url = `/api/facturas?`;
      if (debouncedSearch && debouncedSearch.trim().length > 0) {
        // Al escribir en el buscador (número de factura, correo o lugar), busca en todo el historial sin límite de fecha
        url += `search=${encodeURIComponent(debouncedSearch.trim())}&all=true`;
        if (selectedEmployee) {
          url += `&email=${encodeURIComponent(selectedEmployee)}`;
        }
      } else if (showAllEmployeeHistory && selectedEmployee) {
        url += `email=${encodeURIComponent(selectedEmployee)}&all=true`;
      } else {
        url += `start=${startDate}&end=${endDate}`;
        if (selectedEmployee) {
          url += `&email=${encodeURIComponent(selectedEmployee)}`;
        }
      }

      if (filterVehicle !== "all") {
        url += `&vehicle_type=${filterVehicle}`;
      }
      if (filterStatus !== "all") {
        url += `&status=${filterStatus}`;
      }
      const res = await fetch(url);
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

  const filteredFacturas = facturas.filter(f => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      f.user_id?.toLowerCase().includes(s) ||
      f.invoice_number?.toLowerCase().includes(s) ||
      f.parking_name?.toLowerCase().includes(s) ||
      f.location?.toLowerCase().includes(s);
    const matchesVehicle = filterVehicle === "all" || f.vehicle_type === filterVehicle;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "pending" && !f.report_sequence) ||
      (filterStatus === "processed" && Boolean(f.report_sequence));
    return matchesSearch && matchesVehicle && matchesStatus;
  });

  const facturasPorEmpleado = filteredFacturas.reduce((acc, f) => {
    if (!acc[f.user_id]) acc[f.user_id] = [];
    acc[f.user_id].push(f);
    return acc;
  }, {} as Record<string, any[]>);

  const listaEmpleados = Object.keys(facturasPorEmpleado).map(email => ({
    email,
    facturas: facturasPorEmpleado[email],
    totalMonto: facturasPorEmpleado[email].reduce((sum: number, f: any) => sum + Number(f.amount), 0),
    totalMontoUsd: facturasPorEmpleado[email].reduce((sum: number, f: any) => sum + Number(f.amount) / (f.exchange_rate || bcvRate), 0),
    totalTickets: facturasPorEmpleado[email].length
  }));

  const totalMonto = filteredFacturas.reduce((acc, f) => acc + Number(f.amount), 0);
  const totalMontoUsd = filteredFacturas.reduce((acc, f) => acc + Number(f.amount) / (f.exchange_rate || bcvRate), 0);
  const totalTickets = filteredFacturas.length;
  const promedioTicket = totalTickets > 0 ? totalMonto / totalTickets : 0;
  const promedioTicketUsd = totalTickets > 0 ? totalMontoUsd / totalTickets : 0;
  const totalCarros = new Set(filteredFacturas.filter(f => f.vehicle_type === "carro" || !f.vehicle_type).map(f => f.user_id)).size;
  const totalMotos = new Set(filteredFacturas.filter(f => f.vehicle_type === "moto").map(f => f.user_id)).size;

  const triggerExportModal = () => {
    setExportType(selectedEmployee ? "individual" : "general");
    const initialEmp = selectedEmployee || "";
    setExportEmployee(initialEmp);
    setExportEmployeeSearch(initialEmp);
    setExportWeek(selectedWeek);
    setExportStartDate(startDate);
    setExportEndDate(endDate);
    setExportModalOpen(true);
  };

  const handleExportConfirm = async () => {
    setIsExporting(true);
    try {
      // Obtener datos frescos para la fecha seleccionada en el modal de exportación
      const res = await fetch(`/api/facturas?start=${exportStartDate}&end=${exportEndDate}`);
      if (!res.ok) throw new Error("Error fetching data for export");
      const exportData = await res.json();
      
      let dataSource = exportData;
      if (exportType === "individual" && exportEmployee) {
        dataSource = exportData.filter((f: any) => f.user_id === exportEmployee);
      }

      if (dataSource.length === 0) {
        alert("No hay registros para exportar en este período.");
        setIsExporting(false);
        return;
      }

      const workbook = XLSX.utils.book_new();
      
      const porEmpleadoExport = dataSource.reduce((acc: any, f: any) => {
        if (!acc[f.user_id]) acc[f.user_id] = [];
        acc[f.user_id].push(f);
        return acc;
      }, {});

      const dataResumen = Object.keys(porEmpleadoExport).map(email => {
        const facts = porEmpleadoExport[email];
        
        const carros = facts.filter((f: any) => f.vehicle_type === "carro" || !f.vehicle_type);
        const motos = facts.filter((f: any) => f.vehicle_type === "moto");
        
        const totalBsCarro = carros.reduce((sum: number, f: any) => sum + Number(f.amount), 0);
        const totalUsdCarro = carros.reduce((sum: number, f: any) => sum + (Number(f.amount) / (f.exchange_rate || bcvRate)), 0);
        const tarifaCarro = carros.length > 0 ? (totalBsCarro / carros.length) : 0;
        
        const totalBsMoto = motos.reduce((sum: number, f: any) => sum + Number(f.amount), 0);
        const totalUsdMoto = motos.reduce((sum: number, f: any) => sum + (Number(f.amount) / (f.exchange_rate || bcvRate)), 0);
        const tarifaMoto = motos.length > 0 ? (totalBsMoto / motos.length) : 0;
        
        const totalBs = facts.reduce((sum: number, f: any) => sum + Number(f.amount), 0);
        const totalUsd = facts.reduce((sum: number, f: any) => sum + (Number(f.amount) / (f.exchange_rate || bcvRate)), 0);

        return {
          "Empleado": formatName(email),
          "Desde": exportStartDate,
          "Hasta": exportEndDate,
          "Tickets de Carro": carros.length,
          "Tarifa Carro": round2(tarifaCarro),
          "Total Bs. Carro": round2(totalBsCarro),
          "Total USD Carro": round2(totalUsdCarro),
          "Tickets de Moto": motos.length,
          "Tarifa Moto": round2(tarifaMoto),
          "Total Bs. Moto": round2(totalBsMoto),
          "Total USD Moto": round2(totalUsdMoto),
          "Total Cantidad de Tickets": facts.length,
          "Monto Total Bs.": round2(totalBs),
          "Monto Total USD": round2(totalUsd),
        };
      });

      if (dataResumen.length > 0) {
        const resumenSheet = XLSX.utils.json_to_sheet(dataResumen);
        XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");
      }

      const dataDetalles = dataSource.map((f: any) => ({
        "Fecha Escaneo": f.date,
        "Empleado": formatName(f.user_id),
        "Nro. Factura": f.invoice_number,
        "Tipo de Cambio (BCV)": round2(Number(f.exchange_rate || bcvRate)),
        "Monto Bs.": round2(Number(f.amount)),
        "Monto USD": round2(Number(f.amount) / (f.exchange_rate || bcvRate)),
      }));

      if (dataDetalles.length > 0) {
        const detallesSheet = XLSX.utils.json_to_sheet(dataDetalles);
        XLSX.utils.book_append_sheet(workbook, detallesSheet, "Detalles");
      }

      XLSX.writeFile(workbook, `Consolidado_Nomina_${exportType}_${exportStartDate}_${exportEndDate}.xlsx`);
      setExportModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Error al generar el archivo Excel");
    } finally {
      setIsExporting(false);
    }
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
            <h1 className="text-3xl font-extrabold text-brand-blue tracking-tight">estacionamiento.sudeaseg.gob.ve RRHH</h1>
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
          <button 
            onClick={() => {
              window.location.href = "/api/auth/federated-logout";
            }} 
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
          >
            <LogOut className="w-5 h-5" /> Cerrar Sesión
          </button>
          <button onClick={triggerExportModal} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/30 transition-all">
            <Download className="w-5 h-5" /> Exportar Nómina
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* FILTROS Y ESTADÍSTICAS LADO IZQUIERDO */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* PERIODO A PAGAR MEJORADO */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-lg space-y-4">
            <h3 className="text-brand-blue font-bold flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-brand-blue"/> Periodo a Pagar
            </h3>
            
            {/* Visualizador de semana activo */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ciclo Nómina</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-brand-blue rounded-md">
                  Sáb a Vie
                </span>
              </div>
              <p className="text-sm font-extrabold text-slate-800">
                Semana {selectedWeek.split('-W')[1] || "—"}, {selectedWeek.split('-W')[0] || ""}
              </p>
              <p className="text-xs text-brand-blue font-semibold">
                {new Date(startDate + "T12:00:00").toLocaleDateString("es-ES")} — {new Date(endDate + "T12:00:00").toLocaleDateString("es-ES")}
              </p>
            </div>

            {/* Botones de Preajustes Rápidos */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const cycle = getCurrentPayrollCycle();
                  setStartDate(cycle.start);
                  setEndDate(cycle.end);
                  setSelectedWeek(getPayrollWeekString());
                  setShowAllEmployeeHistory(false);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-center"
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => {
                  const prev = getPreviousPayrollCycle();
                  setStartDate(prev.start);
                  setEndDate(prev.end);
                  setSelectedWeek(getPayrollWeekString(new Date(prev.start + "T12:00:00")));
                  setShowAllEmployeeHistory(false);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-center"
              >
                Semana Anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                  setStartDate(firstDay);
                  setEndDate(lastDay);
                  setShowAllEmployeeHistory(false);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-center"
              >
                Mes Actual
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const startYear = `${now.getFullYear()}-01-01`;
                  const endYear = `${now.getFullYear()}-12-31`;
                  setStartDate(startYear);
                  setEndDate(endYear);
                  setShowAllEmployeeHistory(false);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-brand-blue rounded-xl transition text-center"
              >
                Todo el Año
              </button>
            </div>

            {/* Selector manual de fechas Desde / Hasta */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Desde</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => {
                      setStartDate(e.target.value);
                      setShowAllEmployeeHistory(false);
                    }} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs outline-none focus:border-brand-blue font-semibold text-slate-700 shadow-sm" 
                  />
                </div>
                <div className="w-1/2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Hasta</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => {
                      setEndDate(e.target.value);
                      setShowAllEmployeeHistory(false);
                    }} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs outline-none focus:border-brand-blue font-semibold text-slate-700 shadow-sm" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-brand-blue rounded-3xl p-5 shadow-xl relative overflow-hidden text-white">
            {/* Efecto de fondo */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-white font-bold flex items-center gap-2 text-base">
                <Activity className="w-5 h-5 text-emerald-400"/> Consolidado Global
              </h3>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                {debouncedSearch ? "Búsqueda" : "En Periodo"}
              </span>
            </div>
            
            <div className="space-y-3 relative z-10">
              <div className="bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
                <p className="text-xs text-blue-200 flex items-center gap-1.5 mb-1 font-semibold">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400"/> Deuda Total
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight break-all">
                  Bs. {totalMonto.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </p>
                <p className="text-xs font-bold text-emerald-300 mt-1">
                  ≈ ${totalMontoUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-black/20 rounded-2xl p-3 border border-white/10 backdrop-blur-sm">
                  <p className="text-[11px] text-blue-200 font-semibold mb-0.5 flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-blue-300"/> Tickets
                  </p>
                  <p className="text-xl font-extrabold text-white">{totalTickets}</p>
                </div>

                <div className="bg-black/20 rounded-2xl p-3 border border-white/10 backdrop-blur-sm">
                  <p className="text-[11px] text-blue-200 font-semibold mb-0.5">Promedio</p>
                  <p className="text-sm font-extrabold text-white leading-tight">
                    Bs. {promedioTicket.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-300">
                    ≈ ${promedioTicketUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>

                <div className="bg-black/20 rounded-2xl p-3 border border-white/10 backdrop-blur-sm">
                  <p className="text-[11px] text-blue-200 font-semibold mb-0.5 flex items-center gap-1">
                    <Car className="w-3 h-3 text-blue-300"/> Carros
                  </p>
                  <p className="text-xl font-extrabold text-white">{totalCarros} <span className="text-[10px] font-normal text-blue-200">pers.</span></p>
                </div>

                <div className="bg-black/20 rounded-2xl p-3 border border-white/10 backdrop-blur-sm">
                  <p className="text-[11px] text-blue-200 font-semibold mb-0.5 flex items-center gap-1">
                    <Bike className="w-3 h-3 text-red-300"/> Motos
                  </p>
                  <p className="text-xl font-extrabold text-white">{totalMotos} <span className="text-[10px] font-normal text-blue-200">pers.</span></p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* TABLA CENTRAL */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl shadow-xl flex flex-col h-[800px] overflow-hidden">
          
          <div className="p-6 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {selectedEmployee ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => { setSelectedEmployee(null); setShowAllEmployeeHistory(false); }} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-200 transition-colors font-bold text-sm px-4">
                    Volver a Lista
                  </button>
                  <h2 className="text-xl font-bold text-brand-blue flex items-center gap-2">
                    <Receipt className="w-5 h-5"/> Facturas de: <span className="text-slate-700">{selectedEmployee}</span>
                  </h2>
                  <button
                    onClick={() => setShowAllEmployeeHistory(!showAllEmployeeHistory)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${showAllEmployeeHistory ? 'bg-brand-blue text-white border-brand-blue shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {showAllEmployeeHistory ? "✓ Viendo todo su histórico" : "Ver todo su histórico"}
                  </button>
                </div>
              ) : (
                <h2 className="text-xl font-bold text-brand-blue flex items-center gap-2">
                  <Receipt className="w-5 h-5"/> Registros de Empleados
                </h2>
              )}
              <div className="relative w-full sm:w-80">
                <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar factura, correo o lugar..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-10 py-3 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-medium text-slate-700 shadow-sm text-sm"
                />
                {searchTerm && (
                  <button 
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Aviso informativo de búsqueda global activa */}
            {debouncedSearch && (
              <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-brand-blue shadow-sm animate-in fade-in duration-150">
                <span className="flex items-center gap-2 font-medium">
                  <Search className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                  Búsqueda global: <strong>"{debouncedSearch}"</strong> ({filteredFacturas.length} {filteredFacturas.length === 1 ? 'resultado' : 'resultados'} en todo el historial)
                </span>
                <button 
                  onClick={() => setSearchTerm("")}
                  className="text-xs font-bold text-slate-500 hover:text-brand-red flex items-center gap-1 transition-colors ml-2 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar
                </button>
              </div>
            )}

            {/* Barra de Filtros secundarios */}
            <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-200/60 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filtrar:
              </span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] text-slate-400 font-semibold px-2">Vehículo:</span>
                <button
                  type="button"
                  onClick={() => setFilterVehicle("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${filterVehicle === "all" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterVehicle("carro")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${filterVehicle === "carro" ? "bg-brand-blue text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Carros
                </button>
                <button
                  type="button"
                  onClick={() => setFilterVehicle("moto")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${filterVehicle === "moto" ? "bg-brand-red text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Motos
                </button>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] text-slate-400 font-semibold px-2">Estado:</span>
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${filterStatus === "all" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("pending")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${filterStatus === "pending" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("processed")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${filterStatus === "processed" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  Procesadas
                </button>
              </div>
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
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                  <tr>
                    {selectedEmployee ? (
                      <>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs w-[32%] min-w-[220px]">Fecha y Estacionamiento</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs w-[16%] min-w-[120px]">Nro. Factura</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[16%] min-w-[120px]">Monto Bs.</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[14%] min-w-[100px]">Monto USD</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center w-[22%] min-w-[180px]">Auditoría</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs w-[35%] min-w-[220px]">Empleado</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center w-[15%] min-w-[100px]">Tickets</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[18%] min-w-[120px]">Monto Bs.</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-right w-[14%] min-w-[100px]">Monto USD</th>
                        <th className="px-6 py-5 font-bold text-slate-500 uppercase tracking-wider text-xs text-center w-[18%] min-w-[160px]">Acciones</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedEmployee ? (
                    facturasPorEmpleado[selectedEmployee]?.map((f: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-slate-600 font-medium max-w-[260px]">
                           <div className="flex flex-col items-start max-w-full">
                             <span className="font-bold text-slate-800">{new Date(f.date + "T12:00:00").toLocaleDateString("es-ES")}</span>
                             {f.vehicle_type === "moto" ? (
                               <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-brand-red px-2 py-0.5 rounded-full font-bold mt-1 w-max"><Bike className="w-3 h-3"/> Moto</span>
                             ) : (
                               <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-brand-blue px-2 py-0.5 rounded-full font-bold mt-1 w-max"><Car className="w-3 h-3"/> Carro</span>
                             )}
                             <span className="text-xs font-semibold text-slate-700 mt-1 truncate max-w-[240px] block" title={f.parking_name}>{f.parking_name || "Sin nombre"}</span>
                             <span className="text-[11px] text-slate-400 truncate max-w-[240px] block" title={f.location}>{f.location || "Sin lugar"}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-500 whitespace-nowrap">
                          <span className="truncate max-w-[130px] block" title={f.invoice_number}>{f.invoice_number}</span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <p className="font-bold text-emerald-600">Bs. {Number(f.amount).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <p className="text-sm font-bold text-slate-500">${(Number(f.amount) / (f.exchange_rate || bcvRate)).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {f.image_url ? (
                              <button 
                                onClick={() => setSelectedImage(f.image_url)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 transition-colors font-bold text-xs"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Ver
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium italic">Sin evidencia</span>
                            )}
                            <button 
                              onClick={() => setEditingFactura(f)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors font-bold text-xs"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button 
                              onClick={() => handleDelete(f.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-red/5 text-brand-red hover:bg-brand-red/10 transition-colors font-bold text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </button>
                            {f.report_sequence && (
                              <span 
                                title="Factura ya exportada en nómina" 
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-400 cursor-help"
                              >
                                <Lock className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    listaEmpleados.map((emp: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <span className="truncate max-w-sm block" title={emp.email}>{formatName(emp.email)}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-slate-600 whitespace-nowrap">
                          <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">{emp.totalTickets} tickets</span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <p className="font-bold text-brand-blue">Bs. {emp.totalMonto.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <p className="font-bold text-emerald-600">${emp.totalMontoUsd.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => setSelectedEmployee(emp.email)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-bold text-xs"
                            >
                              Ver Detalles
                            </button>
                            <div className="flex items-center gap-2">
                              <div 
                                title="Al exportar el reporte, las facturas del empleado se marcarán como 'Procesadas' de forma permanente y ya no podrán ser editadas ni eliminadas." 
                                onClick={() => setInfoModal("Al exportar el reporte, las facturas del empleado se marcarán como 'Procesadas' de forma permanente y ya no podrán ser editadas ni eliminadas.")}
                                className="cursor-help group relative flex items-center justify-center"
                              >
                                <Info className="w-4 h-4 text-slate-400 hover:text-brand-blue transition-colors" />
                              </div>
                              <button 
                                onClick={() => window.open(`/api/generar-reporte?start=${startDate}&end=${endDate}&email=${encodeURIComponent(emp.email)}`, "_blank")}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-red text-white hover:bg-brand-darkred shadow-md transition-colors font-bold text-xs"
                              >
                                <FileText className="w-4 h-4" /> Exportar Word
                              </button>
                            </div>
                          </div>
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
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={20} required value={editingFactura.invoice_number || ""} onChange={(e) => setEditingFactura({ ...editingFactura, invoice_number: e.target.value.replace(/\D/g, "") })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-mono" />
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
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={bcvRate ? Number((bcvRate * 20).toFixed(2)) : 15000}
                  required
                  value={editingFactura.amount || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const maxMonto = bcvRate ? Number((bcvRate * 20).toFixed(2)) : 15000;
                    if (val.length <= 10 && (val === "" || parseFloat(val) <= maxMonto)) {
                      setEditingFactura({ ...editingFactura, amount: val });
                    }
                  }}
                  onInvalid={(e) => {
                    const target = e.target as HTMLInputElement;
                    const maxMonto = bcvRate ? Number((bcvRate * 20).toFixed(2)) : 15000;
                    if (target.validity.valueMissing) {
                      target.setCustomValidity("El monto es requerido. Por favor ingrese el monto.");
                    } else if (target.validity.rangeOverflow) {
                      target.setCustomValidity(`El monto no puede superar los $20 USD (Bs. ${maxMonto.toFixed(2)})`);
                    } else if (target.validity.rangeUnderflow) {
                      target.setCustomValidity("El monto debe ser un número mayor a cero.");
                    } else {
                      target.setCustomValidity("Por favor ingrese un monto válido.");
                    }
                  }}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-semibold"
                />
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Semana a Exportar</label>
                <div className="relative">
                  <input type="week" value={exportWeek} onChange={handleExportWeekChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-transparent relative z-10 cursor-pointer" />
                  <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                    <span className="text-sm font-medium text-slate-700">Semana {exportWeek.split('-W')[1]}, {exportWeek.split('-W')[0]}</span>
                    <Calendar className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </div>

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
                    placeholder="Escribe para buscar (correo o nombre)..."
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
                        .filter(e => e.email.toLowerCase().includes(exportEmployeeSearch.toLowerCase()) || formatName(e.email).toLowerCase().includes(exportEmployeeSearch.toLowerCase()))
                        .map(e => (
                          <div 
                            key={e.email} 
                            className="px-4 py-2.5 hover:bg-brand-blue/5 cursor-pointer text-sm font-medium text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setExportEmployee(e.email);
                              setExportEmployeeSearch(formatName(e.email));
                              setShowEmployeeDropdown(false);
                            }}
                          >
                            {formatName(e.email)} <span className="text-xs text-slate-400 block">{e.email}</span>
                          </div>
                      ))}
                      {listaEmpleados.filter(e => e.email.toLowerCase().includes(exportEmployeeSearch.toLowerCase()) || formatName(e.email).toLowerCase().includes(exportEmployeeSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500 italic text-center">No se encontraron resultados</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setExportModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm transition-colors">Cancelar</button>
                <button type="button" disabled={isExporting || (exportType === "individual" && !exportEmployee)} onClick={handleExportConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Descargar Excel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INFORMACION */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="relative max-w-sm w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-blue-50 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Información</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
              {infoModal}
            </p>
            <button 
              onClick={() => setInfoModal(null)} 
              className="w-full bg-brand-blue hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}



    </main>
  );
}
