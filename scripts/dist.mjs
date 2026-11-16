// Builds the Windows installer and makes sure it is real.
//
// electron-builder's last NSIS step sometimes fails on Windows with "Can't open
// output file" (the freshly written .exe is briefly locked, typically by an
// antivirus scan). When that happens it leaves a ~250 KB stub with the
// installer's name, which looks like an installer but does nothing useful.
// This script removes stale output, retries, and only succeeds when a full-size
// installer exists. Run with: npm run dist
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version, productName } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const installer = resolve(root, 'dist', `${productName}-Setup-${version}.exe`)
const cli = createRequire(import.meta.url).resolve('electron-builder/cli.js')

// An Electron app is well over 50 MB; anything smaller is the stub.
const MIN_BYTES = 50 * 1024 * 1024
const ATTEMPTS = 4
const sizeOf = (file) => (existsSync(file) ? statSync(file).size : 0)
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function removeStale() {
  for (const file of [installer, `${installer}.blockmap`, installer.replace(/\.exe$/, '.__uninstaller.exe')]) {
    try {
      rmSync(file, { force: true })
    } catch {
      // Still locked: the next attempt waits and tries again.
    }
  }
}

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  removeStale()
  console.log(`\nBuilding installer (attempt ${attempt} of ${ATTEMPTS})...`)
  const run = spawnSync(process.execPath, [cli, '--win', 'nsis'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  const size = sizeOf(installer)
  if (run.status === 0 && size >= MIN_BYTES) {
    console.log(`\nInstaller ready: ${installer}\nSize: ${(size / 1024 / 1024).toFixed(1)} MB`)
    process.exit(0)
  }
  const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`
  const locked = /Can't open output file/i.test(output)
  console.log(
    locked
      ? '  The installer file was locked while it was being written (usually an antivirus scan). Retrying shortly.'
      : `  The build did not produce a full installer (exit code ${run.status}, ${size} bytes).`
  )
  if (!locked) {
    // Not the known transient problem: show what electron-builder said.
    console.log(output.split('\n').filter((l) => l.trim() && !l.includes('Command line defined')).slice(-25).join('\n'))
  }
  wait(4000 * attempt)
}

removeStale()
console.error(`\nNo installer was produced after ${ATTEMPTS} attempts. Any partial file has been removed so it cannot be mistaken for the real one.`)
console.error('Close FocusFlow if it is running from the dist folder, then run "npm run dist" again.')
process.exit(1)
