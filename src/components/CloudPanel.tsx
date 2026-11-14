import { useState, useSyncExternalStore } from 'react';
import { cloudConfigured, downloadNow, getCloud, resolveConflict, sendMagicLink, signOut, subscribeCloud, uploadNow, type SaveSummary } from '../game/cloud';

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : 'never');

function Summary({ title, s }: { title: string; s: SaveSummary }) {
  return (
    <div className="rounded-xl bg-black/30 p-3 text-xs">
      <div className="mb-1 font-bold">{title}</div>
      <div>Difficulty: <b>{s.difficulty ?? '—'}</b></div>
      <div>Day–night cycle: <b>{s.cycle ?? '—'}</b> · colony hours: <b>{s.hours ?? '—'}</b></div>
      <div className="text-white/55">Saved {when(s.updatedAt)}</div>
    </div>
  );
}

/** Cloud save (Supabase): sign in with an email link, sync, and resolve conflicts. */
export default function CloudPanel() {
  const c = useSyncExternalStore(subscribeCloud, getCloud);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDownload, setConfirmDownload] = useState(false);

  if (!cloudConfigured) {
    return (
      <div className="text-sm">
        <p className="rounded-xl bg-black/30 p-3">☁️ Cloud save isn’t set up for this copy of the game, so progress is saved in this browser only.</p>
        <p className="mt-2 text-xs text-white/55">For developers: add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see <code>DEPLOY.md</code>).</p>
      </div>
    );
  }

  if (c.status === 'signed-out' || c.status === 'link-sent') {
    return (
      <div className="text-sm">
        <p className="mb-3 text-white/75">Sign in to keep your colony, achievements and options in the cloud and continue on any device. No password: we email you a sign-in link.</p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            const r = await sendMagicLink(email.trim());
            setBusy(false);
            setMsg(r.ok ? null : r.error ?? 'Could not send the link.');
          }}
        >
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[220px] flex-1 rounded-xl border-2 border-edge bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan"
            aria-label="Email address"
          />
          <button className="btn btn-yellow" disabled={busy || !email.includes('@')}>{busy ? 'Sending…' : '✉️ Send sign-in link'}</button>
        </form>
        {c.status === 'link-sent' && <p className="mt-3 rounded-xl bg-good/10 p-3 text-good">Check your inbox for {c.email} and open the link in this browser. You can keep playing meanwhile.</p>}
        {msg && <p className="mt-2 text-xs text-bad">{msg}</p>}
        <p className="mt-3 text-[11px] text-white/45">Without signing in, the game still saves in this browser.</p>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/30 p-3">
        <div>
          <div className="text-xs text-white/55">Signed in as</div>
          <div className="font-bold">{c.email}</div>
        </div>
        <div className="text-right text-xs">
          <div className={c.status === 'error' ? 'font-bold text-bad' : c.status === 'conflict' ? 'font-bold text-warn' : c.status === 'syncing' ? 'text-cyan' : 'text-good'}>
            {{ syncing: '⟳ Syncing…', synced: '✓ Synced', conflict: '⚠ Choose a save', error: '✕ Sync error', disabled: '', 'signed-out': '', 'link-sent': '' }[c.status]}
          </div>
          <div className="text-white/50">Last sync: {when(c.lastSync)}</div>
        </div>
      </div>
      {c.error && <p className="mt-2 rounded-lg bg-bad/10 p-2 text-xs text-[#ffc2c2]">{c.error}</p>}

      {c.conflict ? (
        <div className="mt-3">
          <p className="mb-2 text-sm font-semibold text-warn">This device and the cloud both have newer progress. Which save do you want to keep?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Summary title="💻 This device" s={c.conflict.local} />
            <Summary title="☁️ Cloud" s={c.conflict.remote} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button className="btn btn-blue" onClick={() => void resolveConflict('local')}>Keep this device’s save</button>
            <button className="btn btn-yellow" onClick={() => void resolveConflict('cloud')}>Use the cloud save</button>
          </div>
          <p className="mt-1 text-[11px] text-white/45">The save you don’t choose is replaced.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-green" disabled={c.status === 'syncing'} onClick={() => void uploadNow()}>☁️⬆ Save to cloud now</button>
          {!confirmDownload ? (
            <button className="btn btn-gray" disabled={c.status === 'syncing'} onClick={() => setConfirmDownload(true)}>☁️⬇ Load cloud save</button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-warn/50 p-1.5 text-xs">
              Replace this browser’s colony with the cloud save?
              <button className="btn btn-yellow px-2 py-1 text-xs" onClick={() => { setConfirmDownload(false); void downloadNow(); }}>Yes, load it</button>
              <button className="btn btn-gray px-2 py-1 text-xs" onClick={() => setConfirmDownload(false)}>Cancel</button>
            </span>
          )}
          <button className="btn btn-gray" onClick={() => void signOut()}>Sign out</button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/45">Your colony is uploaded automatically a few seconds after each save while you are signed in. Each player can only read and change their own save.</p>
    </div>
  );
}
