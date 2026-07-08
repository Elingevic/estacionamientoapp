"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Tesseract from "tesseract.js";
import { Camera, FileText, Loader2, CheckCircle2, UploadCloud, LogOut, Calendar, Users, Building2, Receipt, Car, Bike, BarChart3, Printer, ShieldAlert, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"capture" | "review" | "success">("capture");
  const [ocrProgress, setOcrProgress] = useState<string>("");
  const [bcvRate, setBcvRate] = useState<number>(587.40);

  const [formData, setFormData] = useState({
    fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }),
    nro_factura: "",
    monto: "",
    estacionamiento: "Inversiones Parking 2043, CA",
    lugar: "Av. Lazo Martin",
    tipo_vehiculo: "carro"
  });

  const [myFacturas, setMyFacturas] = useState<any[]>([]);
  const [fetchingFacturas, setFetchingFacturas] = useState(false);
  const [editingFactura, setEditingFactura] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/bcv")
      .then(res => res.json())
      .then(data => { if (data.tasa) setBcvRate(data.tasa); })
      .catch(e => console.error(e));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      signIn("keycloak");
    } else if (session?.user?.email) {
      fetchMyFacturas();
    }
  }, [session, status, router, startDate, endDate, step]); // Se recarga al cambiar de paso (por ej. al subir una nueva)

  const fetchMyFacturas = async (silent = false) => {
    if (!silent) setFetchingFacturas(true);
    try {
      const res = await fetch(`/api/facturas?start=${startDate}&end=${endDate}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      if (data) {
        setMyFacturas(data);
      }
    } catch (e) {
      console.error("Error fetching facturas:", e);
    } finally {
      if (!silent) setFetchingFacturas(false);
    }
  };

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
      fetchMyFacturas(true);
    } catch (err: any) {
      alert("Error actualizando: " + (err?.message || "Desconocido"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      await processImage(selectedFile);
    }
  };

  const processImage = async (imageFile: File) => {
    setLoading(true);
    setOcrProgress("Optimizando foto...");
    try {
      const imgUrl = URL.createObjectURL(imageFile);
      const img = new Image();
      img.src = imgUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const MAX_SIZE = 1200; // Comprimir para que no pese casi nada
      let width = img.width;
      let height = img.height;
      if (width > height && width > MAX_SIZE) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE; }
      else if (height > MAX_SIZE) { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE; }
      canvas.width = width; canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Guardar versión comprimida para subir luego
      canvas.toBlob((blob) => { if (blob) setCompressedBlob(blob); }, "image/jpeg", 0.7);

      const result = await Tesseract.recognize(canvas, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(`Analizando IA... ${Math.round(m.progress * 100)}%`);
          else setOcrProgress("Preparando motor...");
        }
      });
      
      const textClean = result.data.text.replace(/O/g, "0");
      const lines = textClean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const nroFacturaMatch = textClean.match(/FACTURA[\s\S]{0,50}?(\d{5,10})/i);
      const fallbackFacturaMatch = textClean.match(/\b(000\d{4,7})\b/);
      let nro_factura = nroFacturaMatch ? nroFacturaMatch[1] : (fallbackFacturaMatch ? fallbackFacturaMatch[1] : "");

      // Asignar Estacionamiento y Lugar siempre a los valores predeterminados requeridos
      let estacionamiento = "Inversiones Parking 2043, CA";
      let lugar = "Av. Lazo Martin";

      // Buscar Total (la palabra TOTAL o usar el monto más alto como fallback)
      let montoStr = "";
      const totalMatch = textClean.match(/TOTAL[^\d]{0,20}?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i);
      if (totalMatch) {
         montoStr = totalMatch[1].replace(/[.,](?=\d{2}$)/, '.').replace(/[.,](?=\d{3})/g, '');
      } else {
         const montosRegex = /\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b|\b\d+[.,]\d{2}\b/g;
         let matchMonto; let maxMonto = 0;
         while ((matchMonto = montosRegex.exec(textClean)) !== null) {
            let rawVal = matchMonto[0];
            let lastSepIndex = Math.max(rawVal.lastIndexOf("."), rawVal.lastIndexOf(","));
            let valStr = rawVal.substring(0, lastSepIndex).replace(/[.,]/g, "") + "." + rawVal.substring(lastSepIndex + 1);
            let val = parseFloat(valStr);
            if (!isNaN(val) && val > maxMonto) { maxMonto = val; montoStr = valStr; }
         }
      }

      // Buscar Fecha
      let fecha = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
      const dateMatch = textClean.match(/FECHA[:\s]*(\d{2}[-/]\d{2}[-/]\d{4})/i) || textClean.match(/(\d{2}[-/]\d{2}[-/]\d{4})/);
      if (dateMatch) {
         const dStr = dateMatch[1].replace(/\//g, '-');
         const parts = dStr.split('-');
         if (parts.length === 3) {
            // Asumimos formato DD-MM-YYYY
            fecha = `${parts[2]}-${parts[1]}-${parts[0]}`;
         }
      }

      let tipo_vehiculo = "carro";
      const rawText = (result.data.text || "").toUpperCase();
      if (rawText.includes("MOTO") || rawText.includes("M0T0") || textClean.toUpperCase().includes("M0T0")) {
        tipo_vehiculo = "moto";
      }

      setFormData(prev => ({ 
        ...prev, 
        fecha,
        nro_factura, 
        monto: montoStr,
        estacionamiento: estacionamiento,
        lugar: lugar,
        tipo_vehiculo
      }));
      setStep("review");
    } catch (error) {
      alert("Error procesando imagen. Ingresa los datos manualmente.");
      setStep("review");
    } finally {
      setLoading(false); setOcrProgress("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return alert("Debes iniciar sesión");
    
    setLoading(true);
    try {
      let imageUrl = null;
      if (compressedBlob) {
        const fd = new FormData();
        fd.append("file", compressedBlob, "ticket.jpg");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd
        });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error("Error subiendo foto: " + (errData.error || "Error desconocido"));
        }
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
      }

      let dataToInsert: any = {
        date: formData.fecha,
        invoice_number: formData.nro_factura,
        amount: parseFloat(formData.monto) || 0,
        user_id: session.user.email,
        image_url: imageUrl,
        parking_name: formData.estacionamiento,
        location: formData.lugar,
        vehicle_type: formData.tipo_vehiculo
      };

      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToInsert)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al guardar factura");
      }

      setStep("success");
    } catch (error: any) {
      alert("Error: " + (error?.message || "Desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setFile(null); setPreview(null); setCompressedBlob(null); setFormData({ fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }), nro_factura: "", monto: "", estacionamiento: "Inversiones Parking 2043, CA", lugar: "Av. Lazo Martin", tipo_vehiculo: "carro" }); setStep("capture");
  };

  const isRrhh = session?.user?.email?.toLowerCase().includes("rrhh") || (session?.user as any)?.role === "rrhh";

  const myTotalMonto = myFacturas.reduce((sum, f) => sum + Number(f.amount), 0);
  const myTotalMontoUsd = myFacturas.reduce((sum, f) => sum + Number(f.amount) / (bcvRate || 587.40), 0);
  const myTotalCarros = myFacturas.filter(f => f.vehicle_type === "carro" || !f.vehicle_type).length;
  const myTotalMotos = myFacturas.filter(f => f.vehicle_type === "moto").length;

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-medium animate-pulse text-blue-200">Conectando con SUDEASEG SSO...</p>
      </div>
    );
  }


  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6 py-4">
        
        {isRrhh && (
          <div className="bg-emerald-600 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white shadow-lg shadow-emerald-600/20">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Modo Administrador</p>
                <p className="text-xs text-emerald-100 font-medium">Auditoría y Gestión de Reembolsos</p>
              </div>
            </div>
            <Link href="/rrhh" className="bg-white text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-emerald-50 transition-colors">
              Abrir Panel
            </Link>
          </div>
        )}

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-blue p-5 rounded-2xl shadow-xl shadow-brand-blue/20">
          <div className="text-white">
            <h1 className="text-xl font-bold flex items-center gap-2"><Building2 className="w-5 h-5"/> SudeParking</h1>
            <p className="text-xs text-blue-200 mt-1 truncate w-48 opacity-90">{session?.user?.name || session?.user?.email}</p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto justify-end">
            <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition font-bold text-sm">
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
            }} className="p-2.5 bg-black/20 text-white rounded-xl hover:bg-black/30 transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl">
          {step === "capture" && (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="flex w-full gap-4 px-2">
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-brand-red/40 rounded-3xl hover:bg-brand-red/5 cursor-pointer transition-all group" onClick={() => fileInputRef.current?.click()}>
                  <Camera className="w-10 h-10 text-brand-red group-hover:scale-110 transition-transform mb-3" />
                  <h3 className="font-bold text-slate-800 text-center text-sm">Escanear Foto</h3>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-brand-blue/40 rounded-3xl hover:bg-brand-blue/5 cursor-pointer transition-all group" onClick={() => { setFile(null); setPreview(null); setStep("review"); }}>
                  <FileText className="w-10 h-10 text-brand-blue group-hover:scale-110 transition-transform mb-3" />
                  <h3 className="font-bold text-slate-800 text-center text-sm">Carga Manual</h3>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm font-medium text-slate-500">{loading ? ocrProgress || "Procesando..." : "Selecciona una opción para registrar tu factura"}</p>
                {bcvRate && <p className="text-xs font-bold text-brand-blue mt-2">Tasa BCV del día: Bs. {bcvRate.toFixed(2)}</p>}
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleCapture} disabled={loading} />
            </div>
          )}

          {step === "review" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <h3 className="text-xl font-bold text-brand-blue flex items-center gap-2 mb-2"><UploadCloud className="w-6 h-6" /> Validar Datos</h3>
              {preview && (
                <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-2 border border-slate-200 shadow-inner">
                  <img src={preview} alt="Factura" className="object-cover w-full h-full" />
                  <div className="absolute top-3 right-3 bg-brand-blue/90 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm shadow-md">Auditoría RRHH</div>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de la Factura</label>
                <input type="date" required value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all text-lg text-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Estacionamiento</label>
                <input type="text" value={formData.estacionamiento} onChange={(e) => setFormData({ ...formData, estacionamiento: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-brand-blue transition-all font-medium text-lg text-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lugar</label>
                <input type="text" value={formData.lugar} onChange={(e) => setFormData({ ...formData, lugar: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-brand-blue transition-all font-medium text-lg text-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nro. de Factura</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={20} required value={formData.nro_factura} onChange={(e) => setFormData({ ...formData, nro_factura: e.target.value.replace(/\D/g, "") })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-mono text-lg text-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Vehículo</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setFormData({...formData, tipo_vehiculo: "carro"})} className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-bold ${formData.tipo_vehiculo === "carro" ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    <Car className="w-5 h-5" /> Carro
                  </button>
                  <button type="button" onClick={() => setFormData({...formData, tipo_vehiculo: "moto"})} className={`flex-1 py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-bold ${formData.tipo_vehiculo === "moto" ? "border-brand-blue bg-brand-blue/5 text-brand-blue" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    <Bike className="w-5 h-5" /> Moto
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monto</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 font-bold text-slate-400">Bs.</span>
                  <input type="number" step="0.01" min="0.01" max={bcvRate ? bcvRate * 20 : 15000} required value={formData.monto} onChange={(e) => { const val = e.target.value; const maxMonto = bcvRate ? bcvRate * 20 : 15000; if (val.length <= 10 && (val === "" || parseFloat(val) <= maxMonto)) setFormData({ ...formData, monto: val }) }} onInvalid={(e) => { const maxMonto = bcvRate ? bcvRate * 20 : 15000; (e.target as HTMLInputElement).setCustomValidity(`El monto no puede superar los $20 USD (Bs. ${maxMonto.toFixed(2)})`); }} onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-semibold text-lg text-slate-800" />
                </div>
                {bcvRate && formData.monto && (
                  <p className="text-xs text-emerald-600 font-bold mt-1 text-right">≈ ${(parseFloat(formData.monto) / bcvRate).toFixed(2)} USD</p>
                )}
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={resetFlow} className="flex-1 py-3.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition" disabled={loading}>Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3.5 rounded-xl bg-brand-red hover:bg-brand-darkred text-white font-bold flex justify-center items-center shadow-lg shadow-brand-red/30 transition-all">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Registro"}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center space-y-5 py-10">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">¡Registro Exitoso!</h3>
              <p className="text-slate-500 text-center font-medium px-4">Ticket enviado y procesado para su reintegro.</p>
              <button onClick={resetFlow} className="mt-6 w-full py-4 rounded-xl bg-brand-blue hover:bg-[#1f2a54] text-white font-bold shadow-lg shadow-brand-blue/20 transition-all">Registrar Otra Factura</button>
            </div>
          )}
        </div>

        {/* HISTORIAL Y REPORTES DEL EMPLEADO */}
        {step !== "review" && (
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-blue flex items-center gap-2">
                <Receipt className="w-5 h-5"/> Mis Cargas ({myFacturas.length})
              </h3>
              <button 
                onClick={() => window.open(`/api/generar-reporte?start=${startDate}&end=${endDate}&email=${encodeURIComponent(session?.user?.email || "")}`, "_blank")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-red text-white hover:bg-brand-darkred shadow-md transition-colors font-bold text-xs"
              >
                <FileText className="w-4 h-4" /> Exportar Word
              </button>
            </div>
            
            <div className="flex gap-3">
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Desde</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue font-medium text-slate-700 transition-all" />
              </div>
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Hasta</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue font-medium text-slate-700 transition-all" />
              </div>
            </div>

            {/* MINI DASHBOARD PERSONAL */}
            {myFacturas.length > 0 && (
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1 border-r border-slate-200 pr-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Consumido</p>
                  <p className="text-base font-extrabold text-brand-blue">Bs. {myTotalMonto.toFixed(2)}</p>
                  <p className="text-xs font-bold text-emerald-600">≈ ${myTotalMontoUsd.toFixed(2)} USD</p>
                </div>
                <div className="space-y-1 pl-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehículos</p>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-brand-blue" /> {myTotalCarros} Carros
                    </span>
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-brand-red" /> {myTotalMotos} Motos
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {fetchingFacturas ? (
              <div className="text-center py-6"><Loader2 className="w-8 h-8 animate-spin text-brand-blue mx-auto"/></div>
            ) : myFacturas.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <p className="text-sm font-medium text-slate-500">No tienes facturas en estas fechas.</p>
                <p className="text-xs text-slate-400 mt-1">Sube tu primer ticket para verlo aquí.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {myFacturas.map((f, i) => {
                  const isMoto = f.vehicle_type === "moto";
                  const itemUsd = Number(f.amount) / (bcvRate || 587.40);
                  return (
                    <div key={i} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isMoto ? 'bg-red-100 text-brand-red' : 'bg-blue-100 text-brand-blue'}`}>
                          {isMoto ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{new Date(f.date + "T12:00:00").toLocaleDateString("es-ES")}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-slate-500 font-mono">#{f.invoice_number}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${isMoto ? 'bg-red-50 text-brand-red border border-red-200' : 'bg-blue-50 text-brand-blue border border-blue-200'}`}>
                              {isMoto ? "Moto" : "Carro"}
                            </span>
                          </div>
                          <div className="mt-1 space-y-0.5">
                            <p className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                              {f.parking_name || "Sin nombre"}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              {f.location || "Sin lugar"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col justify-between items-end self-stretch">
                        <div className="flex flex-col items-end">
                          <p className="text-sm font-bold text-slate-800">Bs. {Number(f.amount).toFixed(2)}</p>
                          <p className="text-xs font-bold text-emerald-600">≈ ${itemUsd.toFixed(2)}</p>
                        </div>
                        {!f.report_sequence && (
                          <button
                            onClick={() => setEditingFactura(f)}
                            className="mt-2 text-xs font-bold text-slate-400 hover:text-brand-blue flex items-center gap-1 transition-colors bg-white hover:bg-blue-50 px-2 py-1 rounded-md border border-slate-200"
                          >
                            <Pencil className="w-3 h-3" /> Editar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL PARA EDITAR FACTURA */}
      {editingFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="relative max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-100" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-brand-blue flex items-center gap-2">
                Editar Registro
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
                <input type="number" step="0.01" min="0.01" max={bcvRate ? bcvRate * 20 : 15000} required value={editingFactura.amount || ""} onChange={(e) => { const val = e.target.value; const maxMonto = bcvRate ? bcvRate * 20 : 15000; if (val.length <= 10 && (val === "" || parseFloat(val) <= maxMonto)) setEditingFactura({ ...editingFactura, amount: val }) }} onInvalid={(e) => { const maxMonto = bcvRate ? bcvRate * 20 : 15000; (e.target as HTMLInputElement).setCustomValidity(`El monto no puede superar los $20 USD (Bs. ${maxMonto.toFixed(2)})`); }} onInput={(e) => (e.target as HTMLInputElement).setCustomValidity("")} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-blue text-sm font-semibold" />
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
    </main>
  );
}
