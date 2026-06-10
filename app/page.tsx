"use client";

import { useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import Tesseract from "tesseract.js";
import { Camera, FileText, Loader2, CheckCircle2, UploadCloud } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
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
    setOcrProgress("Preparando imagen...");
    try {
      // 0. Preprocesar imagen (Corregir EXIF de celulares y reducir tamaño)
      const imgUrl = URL.createObjectURL(imageFile);
      const img = new Image();
      img.src = imgUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      const MAX_SIZE = 1500;
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > MAX_SIZE) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else if (height > MAX_SIZE) {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      // Pasamos el Canvas (con la rotación corregida y tamaño óptimo) a Tesseract
      const result = await Tesseract.recognize(canvas, "spa", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(`Analizando... ${Math.round(m.progress * 100)}%`);
          } else {
            setOcrProgress("Cargando IA...");
          }
        }
      });
      
      const text = result.data.text;
      console.log("Texto extraído:", text);
      setRawOcrText(text);

      // 1. Extraer Nro Factura:
      // A veces Tesseract confunde el 0 con la O, o agrega espacios.
      // Buscamos cualquier bloque de 5 a 10 dígitos (o letras O que parecen 0)
      const textClean = text.replace(/O/g, "0");
      const nroFacturaMatch = textClean.match(/FACTURA[\s\S]{0,50}?(\d{5,10})/i);
      const fallbackFacturaMatch = textClean.match(/\b(000\d{4,7})\b/);
      let nro_factura = nroFacturaMatch ? nroFacturaMatch[1] : (fallbackFacturaMatch ? fallbackFacturaMatch[1] : "");

      // 2. Extraer Monto Total:
      // Aceptamos comas o puntos indistintamente como separador decimal para evitar fallos de lectura
      const montosRegex = /\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b|\b\d+[.,]\d{2}\b/g;
      let matchMonto;
      let maxMonto = 0;
      let montoStr = "";

      while ((matchMonto = montosRegex.exec(textClean)) !== null) {
        // Normalizamos: quitamos todos los puntos/comas menos el último
        let rawVal = matchMonto[0];
        let lastSepIndex = Math.max(rawVal.lastIndexOf("."), rawVal.lastIndexOf(","));
        let valStr = rawVal.substring(0, lastSepIndex).replace(/[.,]/g, "") + "." + rawVal.substring(lastSepIndex + 1);
        
        let val = parseFloat(valStr);
        if (!isNaN(val) && val > maxMonto) {
          maxMonto = val;
          montoStr = valStr;
        }
      }

      setFormData({
        nro_factura,
        monto: montoStr,
      });
      setStep("review");
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Error procesando la imagen con IA. Por favor, ingresa los datos manuales.");
      setStep("review");
    } finally {
      setLoading(false);
      setOcrProgress("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.from("facturas").insert([
        {
          nro_factura: formData.nro_factura,
          monto: parseFloat(formData.monto),
        },
      ]);

      if (error) throw error;
      setStep("success");
    } catch (error) {
      console.error(error);
      alert("Error guardando en la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const response = await fetch("/api/generar-reporte");
      if (!response.ok) throw new Error("Error generando reporte");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_Semanal_${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      alert("Error descargando el reporte.");
    } finally {
      setReportLoading(false);
    }
  };

  const resetFlow = () => {
    setFile(null);
    setPreview(null);
    setFormData({ nro_factura: "", monto: "" });
    setStep("capture");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 font-sans selection:bg-blue-500/30">
      <div className="max-w-md mx-auto space-y-8 py-8">
        
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            SmartParking
          </h1>
          <p className="text-slate-400 text-sm">Registro de Facturas de Estacionamiento</p>
        </header>

        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl">
          
          {step === "capture" && (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-300"></div>
                <div className="relative bg-slate-800 border-2 border-dashed border-blue-500/50 rounded-full p-8 transition-transform group-hover:scale-105">
                  {loading ? (
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                  ) : (
                    <Camera className="w-12 h-12 text-blue-400" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">{loading ? "Analizando factura..." : "Capturar Factura"}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {loading ? (ocrProgress || "Extrayendo datos con IA") : "Toma una foto de tu ticket"}
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleCapture}
                disabled={loading}
              />
            </div>
          )}

          {step === "review" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <UploadCloud className="text-blue-400 w-5 h-5" /> Validar Datos
              </h3>
              
              {preview && (
                <div className="relative w-full h-40 rounded-xl overflow-hidden mb-4 border border-slate-700">
                  <img src={preview} alt="Factura" className="object-cover w-full h-full opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nro. de Factura</label>
                <input
                  type="text"
                  required
                  value={formData.nro_factura}
                  onChange={(e) => setFormData({ ...formData, nro_factura: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-white placeholder-slate-500"
                  placeholder="Ej. 0001234"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Monto</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.monto}
                    onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-emerald-500 transition-all text-white placeholder-slate-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={resetFlow}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 text-white font-medium shadow-lg shadow-blue-500/25 transition flex justify-center items-center"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar"}
                </button>
              </div>

              {/* Botón para ver el texto detectado (Debug) */}
              {rawOcrText && (
                <div className="mt-6 text-left">
                  <p className="text-xs text-slate-400 mb-1">Texto detectado por la IA (Modo Debug):</p>
                  <div className="w-full h-32 p-2 bg-slate-800 text-xs font-mono text-slate-300 rounded overflow-y-auto whitespace-pre-wrap border border-slate-700">
                    {rawOcrText}
                  </div>
                </div>
              )}
            </form>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              <h3 className="text-xl font-semibold">¡Registro Exitoso!</h3>
              <p className="text-sm text-slate-400 text-center">
                La factura ha sido guardada en la base de datos.
              </p>
              <button
                onClick={resetFlow}
                className="mt-4 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition"
              >
                Registrar Otra
              </button>
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-slate-800">
          <button
            onClick={generateReport}
            disabled={reportLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
          >
            {reportLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <FileText className="w-6 h-6" />
            )}
            {reportLoading ? "Generando documento..." : "Generar Reporte Semanal"}
          </button>
        </div>

      </div>
    </main>
  );
}
