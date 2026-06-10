import type { Metadata } from "next";
import "./globals.css";

import Providers from "./Providers";

export const metadata: Metadata = {
  title: "SudeParking",
  description: "Registro de facturas de estacionamiento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-900 text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
