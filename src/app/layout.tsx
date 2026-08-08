import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Pathline",
  description:
    "Every check-in is a photo and a place. Every day is a path — yours, your circle's, and the city's.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${syne.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
