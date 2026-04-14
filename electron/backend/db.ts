/**
 * db.ts — SQLite database layer (Phase 5)
 *
 * Handles:
 * - API key storage (AES-256 encrypted)
 * - Conversation history
 * - App settings persistence
 *
 * NOTE: better-sqlite3 requires native bindings.
 * Run `npm run rebuild` after `npm install` to compile them for Electron.
 */

// import Database from 'better-sqlite3'
// import { app } from 'electron'
// import { join } from 'path'
// import crypto from 'crypto'

// ─── Schema ────────────────────────────────────────────────────────────────────

// const SCHEMA = `
//   CREATE TABLE IF NOT EXISTS api_keys (
//     provider TEXT PRIMARY KEY,
//     encrypted_key TEXT NOT NULL,
//     created_at INTEGER DEFAULT (unixepoch())
//   );

//   CREATE TABLE IF NOT EXISTS conversations (
//     id TEXT PRIMARY KEY,
//     model TEXT NOT NULL,
//     messages TEXT NOT NULL,  -- JSON array
//     created_at INTEGER DEFAULT (unixepoch()),
//     updated_at INTEGER DEFAULT (unixepoch())
//   );

//   CREATE TABLE IF NOT EXISTS settings (
//     key TEXT PRIMARY KEY,
//     value TEXT NOT NULL
//   );
// `

// ─── Placeholder exports (activated in Phase 5) ────────────────────────────────

export function initDatabase(): void {
  console.log('[DB] Database initialization deferred to Phase 5')
}

export function getApiKey(_provider: string): string | null {
  return null
}

export function setApiKey(_provider: string, _key: string): void {
  // Phase 5
}

export function deleteApiKey(_provider: string): void {
  // Phase 5
}
