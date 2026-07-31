"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  useEffect(() => {
    // Redirige automáticamente a Keycloak
    signIn("keycloak", { callbackUrl: "/" });
  }, []);

  return (
    <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center text-white">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="font-medium animate-pulse text-blue-200">Redirigiendo al inicio de sesión de SUDEASEG...</p>
    </div>
  );
}
