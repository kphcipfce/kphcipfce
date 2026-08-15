import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import mongoose from "mongoose";

function checkPort(host, port, timeout = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, host);
  });
}

// Dev convenience: if MONGO_URI points at localhost and nothing is listening there yet,
// launch a local mongod instead of requiring it to be started separately (or as an
// admin-only Windows service). No-op against a remote/hosted MongoDB.
async function ensureLocalMongod() {
  // A multi-host replica-set string (Atlas etc.) has commas in the authority section,
  // which isn't valid URL syntax — that's fine, it's never a localhost target anyway.
  let hostname, port;
  try {
    ({ hostname, port } = new URL(process.env.MONGO_URI.replace("mongodb://", "http://")));
  } catch {
    return;
  }
  const host = hostname;
  const mongoPort = Number(port || 27017);
  if (!["localhost", "127.0.0.1"].includes(host)) return;
  if (await checkPort(host, mongoPort)) return;

  const dbPath = process.env.MONGO_DBPATH || path.join(process.cwd(), ".mongo-data");
  fs.mkdirSync(dbPath, { recursive: true });
  const logPath = path.join(dbPath, "mongod.log");

  console.log(`No MongoDB found at ${host}:${mongoPort} — starting local mongod (dbpath: ${dbPath})`);
  const child = spawn(
    "mongod",
    ["--dbpath", dbPath, "--logpath", logPath, "--port", String(mongoPort), "--bind_ip", host],
    { detached: true, stdio: "ignore" }
  );
  child.unref();

  for (let i = 0; i < 30; i++) {
    if (await checkPort(host, mongoPort)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for local mongod to start on ${host}:${mongoPort}. Is mongod installed and on PATH?`);
}

export async function connectDB() {
  await ensureLocalMongod();
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected:", mongoose.connection.name);
}
