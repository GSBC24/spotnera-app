import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { GoogleAnalytics } from "@/components/google-analytics";
import { ConsentManager } from "@/components/consent-manager";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata = {
  title: "Spotnera",
  description: "Discover nearby businesses, live deals and local activity.",
  applicationName: "Spotnera",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spotnera",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      {
        url: "/icons/spotnera-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/spotnera-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport = {
  themeColor: "#101217",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        <SiteFooter />
        <PwaInstallPrompt />
        <ConsentManager />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
