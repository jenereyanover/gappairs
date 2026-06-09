import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppProvider from "context/AppProvider";
import AuthProvider from "context/AuthProvider";
import TopNav from "components/TopNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GAPpairs — Memory Match",
  description: "A solo & multiplayer memory and concentration game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AppProvider>
            <TopNav />
            {children}
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
