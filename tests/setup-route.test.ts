import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/setup/route';

describe('Setup route configuration errors', () => {
  it('reports missing server secret separately from an incorrect submitted secret', async () => {
    const previous = {
      setupSecret: process.env.SETUP_SECRET,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    delete process.env.SETUP_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const postSetup = (setupSecret: string) =>
      POST(new NextRequest('http://localhost/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupSecret,
          harveyPassword: 'harvey-password-1',
          donnaDefaultPassword: 'donna-default-1',
        }),
      }));

    try {
      const missingSecret = await postSetup('');
      assert.equal(missingSecret.status, 503);
      assert.match((await missingSecret.json()).error, /SETUP_SECRET is not configured/);

      process.env.SETUP_SECRET = 'configured-secret';
      const incorrectSecret = await postSetup('incorrect-secret');
      assert.equal(incorrectSecret.status, 401);
      assert.equal((await incorrectSecret.json()).error, 'Invalid setup secret.');
    } finally {
      if (previous.setupSecret === undefined) delete process.env.SETUP_SECRET;
      else process.env.SETUP_SECRET = previous.setupSecret;
      if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previous.supabaseUrl;
      if (previous.supabaseServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.supabaseServiceRoleKey;
    }
  });
});
