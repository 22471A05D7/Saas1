import bcrypt from 'bcryptjs';
import { env } from './env';

/**
 * Password hashing.
 *
 * Uses the bcrypt algorithm via `bcryptjs` (a pure-JS implementation that
 * produces and verifies standard `$2a$`/`$2b$` bcrypt hashes, so it needs no
 * native toolchain to install). Plaintext passwords are never stored or logged.
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
