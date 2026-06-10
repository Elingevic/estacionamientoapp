"use client";

import { useState, useRef, useEffect } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import Tesseract from "tesseract.js";
import { Camera, FileText, Loader2, CheckCircle2, UploadCloud, LogOut, Calendar } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", nombres: "", cedula: "", cargo: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"capture" | "review" | "success">("capture");
  const [reportLoading, setReportLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("");
  const [rawOcrText, setRawOcrText] = useState<string>("");

  const [formData, setFormData] = useState({
    nro_factura: "",
    monto: "",
  });

  // Fechas del reporte (por defecto últimos 7 días)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
      });
      if (error) setAuthError(error.message);
      else {
        if (data.user) {
          // Crear perfil
          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            nombres: authForm.nombres,
            cedula: authForm.cedula,
            cargo: authForm.cargo,
          });
          if (profileError) setAuthError("Error creando perfil: " + profileError.message);
          else alert("Registro exitoso. ¡Ya puedes registrar facturas!");
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      });
      if (error) setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
    setOcrProgress("Preparando imagen...");
    try {
      const imgUrl = URL.createObjectURL(imageFile);
      const img = new Image();
      img.src = imgUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const MAX_SIZE = 1500;
      let width = img.width;
      let height = img.height;
      if (width > height && width > MAX_SIZE) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE; }
      else if (height > MAX_SIZE) { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE; }
      canvas.width = width; canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      const result = await Tesseract.recognize(canvas, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(`Analizando... ${Math.round(m.progress * 100)}%`);
          else setOcrProgress("Cargando IA...");
        }
      });
      
      const text = result.data.text;
      setRawOcrText(text);

      const textClean = text.replace(/O/g, "0");
      const nroFacturaMatch = textClean.match(/FACTURA[\s\S]{0,50}?(\d{5,10})/i);
      const fallbackFacturaMatch = textClean.match(/\b(000\d{4,7})\b/);
      let nro_factura = nroFacturaMatch ? nroFacturaMatch[1] : (fallbackFacturaMatch ? fallbackFacturaMatch[1] : "");

      const montosRegex = /\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b|\b\d+[.,]\d{2}\b/g;
      let matchMonto; let maxMonto = 0; let montoStr = "";

      while ((matchMonto = montosRegex.exec(textClean)) !== null) {
        let rawVal = matchMonto[0];
        let lastSepIndex = Math.max(rawVal.lastIndexOf("."), rawVal.lastIndexOf(","));
        let valStr = rawVal.substring(0, lastSepIndex).replace(/[.,]/g, "") + "." + rawVal.substring(lastSepIndex + 1);
        let val = parseFloat(valStr);
        if (!isNaN(val) && val > maxMonto) { maxMonto = val; montoStr = valStr; }
      }

      setFormData({ nro_factura, monto: montoStr });
      setStep("review");
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Error procesando la imagen con IA. Por favor, ingresa los datos manuales.");
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
      const { error } = await supabase.from("facturas").insert([
        {
          fecha: new Date().toISOString().split("T")[0],
          nro_factura: formData.nro_factura,
          monto: parseFloat(formData.monto) || 0,
          user_id: session.user.id
        },
      ]);
      if (error) throw error;
      setStep("success");
    } catch (error: any) {
      console.error(error);
      alert("Error guardando en la BD: " + (error?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!session?.access_token) return;
    setReportLoading(true);
    try {
      const response = await fetch(`/api/generar-reporte?start=${startDate}&end=${endDate}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error generando reporte");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_${startDate}_al_${endDate}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setReportLoading(false);
    }
  };

  const resetFlow = () => {
    setFile(null); setPreview(null); setFormData({ nro_factura: "", monto: "" }); setStep("capture");
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-700">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-blue-400">SmartParking</h1>
            <p className="text-slate-400 mt-2">{authMode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta de empleado"}</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === "register" && (
              <>
                <input type="text" placeholder="Nombres y Apellidos" required value={authForm.nombres} onChange={e => setAuthForm({...authForm, nombres: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500" />
                <input type="text" placeholder="Cédula de Identidad" required value={authForm.cedula} onChange={e => setAuthForm({...authForm, cedula: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500" />
                <input type="text" placeholder="Cargo (Ej. Analista)" required value={authForm.cargo} onChange={e => setAuthForm({...authForm, cargo: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500" />
              </>
            )}
            <input type="email" placeholder="Correo Electrónico" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500" />
            <input type="password" placeholder="Contraseña (mínimo 6 caracteres)" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500" />
            
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            
            <button type="submit" disabled={authLoading} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex justify-center items-center">
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === "login" ? "Entrar" : "Registrarse")}
            </button>
          </form>
          <p className="text-center text-sm text-slate-400">
            {authMode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} className="text-blue-400 hover:underline">
              {authMode === "login" ? "Regístrate aquí" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 font-sans selection:bg-blue-500/30">
      <div className="max-w-md mx-auto space-y-8 py-4">
        
        <header className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
          <div>
            <h1 className="text-xl font-bold text-blue-400">SmartParking</h1>
            <p className="text-xs text-slate-400 truncate w-40">{session.user.email}</p>
          </div>
          <button onClick={handleLogout} className="p-2 bg-slate-700 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl">
          {step === "capture" && (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-slate-800 border-2 border-dashed border-blue-500/50 rounded-full p-8 transition-transform group-hover:scale-105">
                  {loading ? <Loader2 className="w-12 h-12 text-blue-400 animate-spin" /> : <Camera className="w-12 h-12 text-blue-400" />}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">{loading ? "Analizando factura..." : "Capturar Factura"}</h3>
                <p className="text-sm text-slate-400 mt-1">{loading ? (ocrProgress || "Extrayendo datos con IA") : "Toma una foto de tu ticket"}</p>
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleCapture} disabled={loading} />
            </div>
          )}

          {step === "review" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><UploadCloud className="text-blue-400 w-5 h-5" /> Validar Datos</h3>
              {preview && (
                <div className="relative w-full h-40 rounded-xl overflow-hidden mb-4 border border-slate-700">
                  <img src={preview} alt="Factura" className="object-cover w-full h-full opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nro. de Factura</label>
                <input type="text" required value={formData.nro_factura} onChange={(e) => setFormData({ ...formData, nro_factura: e.target.value })} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Monto ($ o Bs)</label>
                <input type="number" step="0.01" required value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all text-white" />
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={resetFlow} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700" disabled={loading}>Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex justify-center items-center">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              <h3 className="text-xl font-semibold">¡Registro Exitoso!</h3>
              <p className="text-sm text-slate-400 text-center">La factura ha sido guardada en la base de datos.</p>
              <button onClick={resetFlow} className="mt-4 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition">Registrar Otra</button>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50 space-y-3">
            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4"/> Filtro Semanal</h4>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-slate-500">Desde</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 text-white [color-scheme:dark]" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-slate-500">Hasta</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 text-white [color-scheme:dark]" />
              </div>
            </div>
          </div>
          <button onClick={generateReport} disabled={reportLoading} className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
            {reportLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
            {reportLoading ? "Generando documento..." : "Descargar Mi Reporte"}
          </button>
        </div>

      </div>
    </main>
  );
}
