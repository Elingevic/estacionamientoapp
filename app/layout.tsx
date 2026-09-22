import type { Metadata } from "next";
import "./globals.css";

import Providers from "./Providers";

export const metadata: Metadata = {
  title: "estacionamiento.sudeaseg.gob.ve",
  description: "Registro de facturas de estacionamiento",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png"
  }
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
