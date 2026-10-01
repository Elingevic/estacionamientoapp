import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const accessDeniedHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acceso Denegado - SudeParking</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #ffffff;
      padding: 2.5rem 2rem;
      border-radius: 1.5rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border: 1px solid #fee2e2;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .top-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 6px;
      background: linear-gradient(90deg, #ef4444, #b91c1c);
    }
    .icon-box {
      width: 80px;
      height: 80px;
      background: #fef2f2;
      border: 1px solid #fee2e2;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
    }
    .icon-box svg {
      width: 44px;
      height: 44px;
      stroke: #dc2626;
      stroke-width: 2;
      fill: none;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 0.75rem;
    }
    p {
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      color: #dc2626;
      background: #fef2f2;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 0.75rem;
      border: 1px solid #fecaca;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.875rem;
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.95rem;
      border-radius: 0.75rem;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #1e40af;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-bar"></div>
    <div class="icon-box">
      <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <div class="badge">Acceso Denegado (403)</div>
    <h1>Acceso Restringido</h1>
    <p>No tienes permisos suficientes para acceder al panel de Recursos Humanos.</p>
    <a href="/" class="btn">Volver al Inicio</a>
  </div>
</body>
</html>`;

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;
    const isProtected =
      pathname.startsWith("/rrhh") ||
      pathname.startsWith("/auditoria") ||
      pathname.startsWith("/audit") ||
      pathname.startsWith("/logs") ||
      pathname.startsWith("/historial") ||
      pathname.startsWith("/trazabilidad");

    if (isProtected) {
      const isRrhh = req.nextauth.token?.role === "rrhh";
      if (!isRrhh) {
        // Respuesta HTTP 403 estricta con diseño institucional
        return new NextResponse(accessDeniedHtml, {
          status: 403,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Redirigir alias probados por QA hacia /auditoria
      if (
        pathname === "/audit" ||
        pathname === "/logs" ||
        pathname === "/historial" ||
        pathname === "/trazabilidad"
      ) {
        return NextResponse.redirect(new URL("/auditoria", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/rrhh/:path*",
    "/auditoria/:path*",
    "/audit/:path*",
    "/logs/:path*",
    "/historial/:path*",
    "/trazabilidad/:path*",
  ],
};
