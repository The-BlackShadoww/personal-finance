"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Notice } from "@/components/settings/ui";
import { authApi } from "@/lib/api/auth";
import { ApiError, setAccessToken } from "@/lib/api/client";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginForm registered={false} />}>
      <LoginFormWithSearchParams />
    </Suspense>
  );
}

function LoginFormWithSearchParams() {
  const searchParams = useSearchParams();
  return <LoginForm registered={searchParams.get("registered") === "true"} />;
}

type LoginFormProps = {
  registered: boolean;
};

function LoginForm({ registered }: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);

    try {
      const response = await authApi.login(values);

      if ("requiresTwoFactor" in response.data) {
        sessionStorage.setItem("tempToken", response.data.tempToken);
        router.push("/2fa");
        return;
      }

      setAccessToken(response.data.accessToken);
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setFormError("Invalid credentials");
        return;
      }

      setFormError("We could not log you in. Please try again.");
    }
  }

  return (
    <div>
      <p className="eyebrow">Log in</p>
      <h1 className="mt-3 text-[32px] font-[380] leading-[1.1] tracking-[-0.025em]">
        Welcome back.
        <span className="text-ghost"> Your dashboard is waiting.</span>
      </h1>

      <div className="mt-8 space-y-3">
        <Notice show={registered} tone="success">
          Registered successfully. Please log in.
        </Notice>
        <Notice show={Boolean(formError)} tone="error">
          {formError}
        </Notice>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="field"
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1.5 text-[12px] text-red-fg" id="email-error" role="alert">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="field"
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1.5 text-[12px] text-red-fg" id="password-error" role="alert">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" disabled={isSubmitting} className="group w-full">
          {isSubmitting ? <Spinner /> : null}
          {isSubmitting ? "Logging in…" : "Log in"}
          {!isSubmitting ? (
            <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
        New here?{" "}
        <Link className="text-foreground underline-offset-4 hover:underline" href="/register">
          Create an account
        </Link>
      </p>
    </div>
  );
}
