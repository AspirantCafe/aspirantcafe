# AspirantCafe

This project now runs as a small Node.js application with a built-in SQLite database. The original public design is retained, while the administrator area is protected by a server-side login.

## Configure an administrator

1. Copy `.env.example` to `.env`.
2. Set `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD` (at least 14 characters) in `.env`.
3. Run `node scripts/set-admin.js`.

The password is converted to a salted scrypt hash in the database; it is never stored in browser files or returned by an API. The ID may include letters, numbers, `.`, `_`, `@`, or `-`. To change the administrator ID or password, update the values in `.env` and run the same command again. This invalidates current sessions. Do not commit `.env`.

## Run and test

Run `node server.js`, then open `http://localhost:3000`. The administrator page is at `http://localhost:3000/admin`.

Run `node --test tests/*.test.js` to verify authentication protection and type-specific post validation.

## Environment variables

- `PORT` — local HTTP port (defaults to `3000`).
- `NODE_ENV` — set to `production` on a HTTPS deployment so cookies include the `Secure` flag.
- `SESSION_TTL_HOURS` — sign-in lifetime, defaulting to 12 hours.
- `DATABASE_FILE` — optional absolute path for the SQLite database.
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` — used only when running `scripts/set-admin.js`.
