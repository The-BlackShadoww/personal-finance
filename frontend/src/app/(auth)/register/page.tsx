"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Notice } from "@/components/settings/ui";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Full name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const password = watch("password");
  const strength = Math.min(4, Math.floor(password.length / 3));

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);

    try {
      await authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      router.push("/login?registered=true");
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 409) {
        setFormError("An account with this email already exists.");
        return;
      }

      setFormError("We could not create your account. Please try again.");
    }
  }

  const fields: Array<{
    name: keyof RegisterFormValues;
    label: string;
    type: string;
    autoComplete: string;
    placeholder: string;
  }> = [
    { name: "name", label: "Full name", type: "text", autoComplete: "name", placeholder: "Maya Okafor" },
    { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
    { name: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password", placeholder: "••••••••" },
  ];

  return (
    <div>
      <p className="eyebrow">Create account</p>
      <h1 className="mt-3 text-[32px] font-[380] leading-[1.1] tracking-[-0.025em]">
        Start with one entry.
        <span className="text-ghost"> The picture builds itself.</span>
      </h1>

      <div className="mt-8">
        <Notice show={Boolean(formError)} tone="error">
          {formError}
        </Notice>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {fields.map((field) => {
          const error = errors[field.name];
          const errorId = `${field.name}-error`;
          return (
            <div key={field.name}>
              <label className="label" htmlFor={field.name}>
                {field.label}
              </label>
              <input
                id={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? errorId : undefined}
                className="field"
                {...register(field.name)}
              />
              {field.name === "password" && password ? (
                <div className="mt-2 flex gap-1" aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        index < strength ? (strength >= 3 ? "bg-income" : "bg-expense") : "bg-surface-3",
                      )}
                    />
                  ))}
                </div>
              ) : null}
              {error ? (
                <p className="mt-1.5 text-[12px] text-red-fg" id={errorId} role="alert">
                  {error.message}
                </p>
              ) : null}
            </div>
          );
        })}

        <Button type="submit" size="lg" disabled={isSubmitting} className="group w-full">
          {isSubmitting ? <Spinner /> : null}
          {isSubmitting ? "Creating account…" : "Create account"}
          {!isSubmitting ? (
            <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-[14px] text-muted">
        Already have an account?{" "}
        <Link className="text-foreground underline-offset-4 hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
