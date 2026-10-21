import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

// A disposable local preview: public catalog reads only; never inject a service key.
const production = {};
for (const line of (await readFile(new URL('../.env.production', import.meta.url), 'utf8')).split('\n')) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (match) production[match[1]] = match[2].replace(/^["']|["']$/g, '').replaceAll('\\n', '\n');
}
if (!production.NEXT_PUBLIC_SUPABASE_URL || !production.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Public production catalog config is missing');
const port = process.argv[2] ?? '3012';
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535) throw new Error('Invalid preview port');
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: production.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: production.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}` },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 0; });
