'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Envelope, Lock } from '@phosphor-icons/react';
import { useProfile, useUpdateProfile } from '@/lib/hooks/useProfile';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { FieldError, Notice } from './ui';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  avatarUrl: z
    .string()
    .url('Must be a valid URL starting with http:// or https://')
    .max(500)
    .optional()
    .or(z.literal('')),
  // .or(z.literal('')) allows the field to be blank (cleared).
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileTab() {
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const updateMutation = useUpdateProfile();
  const [showSuccess, setShowSuccess] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', avatarUrl: '' },
  });

  // Populate form once profile data loads (async default values → reset()).
  useEffect(() => {
    if (profile) {
      reset({ name: profile.name, avatarUrl: profile.avatarUrl ?? '' });
    }
  }, [profile, reset]);

  const liveName = watch('name');
  const liveAvatar = watch('avatarUrl');
  useEffect(() => setAvatarBroken(false), [liveAvatar]);

  async function onSubmit(values: ProfileFormValues) {
    setShowSuccess(false);
    await updateMutation.mutateAsync({
      name: values.name,
      avatarUrl: values.avatarUrl || undefined,
    });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }

  if (isProfileLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="skeleton h-20" />
        <div className="skeleton h-11" />
        <div className="skeleton h-11" />
      </div>
    );
  }

  const initials = (liveName || profile?.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-7">
      <div className="flex items-center gap-5">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-clip rounded-full border border-line bg-surface-2 text-[20px] tracking-[-0.02em] text-foreground">
          {liveAvatar && !avatarBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={liveAvatar}
              alt={profile?.name ?? 'Avatar'}
              className="h-full w-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            initials || '—'
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[16px]">{liveName || profile?.name}</p>
          <p className="truncate text-[13px] text-muted">{profile?.email}</p>
        </div>
      </div>

      <div>
        <span className="label">Email address</span>
        <div className="flex h-11 items-center gap-2.5 rounded-[8px] border border-line bg-surface-2 px-3.5 text-[14px] text-muted">
          <Envelope size={15} weight="bold" className="shrink-0" />
          <span className="truncate">{profile?.email}</span>
          <Lock size={13} weight="bold" className="ml-auto shrink-0 text-faint" />
        </div>
        <p className="hint mt-1.5">Contact support to change your email address.</p>
      </div>

      <div>
        <label className="label" htmlFor="profile-name">Full name</label>
        <input
          id="profile-name"
          {...register('name')}
          placeholder="Your full name"
          aria-invalid={errors.name ? 'true' : 'false'}
          className="field"
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div>
        <label className="label" htmlFor="profile-avatar">
          Avatar URL <span className="text-faint">optional</span>
        </label>
        <input
          id="profile-avatar"
          {...register('avatarUrl')}
          placeholder="https://images.example.com/you.jpg"
          aria-invalid={errors.avatarUrl ? 'true' : 'false'}
          className="field"
        />
        <FieldError message={errors.avatarUrl?.message} />
        <p className="hint mt-1.5">Paste a link to any publicly accessible image.</p>
      </div>

      <Notice show={Boolean(updateMutation.error)} tone="error">
        {(updateMutation.error as Error)?.message ?? 'Failed to update profile'}
      </Notice>
      <Notice show={showSuccess} tone="success">
        Profile updated successfully
      </Notice>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
          {updateMutation.isPending ? <Spinner /> : null}
          {updateMutation.isPending ? 'Saving…' : 'Save profile'}
        </Button>
        {!isDirty && <span className="text-[13px] text-faint">No changes to save</span>}
      </div>
    </form>
  );
}
