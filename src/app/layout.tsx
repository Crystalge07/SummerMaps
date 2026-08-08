import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

/** Matches pictureofhotdog.com: Freight Sans Pro (body) + Freight Big Pro (display). */
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
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
    <html lang="en" className={`${sourceSans.variable} ${newsreader.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
