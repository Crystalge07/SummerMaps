import type { Metadata } from "next";
import { Caveat, Nunito, Playfair_Display } from "next/font/google";
import { AppChrome } from "@/components/AppChrome";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "600"],
  variable: "--font-display",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-script",
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
    <html
      lang="en"
      className={`${nunito.variable} ${playfair.variable} ${caveat.variable}`}
    >
      <body>
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
