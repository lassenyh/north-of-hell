import type { Metadata } from "next";
import { Courier_Prime, Geist, Geist_Mono, Lora } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const imFellEnglish = localFont({
  src: "./fonts/IMFellEnglishSC-Regular.ttf",
  variable: "--font-im-fell-english",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-courier-prime",
  display: "swap",
});

export const metadata: Metadata = {
  title: "North of Hell",
  description: "A vertical scroll comic — Episode 1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${courierPrime.variable} ${imFellEnglish.variable} antialiased bg-white text-zinc-900`}
      >
        {children}
      </body>
    </html>
  );
}
