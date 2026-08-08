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
    "A shared daily prompt. Photo the little things, pin where you found them. Friends see paths; strangers see only individual finds.",
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
