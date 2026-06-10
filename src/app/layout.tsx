import type { Metadata } from "next";
import { Space_Grotesk, Fredoka } from "next/font/google";
import AppProvider from "context/AppProvider";
import AuthProvider from "context/AuthProvider";
import TopNav from "components/TopNav";
import CrtScanlines from "components/arcade/CrtScanlines";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
});
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
});

export const metadata: Metadata = {
  title: "GAPpairs — Memory Arcade",
  description: "A solo & multiplayer memory and concentration game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${fredoka.variable} ${spaceGrotesk.className}`}>
        <AuthProvider>
          <AppProvider>
            <TopNav />
            {children}
            <CrtScanlines />
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
