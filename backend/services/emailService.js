import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

let resendClient = null;

/**
 * Obtiene o inicializa la instancia singleton de Resend.
 * Valida la presencia de RESEND_API_KEY sin exponer su valor.
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta RESEND_API_KEY');
    error.code = 'EMAIL_CONFIG_MISSING_API_KEY';
    throw error;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey.trim());
  }

  return resendClient;
}

/**
 * Envia un correo electronico utilizando Resend.
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Direccion(es) de correo destinatario
 * @param {string} options.subject - Asunto del correo
 * @param {string} options.html - Contenido del correo en formato HTML
 * @param {string} [options.text] - Version en texto plano opcional
 * @param {string} [options.from] - Remitente opcional (por defecto usa process.env.RESEND_FROM_EMAIL)
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function sendEmail({ to, subject, html, text, from }) {
  // Validacion de remitente
  const sender = from || process.env.RESEND_FROM_EMAIL;
  if (!sender || typeof sender !== 'string' || sender.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta RESEND_FROM_EMAIL');
    error.code = 'EMAIL_CONFIG_MISSING_FROM_EMAIL';
    throw error;
  }

  // Validacion de parametros requeridos
  if (!to) {
    const error = new Error('debes especificar al menos un destinatario');
    error.code = 'EMAIL_MISSING_RECIPIENT';
    throw error;
  }

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    const error = new Error('el asunto del correo es obligatorio');
    error.code = 'EMAIL_MISSING_SUBJECT';
    throw error;
  }

  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    const error = new Error('el contenido html del correo es obligatorio');
    error.code = 'EMAIL_MISSING_BODY';
    throw error;
  }

  const client = getResendClient();

  const recipients = Array.isArray(to) ? to : [to];

  const payload = {
    from: sender.trim(),
    to: recipients,
    subject: subject.trim(),
    html: html.trim()
  };

  if (text && typeof text === 'string') {
    payload.text = text.trim();
  }

  const response = await client.emails.send(payload);

  if (response.error) {
    const error = new Error(response.error.message || 'error al enviar correo con Resend');
    error.code = response.error.name || 'EMAIL_SEND_FAILED';
    throw error;
  }

  return {
    ok: true,
    id: response.data?.id
  };
}

export default {
  sendEmail
};
