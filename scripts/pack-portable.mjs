import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  cpSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { crc32, deflateRawSync } from "node:zlib";

const root = process.cwd();
const dist = path.join(root, "dist");
const cache = path.join(dist, "cache");
const nodeVersion = process.version.startsWith("v22.") ? process.version : "v22.23.4";

const windowsRoot = "Aufmass-Windows";
const macRoot = "Aufmass-Mac";

const windowsReadme = `Aufmaß auf Windows

1. Diesen Ordner vollständig entpacken. Nicht nur die ZIP öffnen.
2. Doppelklick auf "Aufmass starten.bat".
3. Der Browser öffnet http://127.0.0.1:47291
4. Das schwarze Fenster offen lassen. Schließen oder Strg+C beendet die App.

Es ist nichts zu installieren. Kein Python und kein Git.
Node.js ist schon enthalten. Die Lizenz liegt in node\\LIZENZ-NODE.txt.

Deine Preise liegen in app\\data\\aufmass.db.
Bei einem Update diesen Ordner in das neue Paket kopieren.

Falls Windows die Startdatei blockiert: Rechtsklick, Eigenschaften, Zulassen.
`;

const macReadme = `Aufmaß auf dem Mac

1. Diesen Ordner vollständig entpacken.
2. Rechtsklick auf "Aufmass starten.command" und "Öffnen" wählen.
   macOS fragt beim ersten Mal, weil die Datei aus dem Internet kommt.
3. Der Browser öffnet http://127.0.0.1:47291
4. Das Terminal-Fenster offen lassen. Schließen beendet die App.

Es ist nichts zu installieren. Kein Python und kein Git.
Apple-Silicon und Intel sind beide enthalten. Node.js ist schon dabei,
die Lizenz liegt unter node-arm64/LIZENZ-NODE.txt.

Deine Preise liegen in app/data/aufmass.db.
Bei einem Update diesen Ordner in das neue Paket kopieren.

Falls der Start danach noch scheitert, im Terminal in diesen Ordner wechseln,
diesen Befehl ausführen und die Startdatei erneut öffnen:

xattr -dr com.apple.quarantine .
`;

const windowsBat = `@echo off
title Aufmass
cd /d "%~dp0app"
set PORT=47291
set HOSTNAME=127.0.0.1
set NODE_ENV=production
echo Aufmass startet. Dieses Fenster offen lassen.
echo Beenden mit Strg+C oder durch Schliessen des Fensters.
start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://127.0.0.1:47291"
"%~dp0node\\node.exe" server.js
echo.
echo Aufmass wurde beendet.
pause
`;

const macCommand = [
  "#!/bin/sh",
  'ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)',
  "ARCH=$(uname -m)",
  'if [ "$ARCH" = "arm64" ]; then',
  '  NODE="$ROOT/node-arm64/bin/node"',
  "else",
  '  NODE="$ROOT/node-x64/bin/node"',
  "fi",
  'if [ ! -x "$NODE" ]; then',
  '  echo "Die Node-Datei fuer $ARCH fehlt."',
  '  echo "Falls macOS den Start blockiert, im Ordner ausfuehren: xattr -dr com.apple.quarantine ."',
  "  read -r _",
  "  exit 1",
  "fi",
  'cd "$ROOT/app" || exit 1',
  "export PORT=47291",
  "export HOSTNAME=127.0.0.1",
  "export NODE_ENV=production",
  '(sleep 2 && open "http://127.0.0.1:47291") &',
  '"$NODE" server.js',
  "status=$?",
  'if [ "$status" -ne 0 ]; then',
  "  echo",
  '  echo "Aufmass wurde beendet (Code $status)."',
  "  read -r _",
  "fi",
  'exit "$status"',
  "",
].join("\n");

const runtimePackages = ["exceljs", "unpdf"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function assertTar() {
  try {
    execFileSync("tar", ["--version"], { stdio: "ignore" });
  } catch {
    fail("Das Packen braucht das Programm tar. Auf Windows 10 oder neuer ist es enthalten.");
  }
}

async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 0) return;
  console.log(`Lade ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${url}`);
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(part));
  renameSync(part, dest);
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function nodeArchive(name) {
  const file = path.join(cache, name);
  const url = `https://nodejs.org/dist/${nodeVersion}/${name}`;
  try {
    await download(url, file);
  } catch (error) {
    fail(
      error instanceof Error
        ? `${error.message}. Node ${nodeVersion} gibt es nicht für alle Systeme. Node 22 installieren und erneut packen.`
        : String(error),
    );
  }
  return file;
}

