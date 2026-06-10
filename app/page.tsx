"use client";

import { useState, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { createClient } from "@supabase/supabase-js";
import Tesseract from "tesseract.js";
import { Camera, FileText, Loader2, CheckCircle2, UploadCloud, LogOut, Calendar, Users } from "lucide-react";
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const { data: session, status } = useSession();
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"capture" | "review" | "success">("capture");
  const [reportLoading, setReportLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("");

  const [formData, setFormData] = useState({
    nro_factura: "",
    monto: "",
  });

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const { error } = await supabase.from("facturas").insert([
        {
          fecha: new Date().toISOString().split("T")[0],
          nro_factura: formData.nro_factura,
          monto: parseFloat(formData.monto) || 0,
          user_id: session.user.email, // Usamos el correo corporativo como ID único
          image_url: imageUrl
        },
      ]);
      if (error) throw error;
      setStep("success");
    } catch (error: any) {
      alert("Error: " + (error?.message || "Desconocido"));
    } finally {
      setLoading(false);
    }
  };

  // ... rest of generateReport and UI components
  // Re-add them appropriately
  const generateReport = async () => {
    // Note: since we moved to NextAuth, getting a raw token to send to our API might need custom logic
    // But since NextAuth handles cookies, our API route can just read the NextAuth session!
    alert("La generación de reportes ha sido movida al panel de RRHH. Solo RRHH genera los consolidados ahora.");
  };

  const resetFlow = () => {
    setFile(null); setPreview(null); setCompressedBlob(null); setFormData({ nro_factura: "", monto: "" }); setStep("capture");
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-700 text-center">
          <h1 className="text-3xl font-extrabold text-blue-400">SmartParking</h1>
          <p className="text-slate-400 mt-2">Plataforma Corporativa</p>
          <button onClick={() => signIn()} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium">
            Iniciar Sesión con SSO
          </button>
        </div>
      </main>
    );
  }

  const isRrhh = (session.user as any).role === "rrhh";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 font-sans">
      <div className="max-w-md mx-auto space-y-8 py-4">
        
        <header className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
          <div>
            <h1 className="text-xl font-bold text-blue-400">SmartParking</h1>
            <p className="text-xs text-slate-400 truncate w-40">{session.user.name}</p>
          </div>
          <div className="flex gap-2">
            {isRrhh && (
              <Link href="/rrhh" className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/40 transition">
                <Users className="w-5 h-5" />
              </Link>
            )}
            <button onClick={() => signOut()} className="p-2 bg-slate-700 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
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
                <h3 className="text-lg font-semibold">{loading ? "Procesando..." : "Escanear Factura"}</h3>
                <p className="text-sm text-slate-400 mt-1">{loading ? ocrProgress : "Toma una foto de tu ticket"}</p>
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
                  <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">A ser guardada para RRHH</div>
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
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Registro"}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              <h3 className="text-xl font-semibold">¡Registro Exitoso!</h3>
              <p className="text-sm text-slate-400 text-center">Ticket enviado al departamento de Recursos Humanos.</p>
              <button onClick={resetFlow} className="mt-4 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition">Registrar Otra</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
