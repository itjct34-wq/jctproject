import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { Smartphone, MonitorDown } from 'lucide-react';

export const metadata = {
  title: 'Download ERP app — Android',
  description:
    'Install the ERP workspace on Android via progressive web app, or build a native wrapper with Capacitor.',
};

/** Set NEXT_PUBLIC_ANDROID_APK_URL when a release APK is hosted. */
const APK_URL = process.env.NEXT_PUBLIC_ANDROID_APK_URL || '';

export default function DownloadPage() {
  const apkReady = Boolean(APK_URL);

  return (
    <PublicShell>
      <section className="jct-home-wrap max-w-3xl py-14 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--jct-vermilion)]">
          Mobile app
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-[var(--jct-navy)] md:text-4xl">
          ERP on Android
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--jct-muted)]">
          Staff can run the ERP as an installable Android experience today. There is no Play Store listing
          yet — use Add to Home Screen (recommended), or build a Capacitor APK from this repository when you
          need a sideloadable package.
        </p>

        <div className="mt-10 space-y-5">
          <div className="rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--jct-navy)]/8 text-[var(--jct-navy)]">
                <Smartphone className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--jct-navy)]">
                  Option 1 — Install as a web app (PWA)
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--jct-muted)]">
                  Best path right now. Opens full-screen like an app, uses the site icon, and works offline
                  for cached shells once installed.
                </p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--jct-navy)]">
                  <li>Open Chrome on your Android phone</li>
                  <li>
                    Go to{' '}
                    <Link
                      href="/login"
                      className="font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
                    >
                      /login
                    </Link>{' '}
                    (or your ERP dashboard after sign-in)
                  </li>
                  <li>
                    Tap the browser menu → <strong>Install app</strong> or <strong>Add to Home screen</strong>
                  </li>
                  <li>Launch from the home screen icon</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--jct-border)] bg-[var(--jct-panel)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--jct-navy)]/8 text-[var(--jct-navy)]">
                <MonitorDown className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--jct-navy)]">
                  Option 2 — Capacitor Android APK (sideload)
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--jct-muted)]">
                  A Capacitor Android wrapper scaffold lives under{' '}
                  <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">android/</code> (see{' '}
                  <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">android/README.md</code>).
                  Build locally or in CI, then host the APK. No Play Store publish is configured in-repo.
                </p>
                {apkReady ? (
                  <a
                    href={APK_URL}
                    className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--jct-navy)] px-5 text-sm font-semibold text-white"
                  >
                    Download Android APK
                  </a>
                ) : (
                  <>
                    <span className="mt-4 inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-xl border-2 border-dashed border-[var(--jct-navy)]/25 bg-white/70 px-4 text-sm font-semibold text-[var(--jct-navy)] opacity-70">
                      Download APK — coming soon
                    </span>
                    <p className="mt-2 text-xs text-[var(--jct-muted-2)]">
                      Set <code>NEXT_PUBLIC_ANDROID_APK_URL</code> or place a file at{' '}
                      <code>public/downloads/erp-android.apk</code> after building with Capacitor.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-sm text-[var(--jct-muted)]">
          Looking for stock instead?{' '}
          <Link href="/inventory" className="font-medium text-[var(--jct-vermilion)] hover:underline">
            Browse inventory
          </Link>
          {' · '}
          <Link href="/login" className="font-medium text-[var(--jct-vermilion)] hover:underline">
            ERP login
          </Link>
        </p>
      </section>
    </PublicShell>
  );
}
