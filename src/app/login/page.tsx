import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isGoogleAuthEnabled } from "@/env-server";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Suspense>
        <LoginForm enableGoogle={isGoogleAuthEnabled} />
      </Suspense>
    </main>
  );
}
