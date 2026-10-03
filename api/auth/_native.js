import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const PIN_PATTERN = /^\d{6}$/;

export function requireConfiguration() {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RECITY_AUTH_PEPPER"];
  return required.every((name) => process.env[name]);
}

export function validatePin(pin) {
  return typeof pin === "string" && PIN_PATTERN.test(pin);
}

export async function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(`${pin}:${process.env.RECITY_AUTH_PEPPER}`, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

export async function pinMatches(pin, stored) {
  const [salt, savedHash] = String(stored || "").split(":");
  if (!salt || !savedHash) return false;
  const hash = await scrypt(`${pin}:${process.env.RECITY_AUTH_PEPPER}`, salt, 64);
  return crypto.timingSafeEqual(hash, Buffer.from(savedHash, "hex"));
}

export function internalPassword(userId) {
  return crypto.createHmac("sha256", process.env.RECITY_AUTH_PEPPER).update(`recity:${userId}`).digest("base64url");
}

export function randomRecoveryCode() {
  return crypto.randomBytes(18).toString("base64url").toUpperCase();
}

export async function supabase(path, options = {}, service = true) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(typeof body === "object" && body?.message ? body.message : `Supabase request failed (${response.status})`);
  return body;
}

export function sendSession(res, session) {
  const base = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800";
  res.setHeader("Set-Cookie", [`recity_access=${session.access_token}; ${base}`, `recity_refresh=${session.refresh_token}; ${base}`]);
}
