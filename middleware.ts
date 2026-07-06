import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Proteger las rutas bajo /rrhh
    if (req.nextUrl.pathname.startsWith("/rrhh")) {
      const isRrhh = req.nextauth.token?.role === "rrhh";
      if (!isRrhh) {
        // Respuesta HTTP 403 estricta, como lo solicita el requerimiento.
        return new NextResponse("Forbidden - No tienes acceso al panel de Recursos Humanos", { status: 403 });
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/rrhh/:path*"],
};
