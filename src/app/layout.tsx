import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Fraunces, Outfit } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { StoreProvider } from "@/lib/store";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

/* Self-hosted OFL faces. Dark body/labels use Space Mono; display numbers use Doto.
   next/font serves these from this origin. Nothing's NDot is not used. */
const spaceMono = localFont({
  src: [
    { path: "../fonts/SpaceMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/SpaceMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-space-mono",
  display: "swap",
  adjustFontFallback: false,
});

const doto = localFont({
  src: "../fonts/Doto-latin.woff2",
  variable: "--font-doto",
  weight: "100 900",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Repsheet",
  description:
    "Body stats, sessions, and example exercise videos for one coach and their clients.",
  applicationName: "Repsheet",
  appleWebApp: {
    capable: true,
    title: "Repsheet",
    statusBarStyle: "black",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-accent="green"
      data-theme="dark"
      suppressHydrationWarning
      className={`dark ${outfit.variable} ${fraunces.variable} ${spaceMono.variable} ${doto.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-desk">
        <ThemeProvider>
          <StoreProvider>
            <ServiceWorkerRegister />
            {children}
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