async function verifyNodeDownloads(files) {
  const sumsFile = path.join(cache, `SHASUMS256-${nodeVersion}.txt`);
  await download(`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`, sumsFile);
  const sums = new Map();
  for (const line of readFileSync(sumsFile, "utf8").split("\n")) {
    const match = /^([a-f0-9]{64})\s+\*?(\S+)/.exec(line.trim());
    if (match) sums.set(match[2], match[1]);
  }
  for (const file of files) {
    const expected = sums.get(path.basename(file));
    const actual = await sha256(file);
    if (!expected || expected !== actual) {
      rmSync(file, { force: true });
      fail(`Prüfsumme stimmt nicht: ${path.basename(file)}`);
    }
  }
}

function extractArchive(archive, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  if (archive.endsWith(".zip")) {
    try {
      execFileSync("tar", ["-xf", archive, "-C", dest], { stdio: "ignore" });
      if (readdirSync(dest).length > 0) return;
    } catch {
      // GNU tar does not read zip archives. unzip does, and Windows tar does too.
    }
    execFileSync("unzip", ["-q", archive, "-d", dest], { stdio: "inherit" });
    return;
  }
  execFileSync("tar", ["-xf", archive, "-C", dest], { stdio: "inherit" });
}

function copyApp(target) {
  const standalone = path.join(root, ".next", "standalone");
  if (!existsSync(path.join(standalone, "server.js"))) {
    fail("Der Build hat keinen server.js erzeugt.");
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  cpSync(standalone, target, { recursive: true, dereference: true });
  cpSync(path.join(root, ".next", "static"), path.join(target, ".next", "static"), {
    recursive: true,
    dereference: true,
  });
  if (existsSync(path.join(root, "public"))) {
    cpSync(path.join(root, "public"), path.join(target, "public"), { recursive: true, dereference: true });
  }
  cpSync(path.join(root, "examples"), path.join(target, "examples"), { recursive: true, dereference: true });
  rmSync(path.join(target, "data"), { recursive: true, force: true });
  mkdirSync(path.join(target, "data"), { recursive: true });
  ensureRuntimePackages(target);
}

function copyPackageTree(name, destModules, seen) {
  if (seen.has(name)) return;
  seen.add(name);
  const src = resolvePackageDir(name);
  if (!src) {
    console.warn(`Paket fehlt und wird nicht kopiert: ${name}`);
    return;
  }
  const dest = path.join(destModules, name);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: true });
  const pkgPath = path.join(src, "package.json");
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  for (const dep of Object.keys(pkg.dependencies ?? {})) copyPackageTree(dep, destModules, seen);
}

function resolvePackageDir(name) {
  const hoisted = path.join(root, "node_modules", name);
  if (existsSync(path.join(hoisted, "package.json"))) return hoisted;
  const matches = [];
  function scan(dir, depth) {
    if (depth > 4 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === ".bin" || entry.startsWith(".")) continue;
      const abs = path.join(dir, entry);
      if (entry.startsWith("@")) {
        scan(abs, depth);
        continue;
      }
      if (name === entry && existsSync(path.join(abs, "package.json"))) matches.push(abs);
      const nested = path.join(abs, "node_modules");
      if (existsSync(nested)) scan(nested, depth + 1);
    }
  }
  scan(path.join(root, "node_modules"), 0);
  return matches[0] ?? null;
}

function ensureRuntimePackages(appDir) {
  const destModules = path.join(appDir, "node_modules");
  mkdirSync(destModules, { recursive: true });
  const seen = new Set();
  for (const name of runtimePackages) copyPackageTree(name, destModules, seen);
}

function writeText(file, contents, newline) {
  const text = newline === "crlf" ? contents.replace(/\n/g, "\r\n") : contents;
  writeFileSync(file, text);
}

function dosTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function unixMode(rel) {
  const base = path.posix.basename(rel);
  if (rel.endsWith("/") || base === "node" || rel.endsWith(".command")) return 0o100755;
  return 0o100644;
}

function listFiles(dir, prefix) {
  const items = [];
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = `${prefix}/${name}`;
    const info = statSync(abs);
    if (info.isDirectory()) {
      const nested = listFiles(abs, rel);
      if (nested.length === 0) items.push({ rel: `${rel}/`, dir: true, abs });
      else items.push(...nested);
    } else if (info.isFile()) {
      items.push({ rel, dir: false, abs });
    }
  }
  return items;
}

