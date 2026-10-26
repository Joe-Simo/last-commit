import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"], style: ["normal", "italic"] });
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

const description =
  "An ofrenda for open-source projects that went quiet. Paste a GitHub repo and an open-weight model running in your browser writes its remembrance.";

export const metadata: Metadata = {
  metadataBase: new URL("https://last-commit-ofrenda.vercel.app"),
  title: "Last Commit: an ofrenda for open source that went quiet",
  description,
  openGraph: {
    title: "Last Commit",
    description,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title: "Last Commit", description, images: ["/og.png"] },
};

export const viewport: Viewport = { themeColor: "#120d11", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
