import { existsSync } from 'fs';
import path from 'path';
import Link from 'next/link';
import { PublicShell } from '@/components/public/public-shell';
import { Smartphone, MonitorDown } from 'lucide-react';

export const metadata = {
  title: 'Download ERP app — Android',
  description:
    'Install the ERP workspace on Android via Add to Home Screen, or sideload a Capacitor APK when available.',
};

/** GitHub source for native build instructions (shipped with the android/ tree). */
const ANDROID_README_URL =
  'https://github.com/itjct34-wq/jctproject/blob/main/android/README.md';

/** Published by `.github/workflows/android-apk.yml` (tag `erp-apk-latest`). */
const GITHUB_RELEASE_APK_URL =
  'https://github.com/itjct34-wq/jctproject/releases/download/erp-apk-latest/erp.apk';

function resolveApkUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim();
  if (fromEnv) return fromEnv;

  for (const name of ['erp.apk', 'erp-android.apk'] as const) {
    const localFile = path.join(process.cwd(), 'public', 'downloads', name);
    if (existsSync(localFile)) return `/downloads/${name}`;
  }

  // Sideload APK from CI release (works on production once the workflow has run).
  return GITHUB_RELEASE_APK_URL;
}

export default function DownloadPage() {
  const APK_URL = resolveApkUrl();
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
          There is no Play Store listing yet. Staff should install the ERP as a web app from{' '}
          <Link href="/login" className="font-medium text-[var(--jct-vermilion)] hover:underline">
            /login
          </Link>
          . A sideloadable APK is optional and only listed when a build is actually hosted.
        </p>

        <div className="mt-10 space-y-5">
          <div className="rounded-2xl border-2 border-[var(--jct-navy)]/20 bg-[var(--jct-panel)] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--jct-navy)] text-white">
                <Smartphone className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--jct-vermilion)]">
                  Recommended
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--jct-navy)]">
                  Install ERP (PWA / Add to Home Screen)
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--jct-muted)]">
                  Opens full-screen like an app, uses the site icon, and reaches the authenticated ERP
                  shell — not the public storefront.
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
                    </Link>
                  </li>
                  <li>
                    Tap the browser menu → <strong>Install app</strong> or{' '}
                    <strong>Add to Home screen</strong>
                  </li>
                  <li>Launch from the home screen icon</li>
                </ol>
                <Link
                  href="/login"
                  className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--jct-navy)] px-5 text-sm font-semibold text-white"
                >
                  Open ERP login
                </Link>
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
                  Capacitor Android APK (sideload)
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--jct-muted)]">
                  Optional native wrapper (`com.jct.erp`) that loads{' '}
                  <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">
                    https://jctproject.vercel.app/login
                  </code>{' '}
                  and blocks public marketing routes.
                </p>
                {apkReady ? (
                  <a
                    href={APK_URL}
                    className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--jct-navy)] px-5 text-sm font-semibold text-white"
                    download={APK_URL.startsWith('/') ? 'erp.apk' : undefined}
                  >
                    Download Android APK
                  </a>
                ) : (
                  <div className="mt-4 rounded-xl border border-[var(--jct-border)] bg-white/60 p-4 text-sm text-[var(--jct-navy)]">
                    <p className="font-semibold">No APK is hosted yet</p>
                    <p className="mt-1.5 leading-relaxed text-[var(--jct-muted)]">
                      Build the debug APK on a machine with <strong>Android Studio</strong> (Gradle
                      downloads from this deploy environment failed). Follow the steps in{' '}
                      <a
                        href={ANDROID_README_URL}
                        className="font-medium text-[var(--jct-vermilion)] underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        android/README.md
                      </a>
                      , then either place <code className="rounded bg-black/5 px-1 py-0.5 text-xs">public/downloads/erp.apk</code>{' '}
                      or set <code className="rounded bg-black/5 px-1 py-0.5 text-xs">NEXT_PUBLIC_ANDROID_APK_URL</code>.
                    </p>
                  </div>
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
