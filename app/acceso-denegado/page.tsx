import Link from "next/link";
import { ShieldAlert, Building2 } from "lucide-react";

export default function AccesoDenegado() {
  const keycloakIssuer = process.env.KEYCLOAK_ISSUER || "http://172.16.205.33:8080/realms/sudeaseg";
  const appUrl = process.env.NEXTAUTH_URL || "http://172.18.202.16:3000";
  const logoutUrl = `${keycloakIssuer}/protocol/openid-connect/logout?client_id=sudeparking&post_logout_redirect_uri=${encodeURIComponent(appUrl + "/")}`;


  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-2xl border border-red-100 text-center relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-brand-red"></div>
        
        <div className="flex justify-center mb-4">
          <div className="bg-red-50 p-5 rounded-full shadow-inner border border-red-100 relative">
            <ShieldAlert className="w-16 h-16 text-brand-red animate-pulse" />
            <div className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-full shadow-sm border border-slate-100">
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-slate-800">Acceso Restringido</h1>
          <p className="text-slate-600 font-medium leading-relaxed text-lg pb-4">
            No puedes acceder al sistema.
          </p>
        </div>
        
        <div className="pt-4">
          <a href={logoutUrl} className="block w-full py-4 rounded-xl bg-brand-blue hover:bg-[#1f2a54] text-white font-bold text-lg shadow-lg shadow-brand-blue/20 transition-all active:scale-95">
            Cerrar Sesión y Volver
          </a>
        </div>
      </div>
    </main>
  );
}
