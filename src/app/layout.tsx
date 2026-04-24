import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/app/globals.css";
import { TRPCReactProvider } from "@/trpc/react";

const inter = Inter({
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "MyMap",
  description: "A personal place map with selection, measurement, and image uploads."
};

export default function RootLayout(props: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <TRPCReactProvider>{props.children}</TRPCReactProvider>
      </body>
    </html>
  );
}
