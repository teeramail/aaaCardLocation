"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { signInWithCredentials } from "@/app/login/actions";

const initialState = undefined as string | undefined;

export function LoginForm(props: { enableGoogle: boolean }) {
  const [errorMessage, formAction, isPending] = useActionState(signInWithCredentials, initialState);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const accessDenied = urlError === "AccessDenied";

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-sky-950/40 backdrop-blur">
      <div className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300">MyMap</p>
        <h1 className="text-3xl font-semibold text-white">Your personal map workspace</h1>
        <p className="text-sm text-slate-300">
          Sign in to manage schools and places across Bangkok, Chiang Mai, Taipei, and anywhere else.
        </p>
      </div>

      {accessDenied ? (
        <p className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Access denied. Your account is not authorized to use this app.
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 transition focus:border-sky-400"
            placeholder="you@example.com"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-200">Password</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 transition focus:border-sky-400"
            placeholder="••••••••"
          />
        </label>

        {errorMessage ? (
          <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {props.enableGoogle ? (
        <div className="mt-6 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10"
          >
            Continue with Google
          </button>
        </div>
      ) : null}
    </div>
  );
}
