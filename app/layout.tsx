import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Nav } from "@/components/Nav";
import { ThemeSync } from "@/components/ThemeSync";
import { ToastProvider } from "@/components/Toasts";

export const metadata: Metadata = {
  title: "Beam — learn languages by reading",
  description: "Immersion language learning with in-context translations from Claude.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#15161a" },
  ],
};

// Applies the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("beam-theme");if(t&&t!=="system")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ConvexClientProvider>
          <ToastProvider>
            <ThemeSync />
            <div className="shell">
              <Nav />
              <main className="page">{children}</main>
            </div>
          </ToastProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
