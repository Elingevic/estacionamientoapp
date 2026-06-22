"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2, ArrowLeft, BarChart3, TrendingUp, Car, Bike, DollarSign, PieChart as PieChartIcon, Users } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<any[]>([]);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [bcvRate, setBcvRate] = useState<number>(587.40);
  const [searchTerm, setSearchTerm] = useState("");

  const setQuickFilter = (type: 'semana' | 'mes' | 'todo') => {
    const d = new Date();
    if (type === 'semana') {
      const day = d.getDay() || 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(sunday.toISOString().split("T")[0]);
    } else if (type === 'mes') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(end.toISOString().split("T")[0]);
    } else if (type === 'todo') {
      setStartDate("2020-01-01");
      setEndDate(d.toISOString().split("T")[0]);
    }
  };

  useEffect(() => {
    fetch("http://172.16.202.58:8000/api/rates/")
      .then(res => res.json())
      .then(data => {
        const usd = Array.isArray(data)
          ? data.find((item: any) => item.currency === "USD")
          : data.value?.find((item: any) => item.currency === "USD");
        if (usd && usd.bd_venta_ask) {
          setBcvRate(parseFloat(usd.bd_venta_ask));
        }
      })
      .catch(() => {
        fetch("/api/bcv")
          .then(res => res.json())
          .then(data => { if (data.tasa) setBcvRate(data.tasa); })
          .catch(e => console.error(e));
      });
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, startDate, endDate]);

  const fetchData = async (silent = false) => {
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
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    if (typeof window !== "undefined") window.location.href = "/";
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="font-bold text-slate-500">No autorizado.</p>
      </div>
    );
  }

  const isRrhh = session?.user?.email?.toLowerCase().includes("rrhh") || (session?.user as any)?.role === "rrhh";

  const filteredFacturas = facturas.filter(f => 
    f.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.nro_factura?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Estadísticas
  const totalFacturas = filteredFacturas.length;
  const totalMonto = filteredFacturas.reduce((sum, f) => sum + Number(f.monto), 0);
  const totalMontoUsd = filteredFacturas.reduce((sum, f) => sum + (f.monto_usd ? Number(f.monto_usd) : Number(f.monto) / bcvRate), 0);
  
  const totalCarros = filteredFacturas.filter(f => f.tipo_vehiculo === "carro" || !f.tipo_vehiculo).length;
  const totalMotos = filteredFacturas.filter(f => f.tipo_vehiculo === "moto").length;

  const montoCarros = filteredFacturas.filter(f => f.tipo_vehiculo === "carro" || !f.tipo_vehiculo).reduce((sum, f) => sum + Number(f.monto), 0);
  const montoMotos = filteredFacturas.filter(f => f.tipo_vehiculo === "moto").reduce((sum, f) => sum + Number(f.monto), 0);
  
  const montoCarrosUsd = filteredFacturas.filter(f => f.tipo_vehiculo === "carro" || !f.tipo_vehiculo).reduce((sum, f) => sum + (f.monto_usd ? Number(f.monto_usd) : Number(f.monto) / bcvRate), 0);
  const montoMotosUsd = filteredFacturas.filter(f => f.tipo_vehiculo === "moto").reduce((sum, f) => sum + (f.monto_usd ? Number(f.monto_usd) : Number(f.monto) / bcvRate), 0);

  const totalPersonas = new Set(filteredFacturas.map(f => f.user_id)).size;

  // Gastos mensuales para gráfica
  const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const facturasPorMes = filteredFacturas.reduce((acc, f) => {
    const [y, m, d] = f.fecha.split("-");
    const mesIdx = Number(m) - 1;
    if (!acc[mesIdx]) acc[mesIdx] = { montoBs: 0, montoUsd: 0 };
    acc[mesIdx].montoBs += Number(f.monto);
    acc[mesIdx].montoUsd += (f.monto_usd ? Number(f.monto_usd) : Number(f.monto) / bcvRate);
    return acc;
  }, {} as Record<number, {montoBs: number, montoUsd: number}>);

  const dataMensual = Object.keys(facturasPorMes).sort((a,b)=>Number(a)-Number(b)).map(m => ({
    name: mesesNombres[Number(m)],
    "Monto Bs": Number(facturasPorMes[Number(m)].montoBs.toFixed(2)),
    "Monto USD": Number(facturasPorMes[Number(m)].montoUsd.toFixed(2))
  }));

  const dataPie = [
    { name: "Carros", value: totalCarros, color: "#1f2a54" },
    { name: "Motos", value: totalMotos, color: "#e11d48" }
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <Link href={isRrhh ? "/rrhh" : "/"} className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-brand-blue flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-brand-red" />
                Dashboard {isRrhh ? "Global RRHH" : "Personal"}
              </h1>
              <p className="text-slate-500 font-medium">Estadísticas de gastos de estacionamiento</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className="flex gap-2 self-end">
              <button onClick={() => setQuickFilter('semana')} className="text-xs px-3 py-1 bg-slate-100 hover:bg-brand-blue hover:text-white rounded-lg font-bold text-slate-600 transition-colors">Semana</button>
              <button onClick={() => setQuickFilter('mes')} className="text-xs px-3 py-1 bg-slate-100 hover:bg-brand-blue hover:text-white rounded-lg font-bold text-slate-600 transition-colors">Mes</button>
              <button onClick={() => setQuickFilter('todo')} className="text-xs px-3 py-1 bg-slate-100 hover:bg-brand-blue hover:text-white rounded-lg font-bold text-slate-600 transition-colors">Todo</button>
            </div>
            <div className="flex flex-wrap gap-4 items-center justify-end">
              {isRrhh && (
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar</label>
                  <input type="text" placeholder="Correo o Factura" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:border-brand-blue w-full sm:w-48" />
                </div>
              )}
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Desde</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:border-brand-blue" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hasta</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:border-brand-blue" />
              </div>
            </div>
          </div>
        </header>

        {/* Tarjetas Superiores */}
        <div className={`grid grid-cols-1 ${isRrhh ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6" />
            </div>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-wider">Gasto Total</p>
            <h2 className="text-3xl font-extrabold text-slate-800 mt-1">Bs. {totalMonto.toFixed(2)}</h2>
            <p className="text-emerald-600 font-bold text-sm mt-1">≈ ${totalMontoUsd.toFixed(2)} USD</p>
          </div>
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-wider">Total Tickets</p>
            <h2 className="text-3xl font-extrabold text-slate-800 mt-1">{totalFacturas}</h2>
          </div>

          {isRrhh && (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-slate-500 font-bold uppercase text-xs tracking-wider">Personas</p>
              <h2 className="text-3xl font-extrabold text-slate-800 mt-1">{totalPersonas}</h2>
            </div>
          )}

          <div className="bg-brand-blue p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Car className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-4">
                <Car className="w-6 h-6" />
              </div>
              <p className="text-blue-200 font-bold uppercase text-xs tracking-wider">Carros</p>
              <h2 className="text-3xl font-extrabold text-white mt-1">{totalCarros} <span className="text-sm font-medium text-blue-200">tickets</span></h2>
              <p className="text-sm font-medium text-emerald-300 mt-2">${montoCarrosUsd.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-brand-red p-6 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Bike className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 text-white rounded-2xl flex items-center justify-center mb-4">
                <Bike className="w-6 h-6" />
              </div>
              <p className="text-red-200 font-bold uppercase text-xs tracking-wider">Motos</p>
              <h2 className="text-3xl font-extrabold text-white mt-1">{totalMotos} <span className="text-sm font-medium text-red-200">tickets</span></h2>
              <p className="text-sm font-medium text-emerald-300 mt-2">${montoMotosUsd.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Gráficas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-brand-blue"/> Gastos Mensuales (Bs.)</h3>
            <div className="h-[300px] w-full">
              {dataMensual.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataMensual}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} width={80} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={10} width={60} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}} 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                      formatter={(value: any, name: any) => [typeof value === 'number' ? value.toFixed(2) : value, name]}
                    />
                    <Bar yAxisId="left" dataKey="Monto Bs" fill="#1f2a54" radius={[6, 6, 0, 0]} barSize={20} />
                    <Bar yAxisId="right" dataKey="Monto USD" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium border-2 border-dashed border-slate-100 rounded-2xl">No hay datos para mostrar</div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-brand-blue"/> Proporción Vehicular</h3>
            <div className="flex-1 w-full flex items-center justify-center">
              {totalCarros > 0 || totalMotos > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={dataPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {dataPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] w-full flex items-center justify-center text-slate-400 font-medium border-2 border-dashed border-slate-100 rounded-2xl">Sin registros</div>
              )}
            </div>
            <div className="mt-4 flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#1f2a54] shadow-md shadow-[#1f2a54]/30"></div>
                <span className="text-sm font-bold text-slate-600">Carros</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#e11d48] shadow-md shadow-[#e11d48]/30"></div>
                <span className="text-sm font-bold text-slate-600">Motos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desglose por Persona */}
        {isRrhh && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2"><Users className="w-5 h-5 text-brand-blue"/> Desglose por Persona</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase">Persona</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-center">Tickets</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-center">Carros / Motos</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-right">Promedio Bs.</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-right">Promedio USD</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-right">Total Bs.</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase text-right">Total USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(filteredFacturas.reduce((acc, f) => {
                    const isMoto = f.tipo_vehiculo === "moto";
                    if (!acc[f.user_id]) acc[f.user_id] = { tickets: 0, bs: 0, usd: 0, carros: 0, motos: 0 };
                    acc[f.user_id].tickets += 1;
                    acc[f.user_id].bs += Number(f.monto);
                    acc[f.user_id].usd += (f.monto_usd ? Number(f.monto_usd) : Number(f.monto) / bcvRate);
                    if (isMoto) acc[f.user_id].motos += 1;
                    else acc[f.user_id].carros += 1;
                    return acc;
                  }, {} as Record<string, {tickets: number, bs: number, usd: number, carros: number, motos: number}>))
                  .sort((a: any, b: any) => b[1].bs - a[1].bs)
                  .map(([user, data]: [string, any], idx) => {
                    const avgBs = data.bs / data.tickets;
                    const avgUsd = data.usd / data.tickets;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-700">{user}</td>
                        <td className="px-4 py-3 text-center text-slate-600 font-medium">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-full text-xs font-bold">{data.tickets}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">
                          <span className="text-brand-blue">{data.carros}</span>
                          <span className="mx-1.5">/</span>
                          <span className="text-brand-red">{data.motos}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <p className="font-bold text-slate-700">Bs. {avgBs.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <p className="font-bold text-emerald-600">${avgUsd.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-brand-blue">Bs. {data.bs.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">${data.usd.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
