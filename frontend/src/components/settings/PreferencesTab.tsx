'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Globe } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useProfile, useUpdateProfile } from '@/lib/hooks/useProfile';
import { useTheme, type Theme } from '@/lib/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils/cn';
import { CurrencySection } from './CurrencySection';
import { FieldError, Notice, SectionTitle } from './ui';
import { Select } from "@/components/ui/Select";

// A curated list of common IANA timezones grouped by region keeps the
// dropdown scannable without scrolling through all ~600 zones.
const TIMEZONE_GROUPS: Array<{
  group: string;
  zones: Array<{ value: string; label: string }>;
}> = [
  {
    group: 'Asia',
    zones: [
      { value: 'Asia/Dhaka', label: 'Dhaka (UTC+6)' },
      { value: 'Asia/Kolkata', label: 'Mumbai, New Delhi (UTC+5:30)' },
      { value: 'Asia/Karachi', label: 'Karachi, Islamabad (UTC+5)' },
      { value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi (UTC+4)' },
      { value: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (UTC+8)' },
      { value: 'Asia/Bangkok', label: 'Bangkok, Jakarta (UTC+7)' },
      { value: 'Asia/Tokyo', label: 'Tokyo, Seoul (UTC+9)' },
      { value: 'Asia/Shanghai', label: 'Beijing, Shanghai (UTC+8)' },
    ],
  },
  {
    group: 'Europe',
    zones: [
      { value: 'Europe/London', label: 'London (UTC+0/+1)' },
      { value: 'Europe/Paris', label: 'Paris, Berlin, Rome (UTC+1/+2)' },
      { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
      { value: 'Europe/Istanbul', label: 'Istanbul (UTC+3)' },
    ],
  },
  {
    group: 'Americas',
    zones: [
      { value: 'America/New_York', label: 'New York, Miami (UTC-5/-4)' },
      { value: 'America/Chicago', label: 'Chicago, Dallas (UTC-6/-5)' },
      { value: 'America/Denver', label: 'Denver, Phoenix (UTC-7/-6)' },
      { value: 'America/Los_Angeles', label: 'Los Angeles, Seattle (UTC-8/-7)' },
      { value: 'America/Toronto', label: 'Toronto, Montreal (UTC-5/-4)' },
      { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
    ],
  },
  {
    group: 'Africa',
    zones: [
      { value: 'Africa/Cairo', label: 'Cairo (UTC+2)' },
      { value: 'Africa/Lagos', label: 'Lagos, Accra (UTC+1)' },
      { value: 'Africa/Nairobi', label: 'Nairobi (UTC+3)' },
    ],
  },
  {
    group: 'Pacific',
    zones: [
      { value: 'Australia/Sydney', label: 'Sydney, Melbourne (UTC+10/+11)' },
      { value: 'Pacific/Auckland', label: 'Auckland (UTC+12/+13)' },
    ],
  },
  {
    group: 'Universal',
    zones: [{ value: 'UTC', label: 'UTC (Universal Coordinated Time)' }],
  },
];

const ALL_ZONES = TIMEZONE_GROUPS.flatMap((g) => g.zones);

const preferencesSchema = z.object({
  timezone: z.string().min(1, 'Please select a timezone'),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export function PreferencesTab() {
  const { data: profile, isLoading } = useProfile();
  const updateMutation = useUpdateProfile();
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: { timezone: 'UTC' },
  });

  useEffect(() => {
    if (profile) {
      reset({ timezone: profile.timezone ?? 'UTC' });
    }
  }, [profile, reset]);

  const selectedTimezone = watch('timezone');
  // Falls back to the raw IANA value if the zone is not in the curated list.
  const selectedLabel = ALL_ZONES.find((z) => z.value === selectedTimezone)?.label ?? selectedTimezone;

  async function onSubmit(values: PreferencesFormValues) {
    setShowSuccess(false);
    await updateMutation.mutateAsync({ timezone: values.timezone });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    reset({ timezone: values.timezone });
  }

  return (
    <div className="max-w-xl space-y-12">
      <AppearancePicker />

      <CurrencySection />

      <section className="border-t border-line pt-10">
        <SectionTitle
          title="Timezone"
          description="Used to group transactions by day and month in your reports and summaries. Choose where you make most of your transactions."
        />
        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-11" />
            <div className="skeleton h-16" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label" htmlFor="timezone">Timezone</label>
              <Select id="timezone" {...register('timezone')} aria-invalid={errors.timezone ? 'true' : 'false'} className="field">
                {TIMEZONE_GROUPS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.zones.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <FieldError message={errors.timezone?.message} />
            </div>

            <div className="flex items-start gap-3 rounded-[8px] bg-blue-bg px-4 py-3 text-blue-fg">
              <Globe size={16} weight="bold" className="mt-0.5 shrink-0" />
              <div className="text-[13px]">
                <p>Currently selected: {selectedLabel}</p>
                <p className="mt-0.5 opacity-80">Your financial summaries will show months and days in this timezone.</p>
              </div>
            </div>

            <Notice show={Boolean(updateMutation.error)} tone="error">
              {(updateMutation.error as Error)?.message ?? 'Failed to save preferences'}
            </Notice>
            <Notice show={showSuccess} tone="success">
              Timezone saved successfully
            </Notice>

            <div className="flex items-center gap-4 pt-1">
              <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
                {updateMutation.isPending ? <Spinner /> : null}
                {updateMutation.isPending ? 'Saving…' : 'Save preferences'}
              </Button>
              {!isDirty && <span className="text-[13px] text-faint">No changes to save</span>}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function AppearancePicker() {
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <section>
      <SectionTitle title="Appearance" description="Choose how Personal Finance looks on this device." />
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
        {options.map((option) => {
          const selected = theme === option.value;
          const dark = option.value === 'dark';
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.value)}
              className={cn(
                'group rounded-[10px] border p-2 text-left transition-colors',
                selected ? 'border-foreground' : 'border-line hover:border-line-strong',
              )}
            >
              <div
                className="overflow-hidden rounded-[6px] border"
                style={{
                  background: dark ? '#171717' : '#ffffff',
                  borderColor: dark ? '#2a2a2a' : '#eaeaea',
                }}
                aria-hidden="true"
              >
                <div className="flex items-center gap-1 px-2.5 py-2" style={{ borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eaeaea'}` }}>
                  <span className="h-2 w-2 rounded-[1px]" style={{ background: dark ? '#ededec' : '#161514' }} />
                  <span className="ml-1 h-1 w-8 rounded-full" style={{ background: dark ? '#363636' : '#dcdbd9' }} />
                </div>
                <div className="space-y-1.5 p-2.5">
                  <span className="block h-1.5 w-2/3 rounded-full" style={{ background: dark ? '#ededec' : '#161514' }} />
                  <span className="block h-1.5 w-1/2 rounded-full" style={{ background: dark ? '#4a4948' : '#c9c8c6' }} />
                  <div className="flex items-end gap-1 pt-2">
                    {[40, 65, 50, 80, 60].map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-full rounded-t-[2px]"
                        style={{ height: h * 0.3, background: i % 2 ? '#eb6834' : '#1baf7a', originY: 1 }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between px-1 pb-0.5 pt-2.5 text-[14px]">
                {option.label}
                <span
                  className={cn('grid h-4 w-4 place-items-center rounded-full border', selected ? 'border-foreground' : 'border-line-strong')}
                >
                  {selected ? <motion.span layoutId="theme-dot" className="h-2 w-2 rounded-full bg-foreground" /> : null}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
