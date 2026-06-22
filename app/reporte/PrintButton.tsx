"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export default function PrintButton() {
  // Opcional: Descomentar esto si quieres que al abrir la página automáticamente salga la ventana de imprimir
  // useEffect(() => {
  //   setTimeout(() => {
  //     window.print();
  //   }, 500);
  // }, []);

  return (
    <div className="fixed bottom-8 right-8 print:hidden">
      <button 
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-[#9e1b22] hover:bg-red-800 text-white px-6 py-4 rounded-full shadow-2xl font-bold transition-all hover:scale-105"
      >
        <Printer className="w-5 h-5" />
        Imprimir Reporte
      </button>
    </div>
  );
}
