import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

import { ScrollbarReveal } from "@/components/ScrollbarReveal";
import { STRINGS } from "@/lib/strings";

// Display (titoli) / sans (testo) / mono (etichette, numeri, bottoni): vedi globals.css.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: STRINGS.app.title,
  description: STRINGS.app.description,
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ScrollbarReveal />
        {children}
        {modal}
      </body>
    </html>
  );
}
