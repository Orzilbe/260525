import { Inter, Roboto_Mono } from "next/font/google";
import { Metadata } from "next";
import "./globals.css";

// פונט Inter כתחליף ל-Geist Sans
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// פונט Roboto Mono כתחליף ל-Geist Mono
const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Unity Voice",
  description: "Unity Voice app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}