"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  FileText,
  Trash2,
  Edit3,
  Calendar,
  Loader2,
  AlertCircle,
  Database,
  Building2,
} from "lucide-react";

interface AuditLog {
  id: number | string;
  user_email: string;
  action: "EDIT" | "DELETE";
  target_invoice_id: string;
  target_user_email?: string | null;
  details?: {
    old?: any;
    new?: any;
  };
  created_at: string;
}

export default function AuditoriaPage() {
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      params.set("limit", "100");

      const res = await fetch(`/api/auditoria?${params.toString()}`);
      if (!res.ok) throw new Error("Error al consultar auditoría");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchLogs();
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-blue" />
      </div>
    );
  }

  const isRrhh = (session?.user as any)?.role === "rrhh";

  if (!isRrhh) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-red-100 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Restringido (403)</h2>
          <p className="text-sm text-slate-500 mb-6">
            Solo el rol de Recursos Humanos / Administrador tiene autorización para consultar los registros de auditoría.
          </p>
          <Link href="/" className="inline-block py-2.5 px-6 rounded-xl bg-brand-blue text-white font-bold text-sm">
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_invoice_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === "ALL" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const totalEdits = logs.filter((l) => l.action === "EDIT").length;
  const totalDeletes = logs.filter((l) => l.action === "DELETE").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* HEADER INSTITUCIONAL */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/rrhh"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition flex items-center gap-2 text-sm font-bold"
              title="Volver al Panel RRHH"
            >
              <ArrowLeft className="w-4 h-4" /> Panel RRHH
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-lg font-black text-slate-800 tracking-tight">
                  MÓDULO DE AUDITORÍA Y TRAZABILIDAD
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Superintendencia de la Actividad Aseguradora (SUDEASEG) • Control Interno
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold flex items-center gap-2 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition"
            >
              Inicio
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* TARJETAS DE RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-bold">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Eventos</p>
              <p className="text-2xl font-black text-slate-800">{logs.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Edit3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ediciones por RRHH</p>
              <p className="text-2xl font-black text-slate-800">{totalEdits}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eliminaciones por RRHH</p>
              <p className="text-2xl font-black text-slate-800">{totalDeletes}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado Cumplimiento</p>
              <p className="text-sm font-bold text-emerald-600">Activo (Inmutable)</p>
            </div>
          </div>
        </div>

        {/* FILTROS Y BÚSQUEDA */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por usuario, empleado o factura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-brand-blue"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs text-slate-700"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs text-slate-700"
              />
            </div>

            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
              <button
                onClick={() => setActionFilter("ALL")}
                className={`px-3 py-2 ${actionFilter === "ALL" ? "bg-brand-blue text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Todos
              </button>
              <button
                onClick={() => setActionFilter("EDIT")}
                className={`px-3 py-2 ${actionFilter === "EDIT" ? "bg-amber-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Edición
              </button>
              <button
                onClick={() => setActionFilter("DELETE")}
                className={`px-3 py-2 ${actionFilter === "DELETE" ? "bg-red-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Eliminación
              </button>
            </div>
          </div>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-4 px-6">Fecha / Hora</th>
                  <th className="py-4 px-6">Responsable (RRHH)</th>
                  <th className="py-4 px-6">Acción</th>
                  <th className="py-4 px-6">Empleado Afectado</th>
                  <th className="py-4 px-6">ID Factura</th>
                  <th className="py-4 px-6 text-center">Detalle de Modificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-blue" />
                      Cargando registro de auditoría...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <AlertCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      No se encontraron registros de auditoría en los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                        {log.created_at ? new Date(log.created_at).toLocaleString("es-VE") : "N/A"}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900">{log.user_email}</span>
                      </td>
                      <td className="py-4 px-6">
                        {log.action === "EDIT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Edit3 className="w-3 h-3" /> MODIFICACIÓN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <Trash2 className="w-3 h-3" /> ELIMINACIÓN
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {log.target_user_email || log.details?.old?.user_email || "N/A"}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-500">
                        {log.target_invoice_id ? log.target_invoice_id.substring(0, 8) + "..." : "N/A"}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                        >
                          Ver Valores
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DETALLES DE AUDITORÍA */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-brand-blue" />
                  Detalle de Acción de Auditoría #{selectedLog.id}
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase">Ejecutado Por:</span>
                  <p className="font-semibold text-slate-800 text-sm">{selectedLog.user_email}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Fecha y Hora:</span>
                  <p className="font-semibold text-slate-800 text-sm">
                    {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString("es-VE") : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">Tipo de Acción:</span>
                  <p className="font-bold text-sm text-brand-blue">{selectedLog.action}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase">ID Factura:</span>
                  <p className="font-mono text-xs text-slate-600">{selectedLog.target_invoice_id}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Comparativa de Valores (Anterior vs Nuevo)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-600 block mb-2">Valores Anteriores:</span>
                    <pre className="overflow-x-auto text-[11px] text-slate-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.details?.old || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <span className="font-bold text-brand-blue block mb-2">Valores Nuevos:</span>
                    <pre className="overflow-x-auto text-[11px] text-slate-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.details?.new || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
