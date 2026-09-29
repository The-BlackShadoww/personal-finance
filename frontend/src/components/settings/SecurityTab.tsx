'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeSlash, ShieldCheck, ShieldSlash } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProfile, useChangePassword, useSetup2fa, useEnable2fa, useDisable2fa } from '@/lib/hooks/useProfile';
import { cn } from '@/lib/utils/cn';
import type { ApiResponse } from '@/types/api';
import type { TwoFactorSetupResponse } from '@/lib/api/users';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { FieldError, Notice, SectionTitle } from './ui';

// ─── Change Password form schema ─────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password cannot exceed 72 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// ─── 2FA state machine ───────────────────────────────────────────────────────
type TwoFactorUIState =
  | 'idle'
  | 'loading-setup'
  | 'show-qr'
  | 'verifying'
  | 'enabled-success'
  | 'confirm-disable'
  | 'disabling';

type MaybeApiResponse<T> = T | ApiResponse<T>;

function unwrapApiResponse<T>(payload: MaybeApiResponse<T>): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function PasswordField({
  id,
  label,
  registration,
  error,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  registration: ReturnType<ReturnType<typeof useForm>['register']>;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          {...registration}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : 'false'}
          className="field pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[6px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeSlash size={15} weight="bold" /> : <Eye size={15} weight="bold" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

function CodeInput({
  value,
  onChange,
  invalid,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  label: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => {
          const char = value[index];
          const focused = index === Math.min(value.length, 5);
          return (
            <div
              key={index}
              className={cn(
                'grid h-14 place-items-center rounded-[8px] border bg-surface font-mono text-[22px] transition-colors',
                invalid ? 'border-red-fg' : focused ? 'border-foreground' : 'border-line',
              )}
            >
              <AnimatePresence mode="popLayout">
                {char ? (
                  <motion.span
                    key={char + index}
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -8, opacity: 0 }}
                  >
                    {char}
                  </motion.span>
                ) : focused ? (
                  <span className="h-6 w-px animate-blink bg-foreground" />
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main SecurityTab component ───────────────────────────────────────────────
export function SecurityTab() {
  const { data: profile } = useProfile();

  // ── Change Password form ──
  const changePasswordMutation = useChangePassword();
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onChangePassword(values: ChangePasswordValues) {
    setPasswordSuccess(false);
    await changePasswordMutation.mutateAsync({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    resetPasswordForm();
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 4000);
  }

  // ── 2FA state ──
  const [twoFactorState, setTwoFactorState] = useState<TwoFactorUIState>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  const setup2faMutation = useSetup2fa();
  const enable2faMutation = useEnable2fa();
  const disable2faMutation = useDisable2fa();

  async function handleSetup2fa() {
    setTwoFactorError(null);
    setTwoFactorState('loading-setup');
    try {
      const result = await setup2faMutation.mutateAsync();
      const response = unwrapApiResponse(result as MaybeApiResponse<TwoFactorSetupResponse>);
      setQrCodeDataUrl(response.qrCodeDataUrl);
      setTwoFactorState('show-qr');
    } catch (err: unknown) {
      setTwoFactorError(getErrorMessage(err, 'Failed to generate QR code'));
      setTwoFactorState('idle');
    }
  }

  async function handleEnable2fa() {
    if (totpCode.length !== 6) {
      setTwoFactorError('Please enter the 6-digit code from your authenticator app');
      return;
    }
    setTwoFactorError(null);
    setTwoFactorState('verifying');
    try {
      await enable2faMutation.mutateAsync(totpCode);
      setTotpCode('');
      setQrCodeDataUrl(null);
      setTwoFactorState('enabled-success');
      setTimeout(() => setTwoFactorState('idle'), 3000);
    } catch (err: unknown) {
      setTwoFactorError(getErrorMessage(err, 'Invalid code. Please try again.'));
      setTwoFactorState('show-qr');
    }
  }

  async function handleDisable2fa() {
    if (totpCode.length !== 6) {
      setTwoFactorError('Please enter the 6-digit code from your authenticator app');
      return;
    }
    setTwoFactorError(null);
    setTwoFactorState('disabling');
    try {
      await disable2faMutation.mutateAsync(totpCode);
      setTotpCode('');
      setTwoFactorState('idle');
    } catch (err: unknown) {
      setTwoFactorError(getErrorMessage(err, 'Invalid code. 2FA was not disabled.'));
      setTwoFactorState('confirm-disable');
    }
  }

  const is2faEnabled = profile?.twoFactorEnabled ?? false;

  return (
    <div className="max-w-lg space-y-12">
      {/* ── Change Password ── */}
      <section>
        <SectionTitle title="Change password" description="Update your password. You will remain logged in on this device." />

        {profile && profile.email && (
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-5">
            <PasswordField
              id="current-password"
              label="Current password"
              registration={register('currentPassword')}
              error={passwordErrors.currentPassword?.message}
              placeholder="Your current password"
              autoComplete="current-password"
            />
            <PasswordField
              id="new-password"
              label="New password"
              registration={register('newPassword')}
              error={passwordErrors.newPassword?.message}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              registration={register('confirmPassword')}
              error={passwordErrors.confirmPassword?.message}
              placeholder="Repeat your new password"
              autoComplete="new-password"
            />

            <Notice show={Boolean(changePasswordMutation.error)} tone="error">
              {(changePasswordMutation.error as Error)?.message ?? 'Failed to change password'}
            </Notice>
            <Notice show={passwordSuccess} tone="success">
              Password changed successfully
            </Notice>

            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? <Spinner /> : null}
              {changePasswordMutation.isPending ? 'Changing…' : 'Change password'}
            </Button>
          </form>
        )}
      </section>

      {/* ── Two-Factor Authentication ── */}
      <section className="border-t border-line pt-10">
        <SectionTitle
          title="Two-factor authentication"
          description="Add an extra layer of security. After enabling, you will need a code from your authenticator app every time you log in."
          aside={
            <span className={cn('tag shrink-0', is2faEnabled ? 'bg-green-bg text-green-fg' : 'bg-surface-2 text-muted')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', is2faEnabled ? 'bg-green-fg' : 'bg-faint')} />
              {is2faEnabled ? 'Enabled' : 'Disabled'}
            </span>
          }
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={twoFactorState}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {twoFactorState === 'idle' && (
              <div>
                {!is2faEnabled ? (
                  <Button onClick={handleSetup2fa}>
                    <ShieldCheck size={15} weight="bold" />
                    Enable two-factor auth
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="text-red-fg hover:border-red-fg/40 hover:bg-red-bg"
                    onClick={() => {
                      setTwoFactorState('confirm-disable');
                      setTotpCode('');
                      setTwoFactorError(null);
                    }}
                  >
                    <ShieldSlash size={15} weight="bold" />
                    Disable two-factor auth
                  </Button>
                )}
                {twoFactorError ? <p className="mt-3 text-[13px] text-red-fg">{twoFactorError}</p> : null}
              </div>
            )}

            {(twoFactorState === 'loading-setup' || twoFactorState === 'verifying' || twoFactorState === 'disabling') && (
              <div className="flex items-center gap-3 text-[14px] text-muted">
                <Spinner />
                {twoFactorState === 'loading-setup'
                  ? 'Generating QR code…'
                  : twoFactorState === 'verifying'
                    ? 'Verifying code…'
                    : 'Disabling two-factor authentication…'}
              </div>
            )}

            {twoFactorState === 'show-qr' && qrCodeDataUrl && (
              <div className="space-y-5">
                <div className="rounded-[10px] border border-line p-5">
                  <ol className="space-y-6">
                    <li>
                      <p className="flex items-center gap-2.5 text-[14px]">
                        <span className="kbd">1</span> Scan this QR code
                      </p>
                      <p className="hint mt-1 pl-8">Open Google Authenticator, Authy, or any TOTP app and scan:</p>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                        className="mt-4 flex justify-center"
                      >
                        <div className="rounded-[10px] border border-line bg-white p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrCodeDataUrl} alt="2FA QR Code" width={184} height={184} className="block" />
                        </div>
                      </motion.div>
                    </li>
                    <li>
                      <p className="flex items-center gap-2.5 text-[14px]">
                        <span className="kbd">2</span> Enter the 6-digit code
                      </p>
                      <p className="hint mb-4 mt-1 pl-8">After scanning, enter the code your app shows to confirm setup.</p>
                      <CodeInput
                        label="Authenticator code"
                        value={totpCode}
                        invalid={Boolean(twoFactorError)}
                        onChange={(value) => {
                          setTotpCode(value);
                          setTwoFactorError(null);
                        }}
                      />
                    </li>
                  </ol>
                </div>

                {twoFactorError && <p className="text-[13px] text-red-fg">{twoFactorError}</p>}

                <div className="flex gap-2">
                  <Button onClick={handleEnable2fa} disabled={totpCode.length !== 6} className="flex-1">
                    Verify and enable
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTwoFactorState('idle');
                      setTotpCode('');
                      setQrCodeDataUrl(null);
                      setTwoFactorError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {twoFactorState === 'enabled-success' && (
              <Notice show tone="success">
                <p>Two-factor authentication is now active</p>
                <p className="mt-0.5 opacity-80">You will be asked for a code from your authenticator app on every login.</p>
              </Notice>
            )}

            {twoFactorState === 'confirm-disable' && (
              <div className="space-y-5">
                <div className="rounded-[10px] bg-red-bg p-5">
                  <p className="text-[14px] text-red-fg">Disable two-factor authentication?</p>
                  <p className="mb-4 mt-1 text-[13px] text-red-fg/80">
                    Your account will be less secure. Enter your current authenticator code to confirm.
                  </p>
                  <CodeInput
                    label="Authenticator code"
                    value={totpCode}
                    invalid={Boolean(twoFactorError)}
                    onChange={(value) => {
                      setTotpCode(value);
                      setTwoFactorError(null);
                    }}
                  />
                </div>

                {twoFactorError && <p className="text-[13px] text-red-fg">{twoFactorError}</p>}

                <div className="flex gap-2">
                  <Button variant="danger" onClick={handleDisable2fa} disabled={totpCode.length !== 6} className="flex-1">
                    Confirm disable
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTwoFactorState('idle');
                      setTotpCode('');
                      setTwoFactorError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}
