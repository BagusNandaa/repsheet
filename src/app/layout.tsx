import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Repsheet",
  description:
    "Body stats, sessions, and example exercise videos for one coach and their clients.",
  applicationName: "Repsheet",
  appleWebApp: {
    capable: true,
    title: "Repsheet",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3efe6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-desk">
        <StoreProvider>
          <ServiceWorkerRegister />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
