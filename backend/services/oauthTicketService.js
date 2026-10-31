// Gestor en memoria para states OAuth y tickets de intercambio de un solo uso
// Diseñado para operar con alta seguridad sin exponer datos en URLs ni requerir DDL adicional.

import crypto from 'crypto';

// Tiempos de vida (TTL)
const STATE_TTL_MS = 5 * 60 * 1000;   // 5 minutos para completar el flujo OAuth en el navegador
const TICKET_TTL_MS = 2 * 60 * 1000;  // 2 minutos para canjear el ticket por el JWT en la app

// Almacenamiento en memoria
const oauthStates = new Map();
const loginTickets = new Map();

// Limpieza periódica cada minuto para evitar acumulación de memoria
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStates.entries()) {
    if (now > val.expiresAt) oauthStates.delete(key);
  }
  for (const [key, val] of loginTickets.entries()) {
    if (now > val.expiresAt) loginTickets.delete(key);
  }
}, 60 * 1000).unref(); // unref para no bloquear pruebas ni salida de node

/**
 * Genera un state criptográfico seguro para CSRF y lo guarda asociado al proveedor
 * @param {'github'|'discord'} provider
 * @param {string} [platform='android']
 * @returns {string} state
 */
export function generateOAuthState(provider, platform = 'android') {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, {
    provider,
    platform,
    createdAt: Date.now(),
    expiresAt: Date.now() + STATE_TTL_MS
  });
  return state;
}

/**
 * Valida y consume (un solo uso) el state OAuth
 * @param {string} state
 * @param {'github'|'discord'} expectedProvider
 * @returns {{ valid: boolean, error?: string, platform?: string }}
 */
export function consumeOAuthState(state, expectedProvider) {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'STATE_MISSING' };
  }

  const record = oauthStates.get(state);
  if (!record) {
    return { valid: false, error: 'STATE_INVALID' };
  }

  // Eliminación de un solo uso inmediato
  oauthStates.delete(state);

  if (Date.now() > record.expiresAt) {
    return { valid: false, error: 'STATE_EXPIRED' };
  }

  if (record.provider !== expectedProvider) {
    return { valid: false, error: 'STATE_PROVIDER_MISMATCH' };
  }

  return { valid: true, platform: record.platform };
}

/**
 * Crea un ticket de corta duración y un solo uso que referencia el usuario autenticado
 * @param {object} user - Datos del usuario autenticado (id, role, etc)
 * @param {'github'|'discord'} provider
 * @returns {string} ticket
 */
export function createLoginTicket(user, provider) {
  const ticket = crypto.randomBytes(32).toString('hex');
  loginTickets.set(ticket, {
    user,
    provider,
    createdAt: Date.now(),
    expiresAt: Date.now() + TICKET_TTL_MS
  });
  return ticket;
}

/**
 * Consume y valida el ticket para emitir el JWT definitivo
 * @param {string} ticket
 * @returns {{ valid: boolean, error?: string, user?: object, provider?: string }}
 */
export function consumeLoginTicket(ticket) {
  if (!ticket || typeof ticket !== 'string') {
    return { valid: false, error: 'TICKET_MISSING' };
  }

  const record = loginTickets.get(ticket);
  if (!record) {
    return { valid: false, error: 'TICKET_INVALID_OR_ALREADY_USED' };
  }

  // Eliminación de un solo uso inmediato
  loginTickets.delete(ticket);

  if (Date.now() > record.expiresAt) {
    return { valid: false, error: 'TICKET_EXPIRED' };
  }

  return { valid: true, user: record.user, provider: record.provider };
}

// Helpers para testing
export function _clearStores() {
  oauthStates.clear;
  oauthStates.clear();
  loginTickets.clear();
}