function writeZip(folder, zipPath, rootName) {
  const items = listFiles(folder, rootName);
  const fd = openSync(zipPath, "w");
  let offset = 0;
  const central = [];
  const now = dosTime(new Date());

  function emit(buffer) {
    writeSync(fd, buffer);
    offset += buffer.length;
  }

  for (const item of items) {
    const name = Buffer.from(item.rel, "utf8");
    const body = item.dir ? Buffer.alloc(0) : readFileSync(item.abs);
    const method = item.dir || body.length === 0 ? 0 : 8;
    const compressed = method === 8 ? deflateRawSync(body, { level: 1 }) : body;
    const checksum = item.dir ? 0 : crc32(body) >>> 0;
    const mode = item.dir ? 0o040755 : unixMode(item.rel);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const localOffset = offset;
    emit(local);
    emit(name);
    emit(compressed);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(0x0314, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(now.time, 12);
    header.writeUInt16LE(now.date, 14);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(body.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE((mode * 0x10000) >>> 0, 38);
    header.writeUInt32LE(localOffset, 42);
    central.push(Buffer.concat([header, name]));
  }

  const centralOffset = offset;
  for (const part of central) emit(part);
  const centralSize = offset - centralOffset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  emit(end);
  closeSync(fd);
}

function requireNodeBinary(file, label) {
  if (!existsSync(file)) fail(`${label} wurde nicht gefunden: ${file}`);
}

async function main() {
  assertTar();
  if (!process.version.startsWith("v22.")) {
    fail(`Packen braucht Node 22, gefunden wurde ${process.version}.`);
  }
  mkdirSync(cache, { recursive: true });
  console.log(`Node für die Pakete: ${nodeVersion}`);

  const winName = `node-${nodeVersion}-win-x64.zip`;
  const armName = `node-${nodeVersion}-darwin-arm64.tar.gz`;
  const intelName = `node-${nodeVersion}-darwin-x64.tar.gz`;
  const archives = await Promise.all([winName, armName, intelName].map((name) => nodeArchive(name)));
  await verifyNodeDownloads(archives);
  const [winArchive, armArchive, intelArchive] = archives;

  if (process.env.AUFMASS_SKIP_BUILD === "1" && existsSync(path.join(root, ".next", "standalone", "server.js"))) {
    console.log("Vorhandenen Build verwenden.");
  } else {
    console.log("Baue die App…");
    execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  }

  const winDir = path.join(dist, windowsRoot);
  const macDir = path.join(dist, macRoot);
  rmSync(winDir, { recursive: true, force: true });
  rmSync(macDir, { recursive: true, force: true });
  copyApp(path.join(winDir, "app"));
  cpSync(path.join(winDir, "app"), path.join(macDir, "app"), { recursive: true, dereference: true });

  const extracted = path.join(cache, "extracted");
  extractArchive(winArchive, path.join(extracted, "win"));
  extractArchive(armArchive, path.join(extracted, "arm"));
  extractArchive(intelArchive, path.join(extracted, "intel"));

  const winNode = path.join(extracted, "win", `node-${nodeVersion}-win-x64`, "node.exe");
  const armNode = path.join(extracted, "arm", `node-${nodeVersion}-darwin-arm64`, "bin", "node");
  const intelNode = path.join(extracted, "intel", `node-${nodeVersion}-darwin-x64`, "bin", "node");
  requireNodeBinary(winNode, "Windows-Node");
  requireNodeBinary(armNode, "Mac-Node (Apple-Silicon)");
  requireNodeBinary(intelNode, "Mac-Node (Intel)");

  mkdirSync(path.join(winDir, "node"), { recursive: true });
  mkdirSync(path.join(macDir, "node-arm64", "bin"), { recursive: true });
  mkdirSync(path.join(macDir, "node-x64", "bin"), { recursive: true });
  cpSync(winNode, path.join(winDir, "node", "node.exe"));
  cpSync(armNode, path.join(macDir, "node-arm64", "bin", "node"));
  cpSync(intelNode, path.join(macDir, "node-x64", "bin", "node"));
  cpSync(path.join(path.dirname(winNode), "LICENSE"), path.join(winDir, "node", "LIZENZ-NODE.txt"));
  cpSync(path.join(extracted, "arm", `node-${nodeVersion}-darwin-arm64`, "LICENSE"), path.join(macDir, "node-arm64", "LIZENZ-NODE.txt"));
  cpSync(path.join(extracted, "intel", `node-${nodeVersion}-darwin-x64`, "LICENSE"), path.join(macDir, "node-x64", "LIZENZ-NODE.txt"));

  writeText(path.join(winDir, "Aufmass starten.bat"), windowsBat, "crlf");
  writeText(path.join(winDir, "LIESMICH.txt"), `\uFEFF${windowsReadme}`, "crlf");
  writeText(path.join(macDir, "Aufmass starten.command"), macCommand, "lf");
  writeText(path.join(macDir, "LIESMICH.txt"), `\uFEFF${macReadme}`, "lf");

  const winZip = path.join(dist, `${windowsRoot}.zip`);
  const macZip = path.join(dist, `${macRoot}.zip`);
  console.log("Packe Windows…");
  writeZip(winDir, winZip, windowsRoot);
  console.log("Packe Mac…");
  writeZip(macDir, macZip, macRoot);
  console.log(`Fertig:\n${winZip}\n${macZip}`);
}

await main();
