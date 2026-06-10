import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartParking",
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
        {children}
      </body>
    </html>
  );
}
