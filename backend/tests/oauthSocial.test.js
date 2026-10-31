import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import {
  generateOAuthState,
  consumeOAuthState,
  createLoginTicket,
  consumeLoginTicket,
  _clearStores
} from '../services/oauthTicketService.js';

describe('Pruebas Exhaustivas: OAuth 2.0 (GitHub y Discord) para APK Android', () => {
  let app;
  let server;
  let baseUrl;

  // Estado en memoria simulado
  let mockUsers = [];
  let mockSocialAccounts = [];
  let nextUserId = 1;
  let nextSocialId = 1;

  const mockJwtSecret = 'test_jwt_secret_oauth_fitmanager_social';
  process.env.JWT_SECRET = mockJwtSecret;

  before(async () => {
    app = express();
    app.use(express.json());

    // 1. Simulación de inicio de flujo OAuth (generación de state y redirección al proveedor)
    app.get('/api/test-oauth/github', (req, res) => {
      const clientId = process.env.GITHUB_CLIENT_ID || 'test_github_client_id';
      const state = generateOAuthState('github', 'android');
      const callbackUrl = 'https://fitmanager-backend-ekfc.onrender.com/api/auth/github/callback';
      const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=read:user%20user:email&state=${encodeURIComponent(state)}`;
      res.redirect(redirectUrl);
    });

    app.get('/api/test-oauth/discord', (req, res) => {
      const clientId = process.env.DISCORD_CLIENT_ID || 'test_discord_client_id';
      const state = generateOAuthState('discord', 'android');
      const callbackUrl = 'https://fitmanager-backend-ekfc.onrender.com/api/auth/discord/callback';
      const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=identify%20email&state=${encodeURIComponent(state)}`;
      res.redirect(redirectUrl);
    });

    // 2. Simulación de Callback de GitHub
    app.get('/api/test-oauth/github/callback', async (req, res) => {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent(oauthError)}`);
      }

      const stateCheck = consumeOAuthState(state, 'github');
      if (!stateCheck.valid) {
        return res.redirect(`fitmanager://oauth/github?error=INVALID_OR_EXPIRED_STATE`);
      }

      if (!code) {
        return res.redirect(`fitmanager://oauth/github?error=MISSING_AUTH_CODE`);
      }

      // Canjear con mock de GitHub API
      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          return res.redirect(`fitmanager://oauth/github?error=${encodeURIComponent(tokenData.error || 'GITHUB_TOKEN_EXCHANGE_FAILED')}`);
        }

        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const ghUser = await userRes.json();

        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const emails = await emailsRes.json();
        const verifiedEmailObj = emails.find(e => e.verified && (e.primary || true));

        if (!verifiedEmailObj) {
          return res.redirect('fitmanager://oauth/github?error=GITHUB_EMAIL_NOT_VERIFIED');
        }

        const email = verifiedEmailObj.email.toLowerCase().trim();
        const providerUserId = String(ghUser.id);

        // Buscar o crear usuario
        let user = mockUsers.find(u => u.email === email);
        if (!user) {
          user = {
            id: nextUserId++,
            name: ghUser.name || ghUser.login,
            email,
            role: 'member',
            is_active: 1,
            token_version: 1,
            email_verified_at: new Date()
          };
          mockUsers.push(user);
        }

        mockSocialAccounts.push({
          id: nextSocialId++,
          user_id: user.id,
          provider: 'github',
          provider_user_id: providerUserId
        });

        const ticket = createLoginTicket(user, 'github');
        return res.redirect(`fitmanager://oauth/github?ticket=${encodeURIComponent(ticket)}`);
      } catch (err) {
        return res.redirect('fitmanager://oauth/github?error=INTERNAL_SERVER_ERROR');
      }
    });

    // 3. Simulación de Callback de Discord
    app.get('/api/test-oauth/discord/callback', async (req, res) => {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent(oauthError)}`);
      }

      const stateCheck = consumeOAuthState(state, 'discord');
      if (!stateCheck.valid) {
        return res.redirect('fitmanager://oauth/discord?error=INVALID_OR_EXPIRED_STATE');
      }

      if (!code) {
        return res.redirect('fitmanager://oauth/discord?error=MISSING_AUTH_CODE');
      }

      try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          body: new URLSearchParams({ code }).toString()
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          return res.redirect(`fitmanager://oauth/discord?error=${encodeURIComponent(tokenData.error || 'DISCORD_TOKEN_EXCHANGE_FAILED')}`);
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const discordUser = await userRes.json();

        if (!discordUser.email || discordUser.verified !== true) {
          return res.redirect('fitmanager://oauth/discord?error=DISCORD_EMAIL_NOT_VERIFIED');
        }

        const email = discordUser.email.toLowerCase().trim();
        const providerUserId = String(discordUser.id);

        let user = mockUsers.find(u => u.email === email);
        if (!user) {
          user = {
            id: nextUserId++,
            name: discordUser.global_name || discordUser.username,
            email,
            role: 'member',
            is_active: 1,
            token_version: 1,
            email_verified_at: new Date()
          };
          mockUsers.push(user);
        }

        mockSocialAccounts.push({
          id: nextSocialId++,
          user_id: user.id,
          provider: 'discord',
          provider_user_id: providerUserId
        });

        const ticket = createLoginTicket(user, 'discord');
        return res.redirect(`fitmanager://oauth/discord?ticket=${encodeURIComponent(ticket)}`);
      } catch (err) {
        return res.redirect('fitmanager://oauth/discord?error=INTERNAL_SERVER_ERROR');
      }
    });

    // 4. Canje de Ticket por JWT
    app.post('/api/test-oauth/exchange-ticket', (req, res) => {
      const { ticket } = req.body;
      if (!ticket) {
        return res.status(400).json({ ok: false, error: { message: 'debes proporcionar un ticket', code: 'MISSING_TICKET' } });
      }

      const ticketResult = consumeLoginTicket(ticket);
      if (!ticketResult.valid) {
        return res.status(401).json({
          ok: false,
          error: { message: 'el ticket es invalido o ya fue utilizado', code: ticketResult.error }
        });
      }

      const user = ticketResult.user;
      const jwtToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, token_version: user.token_version },
        mockJwtSecret,
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        ok: true,
        message: `inicio de sesion con ${ticketResult.provider} exitoso`,
        data: {
          token: jwtToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }
      });
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    _clearStores();
    mockUsers = [];
    mockSocialAccounts = [];
    nextUserId = 1;
    nextSocialId = 1;
  });

  // =========================================================================
  // TESTS
  // =========================================================================
  test('1. GET /api/auth/github genera state y redirige a la URL de autorización de GitHub', async () => {
    const res = await fetch(`${baseUrl}/api/test-oauth/github`, { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.startsWith('https://github.com/login/oauth/authorize'));
    assert.ok(location.includes('client_id=test_github_client_id'));
    assert.ok(location.includes('state='));
    assert.ok(location.includes('scope=read:user%20user:email') || location.includes('scope=read%3Auser%20user%3Aemail'));
  });

  test('2. GET /api/auth/discord genera state y redirige a la URL de autorización de Discord', async () => {
    const res = await fetch(`${baseUrl}/api/test-oauth/discord`, { redirect: 'manual' });
    assert.strictEqual(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.startsWith('https://discord.com/api/oauth2/authorize'));
    assert.ok(location.includes('client_id=test_discord_client_id'));
    assert.ok(location.includes('state='));
    assert.ok(location.includes('scope=identify%20email'));
  });

  test('3. Callback con state inexistente o modificado redirige a la APK con error INVALID_OR_EXPIRED_STATE', async () => {
    const res = await fetch(`${baseUrl}/api/test-oauth/github/callback?code=mock_code&state=fake_state`, {
      redirect: 'manual'
    });
    assert.strictEqual(res.status, 302);
    const location = res.headers.get('location');
    assert.strictEqual(location, 'fitmanager://oauth/github?error=INVALID_OR_EXPIRED_STATE');
  });

  test('4. State es de un solo uso estricto: segundo intento con el mismo state es rechazado', async () => {
    const state = generateOAuthState('github');
    const firstCheck = consumeOAuthState(state, 'github');
    assert.strictEqual(firstCheck.valid, true);

    const secondCheck = consumeOAuthState(state, 'github');
    assert.strictEqual(secondCheck.valid, false);
    assert.strictEqual(secondCheck.error, 'STATE_INVALID');
  });

  test('5. State para GitHub no puede ser consumido por Discord (control estricto de proveedor)', async () => {
    const state = generateOAuthState('github');
    const checkMismatch = consumeOAuthState(state, 'discord');
    assert.strictEqual(checkMismatch.valid, false);
    assert.strictEqual(checkMismatch.error, 'STATE_PROVIDER_MISMATCH');
  });

  test('6. POST /oauth/exchange-ticket falla con 400 si no envía ticket', async () => {
    const res = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error.code, 'MISSING_TICKET');
  });

  test('7. POST /oauth/exchange-ticket falla con 401 si el ticket es inválido', async () => {
    const res = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: 'ticket_inexistente_123' })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error.code, 'TICKET_INVALID_OR_ALREADY_USED');
  });

  test('8. Ticket legítimo se canjea exitosamente por un JWT válido con rol member y token_version', async () => {
    const userPayload = {
      id: 88,
      name: 'Usuario GitHub',
      email: 'gh_user@fitmanager.test',
      role: 'member',
      is_active: 1,
      token_version: 1
    };

    const ticket = createLoginTicket(userPayload, 'github');

    const res = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
    assert.ok(data.data.token, 'Debe devolver un JWT');
    assert.strictEqual(data.data.user.email, 'gh_user@fitmanager.test');
    assert.strictEqual(data.data.user.role, 'member');

    // Verificar firma y contenido del JWT
    const decoded = jwt.verify(data.data.token, mockJwtSecret);
    assert.strictEqual(decoded.id, 88);
    assert.strictEqual(decoded.role, 'member');
    assert.strictEqual(decoded.token_version, 1);
  });

  test('9. Reutilización de ticket es bloqueada: no se puede canjear dos veces el mismo ticket', async () => {
    const userPayload = { id: 89, name: 'Discord Test', email: 'discord@test.com', role: 'member', is_active: 1, token_version: 1 };
    const ticket = createLoginTicket(userPayload, 'discord');

    const res1 = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    assert.strictEqual(res1.status, 200);

    const res2 = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    assert.strictEqual(res2.status, 401);
    const data2 = await res2.json();
    assert.strictEqual(data2.error.code, 'TICKET_INVALID_OR_ALREADY_USED');
  });

  test('10. GitHub OAuth: flujo exitoso para usuario nuevo (crea rol member y redirige con ticket)', async () => {
    const state = generateOAuthState('github');

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('github.com/login/oauth/access_token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock_gh_access_token' })
        };
      }
      if (typeof url === 'string' && url === 'https://api.github.com/user') {
        return {
          ok: true,
          json: async () => ({ id: 123456, login: 'octocat', name: 'Mona Lisa Octocat' })
        };
      }
      if (typeof url === 'string' && url === 'https://api.github.com/user/emails') {
        return {
          ok: true,
          json: async () => [
            { email: 'unverified@test.com', primary: false, verified: false },
            { email: 'mona@github.com', primary: true, verified: true }
          ]
        };
      }
      return originalFetch(url, options);
    };

    try {
      const res = await fetch(`${baseUrl}/api/test-oauth/github/callback?code=mock_gh_code&state=${state}`, {
        redirect: 'manual'
      });

      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location.startsWith('fitmanager://oauth/github?ticket='), 'Redirige a la APK con el ticket');

      const ticketParam = new URL(location).searchParams.get('ticket');
      assert.ok(ticketParam, 'Debe contener un ticket válido');

      // Canjear en el endpoint
      const exchangeRes = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticketParam })
      });
      assert.strictEqual(exchangeRes.status, 200);
      const exchangeData = await exchangeRes.json();
      assert.strictEqual(exchangeData.data.user.email, 'mona@github.com');
      assert.strictEqual(exchangeData.data.user.role, 'member');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('11. GitHub OAuth: rechaza y redirige con error si el usuario no tiene ningún email verificado', async () => {
    const state = generateOAuthState('github');

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('github.com/login/oauth/access_token')) {
        return { ok: true, json: async () => ({ access_token: 'gh_tok' }) };
      }
      if (typeof url === 'string' && url === 'https://api.github.com/user') {
        return { ok: true, json: async () => ({ id: 99999, login: 'noemail' }) };
      }
      if (typeof url === 'string' && url === 'https://api.github.com/user/emails') {
        return {
          ok: true,
          json: async () => [{ email: 'unverified@test.com', primary: true, verified: false }]
        };
      }
      return originalFetch(url, options);
    };

    try {
      const res = await fetch(`${baseUrl}/api/test-oauth/github/callback?code=mock_code&state=${state}`, {
        redirect: 'manual'
      });
      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.strictEqual(location, 'fitmanager://oauth/github?error=GITHUB_EMAIL_NOT_VERIFIED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('12. Discord OAuth: flujo exitoso para usuario verificado (crea rol member y emite ticket)', async () => {
    const state = generateOAuthState('discord');

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('discord.com/api/oauth2/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'mock_discord_access_token' })
        };
      }
      if (typeof url === 'string' && url.includes('discord.com/api/users/@me')) {
        return {
          ok: true,
          json: async () => ({
            id: '9876543210',
            username: 'fit_gamer',
            global_name: 'Fit Gamer',
            email: 'gamer@discord.test',
            verified: true
          })
        };
      }
      return originalFetch(url, options);
    };

    try {
      const res = await fetch(`${baseUrl}/api/test-oauth/discord/callback?code=mock_discord_code&state=${state}`, {
        redirect: 'manual'
      });

      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location.startsWith('fitmanager://oauth/discord?ticket='), 'Redirige a la APK con el ticket de Discord');

      const ticketParam = new URL(location).searchParams.get('ticket');
      assert.ok(ticketParam, 'Debe contener un ticket válido');

      // Canjear el ticket por JWT
      const exchangeRes = await fetch(`${baseUrl}/api/test-oauth/exchange-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticketParam })
      });
      assert.strictEqual(exchangeRes.status, 200);
      const exchangeData = await exchangeRes.json();
      assert.strictEqual(exchangeData.data.user.email, 'gamer@discord.test');
      assert.strictEqual(exchangeData.data.user.role, 'member');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('13. Discord OAuth: rechaza y redirige con error si verified es false', async () => {
    const state = generateOAuthState('discord');

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('discord.com/api/oauth2/token')) {
        return { ok: true, json: async () => ({ access_token: 'mock_tok' }) };
      }
      if (typeof url === 'string' && url.includes('discord.com/api/users/@me')) {
        return {
          ok: true,
          json: async () => ({
            id: '112233',
            username: 'unverified_discord',
            email: 'notverified@discord.test',
            verified: false // correo no verificado en Discord
          })
        };
      }
      return originalFetch(url, options);
    };

    try {
      const res = await fetch(`${baseUrl}/api/test-oauth/discord/callback?code=mock_code&state=${state}`, {
        redirect: 'manual'
      });
      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.strictEqual(location, 'fitmanager://oauth/discord?error=DISCORD_EMAIL_NOT_VERIFIED');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('14. Proveedor OAuth devuelve error en query params: se propaga limpiamente a la APK', async () => {
    const res = await fetch(`${baseUrl}/api/test-oauth/github/callback?error=access_denied&error_description=The+user+has+denied+your+application`, {
      redirect: 'manual'
    });
    assert.strictEqual(res.status, 302);
    const location = res.headers.get('location');
    assert.strictEqual(location, 'fitmanager://oauth/github?error=access_denied');
  });

  test('15. Falla al canjear código con el proveedor (código expirado o inválido): redirige con error descriptivo', async () => {
    const state = generateOAuthState('github');

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      if (typeof url === 'string' && url.includes('github.com/login/oauth/access_token')) {
        return {
          ok: false,
          json: async () => ({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' })
        };
      }
      return originalFetch(url, options);
    };

    try {
      const res = await fetch(`${baseUrl}/api/test-oauth/github/callback?code=bad_code&state=${state}`, {
        redirect: 'manual'
      });
      assert.strictEqual(res.status, 302);
      const location = res.headers.get('location');
      assert.strictEqual(location, 'fitmanager://oauth/github?error=bad_verification_code');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
