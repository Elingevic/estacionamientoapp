"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { createClient } from "@supabase/supabase-js";
import Tesseract from "tesseract.js";
import { Camera, FileText, Loader2, CheckCircle2, UploadCloud, LogOut, Calendar, Users, Building2, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"capture" | "review" | "success">("capture");
  const [ocrProgress, setOcrProgress] = useState<string>("");

  const [formData, setFormData] = useState({
    fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }),
    nro_factura: "",
    monto: "",
    estacionamiento: "",
    lugar: ""
  });

  const [myFacturas, setMyFacturas] = useState<any[]>([]);
  const [fetchingFacturas, setFetchingFacturas] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "rrhh") {
      router.push("/rrhh");
    } else if (session?.user?.email) {
      fetchMyFacturas();
    }
  }, [session, status, router, startDate, endDate, step]); // Se recarga al cambiar de paso (por ej. al subir una nueva)

  const fetchMyFacturas = async () => {
    setFetchingFacturas(true);
    try {
      const { data, error } = await supabase
        .from("facturas")
        .select("*")
        .eq("user_id", session!.user!.email)
        .gte("fecha", startDate)
        .lte("fecha", endDate)
        .order("fecha", { ascending: false });
      if (data) setMyFacturas(data);
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingFacturas(false);
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

      // Extraer Estacionamiento y Lugar (usualmente después del RIF)
      let estacionamiento = "";
      let lugar = "";
      const rifIndex = lines.findIndex(l => l.toUpperCase().includes("RIF"));
      if (rifIndex !== -1 && lines.length > rifIndex + 2) {
         estacionamiento = lines[rifIndex + 1];
         lugar = lines[rifIndex + 2];
      } else {
         const skipSeniat = lines.filter(l => !l.toUpperCase().includes("SENIAT") && !l.toUpperCase().includes("RIF"));
         estacionamiento = skipSeniat[0] || "";
         lugar = skipSeniat[1] || "";
      }

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

      setFormData(prev => ({ 
        ...prev, 
        fecha,
        nro_factura, 
        monto: montoStr,
        estacionamiento: estacionamiento,
        lugar: lugar
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
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { data, error: uploadError } = await supabase.storage
          .from("tickets")
          .upload(fileName, compressedBlob, { contentType: "image/jpeg" });
          
        if (uploadError) throw new Error("Error subiendo foto: " + uploadError.message);
        
        const { data: { publicUrl } } = supabase.storage.from("tickets").getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      let insertData: any = {
        fecha: formData.fecha,
        nro_factura: formData.nro_factura,
        monto: parseFloat(formData.monto) || 0,
        user_id: session.user.email,
        image_url: imageUrl,
        estacionamiento: formData.estacionamiento,
        lugar: formData.lugar
      };

      const { error } = await supabase.from("facturas").insert([insertData]);
      
      if (error && error.message.includes("estacionamiento")) {
        // Podría ser que la columna se llame 'nombre_estacionamiento'
        const altData = { ...insertData };
        delete altData.estacionamiento;
        altData.nombre_estacionamiento = formData.estacionamiento;
        
        const { error: altError } = await supabase.from("facturas").insert([altData]);
        if (altError) {
          // Fallback final si no existen las columnas en lo absoluto
          delete altData.nombre_estacionamiento;
          delete altData.lugar;
          const { error: fallbackError } = await supabase.from("facturas").insert([altData]);
          if (fallbackError) throw fallbackError;
        }
      } else if (error) {
        throw error;
      }
      setStep("success");
    } catch (error: any) {
      alert("Error: " + (error?.message || "Desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setFile(null); setPreview(null); setCompressedBlob(null); setFormData({ fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }), nro_factura: "", monto: "", estacionamiento: "", lugar: "" }); setStep("capture");
  };

  const isRrhh = session?.user?.email?.toLowerCase().includes("rrhh") || (session?.user as any)?.role === "rrhh";

  if (status === "loading" || (status === "authenticated" && isRrhh)) {
    return (
      <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        {isRrhh && <p className="font-medium animate-pulse text-blue-200">Ingresando a Panel de Recursos Humanos...</p>}
      </div>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-brand-blue p-4 rounded-2xl shadow-lg">
              <Building2 className="w-12 h-12 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-brand-blue">SudeParking</h1>
            <p className="text-slate-500 mt-2 font-medium">Plataforma Corporativa</p>
          </div>
          <button onClick={() => signIn()} className="w-full py-3.5 rounded-xl bg-brand-red hover:bg-brand-darkred text-white font-semibold text-lg shadow-lg shadow-brand-red/30 transition-all active:scale-95">
            Iniciar Sesión
          </button>
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-4 font-sans">
      <div className="max-w-md mx-auto space-y-6 py-4">
        
        <header className="flex justify-between items-center bg-brand-blue p-5 rounded-2xl shadow-xl shadow-brand-blue/20">
          <div className="text-white">
            <h1 className="text-xl font-bold flex items-center gap-2"><Building2 className="w-5 h-5"/> SudeParking</h1>
            <p className="text-xs text-blue-200 mt-1 truncate w-48 opacity-90">{session?.user?.name || session?.user?.email}</p>
          </div>
          <div className="flex gap-2">
            {isRrhh && (
              <Link href="/rrhh" className="p-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition">
                <Users className="w-5 h-5" />
              </Link>
            )}
            <button onClick={() => signOut()} className="p-2.5 bg-black/20 text-white rounded-xl hover:bg-black/30 transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl">
          {step === "capture" && (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="absolute inset-0 bg-brand-red rounded-full blur-xl opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative bg-white border-2 border-dashed border-brand-red/40 rounded-full p-10 transition-transform group-hover:scale-105 shadow-sm">
                  {loading ? <Loader2 className="w-14 h-14 text-brand-red animate-spin" /> : <Camera className="w-14 h-14 text-brand-red" />}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-800">{loading ? "Procesando..." : "Escanear Factura"}</h3>
                <p className="text-sm font-medium text-slate-500 mt-2">{loading ? ocrProgress : "Toma una foto de tu ticket de estacionamiento"}</p>
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
                <input type="text" required value={formData.nro_factura} onChange={(e) => setFormData({ ...formData, nro_factura: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-mono text-lg text-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monto</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 font-bold text-slate-400">Bs.</span>
                  <input type="number" step="0.01" required value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-semibold text-lg text-slate-800" />
                </div>
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
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-brand-blue flex items-center gap-2">
                <Receipt className="w-5 h-5"/> Mis Cargas ({myFacturas.length})
              </h3>
            </div>
            
            <div className="flex gap-3 mb-5">
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Desde</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue font-medium text-slate-700 transition-all" />
              </div>
              <div className="w-1/2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Hasta</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue font-medium text-slate-700 transition-all" />
              </div>
            </div>
            
            {fetchingFacturas ? (
              <div className="text-center py-6"><Loader2 className="w-8 h-8 animate-spin text-brand-blue mx-auto"/></div>
            ) : myFacturas.length === 0 ? (
              <div className="text-center py-6 px-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <p className="text-sm font-medium text-slate-500">No tienes facturas en estas fechas.</p>
                <p className="text-xs text-slate-400 mt-1">Sube tu primer ticket para verlo aquí.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {myFacturas.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors group">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{new Date(f.fecha).toLocaleDateString("es-ES")}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">#{f.nro_factura}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">Bs. {Number(f.monto).toFixed(2)}</p>
                      <span className="text-[10px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-full mt-1 inline-block">Procesado</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}
