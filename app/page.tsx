"use client";

import { useState, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { createClient } from "@supabase/supabase-js";
import Tesseract from "tesseract.js";
import { Camera, FileText, Loader2, CheckCircle2, UploadCloud, LogOut, Calendar, Users, Building2 } from "lucide-react";
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
  const [ocrProgress, setOcrProgress] = useState<string>("");

  const [formData, setFormData] = useState({
    nro_factura: "",
    monto: "",
  });

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
          user_id: session.user.email,
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

  const resetFlow = () => {
    setFile(null); setPreview(null); setCompressedBlob(null); setFormData({ nro_factura: "", monto: "" }); setStep("capture");
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-brand-blue flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
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

  const isRrhh = (session.user as any).role === "rrhh";

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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nro. de Factura</label>
                <input type="text" required value={formData.nro_factura} onChange={(e) => setFormData({ ...formData, nro_factura: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-mono text-lg text-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monto</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 font-bold text-slate-400">$</span>
                  <input type="number" step="0.01" required value={formData.monto} onChange={(e) => setFormData({ ...formData, monto: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3.5 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all font-semibold text-lg text-slate-800" />
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
      </div>
    </main>
  );
}
