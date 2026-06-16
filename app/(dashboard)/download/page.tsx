import { Download, Smartphone, ShieldCheck } from "lucide-react";
import { requireProfile } from "@/lib/dal";
import { LOGIN_URL } from "@/lib/whatsapp";

// Bump this when a new APK is copied into public/asset-agent.apk.
const AGENT_VERSION = "1.4.1";

const STEPS = [
  "Open this page on the company phone and tap “Download APK”.",
  "Open the downloaded file. Allow “install unknown apps” if Android prompts.",
  "Open Asset Agent, then enter the server URL and the device token.",
  "Grant location (“Allow all the time”) and background/battery permission.",
];

export default async function DownloadPage() {
  await requireProfile();
  const serverUrl = new URL(LOGIN_URL).origin;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Get the app
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Install the Asset Agent on a company Android phone.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Download card */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
            <Smartphone className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Asset Agent
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Android 8+ · v{AGENT_VERSION} · ~6 MB
          </p>
          <a
            href="/asset-agent.apk"
            download
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Download className="h-4 w-4" />
            Download APK
          </a>
          <p className="mt-2 text-xs text-slate-400">
            If your browser warns about the file, choose “Download anyway” — it
            is your company&apos;s own app.
          </p>
        </div>

        {/* Install steps */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Install on the phone
          </h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60">
            <div className="mb-1 font-medium text-slate-600 dark:text-slate-300">
              Server URL to enter
            </div>
            <code className="font-mono text-slate-900 dark:text-slate-100">
              {serverUrl}
            </code>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              The <strong>device token</strong> comes from the asset&apos;s
              Enroll panel (Assets → the device → Device monitoring → Enroll
              device). Ask your administrator if you don&apos;t have one.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
