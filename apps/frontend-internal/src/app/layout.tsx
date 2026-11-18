import { ThemeProvider } from "@heat/ui";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "../shell/providers";
import "./globals.css";

export const metadata: Metadata = { title: "WSAP Admin" };

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
