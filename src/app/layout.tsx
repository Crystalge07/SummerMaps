import type { Metadata } from "next";
import { Caveat, Nunito } from "next/font/google";
import { LocationConsent } from "@/components/LocationConsent";
import { Nav } from "@/components/Nav";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "The Little Things",
  description:
    "A shared daily prompt to notice life's small joys. Photo what you find, pin where you found it. Friends see paths; strangers see only individual finds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} ${caveat.variable}`}>
      <body>
        <Nav />
        <LocationConsent />
        {children}
      </body>
    </html>
  );
}
