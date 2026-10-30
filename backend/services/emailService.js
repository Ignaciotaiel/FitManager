import dotenv from 'dotenv';

dotenv.config();

/**
 * Valida la configuracion de Google Apps Script sin exponer secretos.
 */
function getGasConfig() {
  const url = process.env.GAS_EMAIL_URL;
  const secretKey = process.env.GAS_SECRET_KEY;

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta GAS_EMAIL_URL');
    error.code = 'EMAIL_CONFIG_MISSING_URL';
    throw error;
  }

  if (!secretKey || typeof secretKey !== 'string' || secretKey.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta GAS_SECRET_KEY');
    error.code = 'EMAIL_CONFIG_MISSING_KEY';
    throw error;
  }

  return {
    url: url.trim(),
    secretKey: secretKey.trim()
  };
}

/**
 * Envia un correo electronico utilizando Google Apps Script Web App mediante HTTPS.
 * Mantiene la firma publica: sendEmail({ to, subject, html, text, from })
 * y el formato de respuesta: { ok: true, id }
 *
 * @param {Object} options
 * @param {string} options.to - Direccion de correo destinatario (debe ser string unico)
 * @param {string} options.subject - Asunto del correo
 * @param {string} options.html - Contenido del correo en formato HTML
 * @param {string} [options.text] - Version en texto plano opcional
 * @param {string} [options.from] - Remitente opcional (informativo)
 * @returns {Promise<{ ok: boolean, id: string }>}
 */
export async function sendEmail({ to, subject, html, text, from }) {
  const { url, secretKey } = getGasConfig();

  // Validacion estricta: to debe ser obligatoriamente un string (no se aceptan arrays)
  if (Array.isArray(to)) {
    const error = new Error('el destinatario debe ser una unica direccion de correo en formato string');
    error.code = 'EMAIL_INVALID_RECIPIENT_FORMAT';
    throw error;
  }

  if (!to || typeof to !== 'string' || to.trim().length === 0) {
    const error = new Error('debes especificar un destinatario valido');
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

  const payload = {
    secretKey,
    to: to.trim(),
    subject: subject.trim(),
    html: html.trim()
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = new Error('fallo en la comunicacion con el servicio de correo');
      error.code = `HTTP_${response.status}`;
      throw error;
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      const error = new Error('respuesta invalida del servicio de correo');
      error.code = 'EMAIL_GAS_INVALID_JSON';
      throw error;
    }

    // Comprobacion explicita del estado de exito del JSON devuelto por Google Apps Script
    if (!data || data.ok !== true) {
      const errorCode = data?.error ? `EMAIL_GAS_${data.error}` : 'EMAIL_SEND_FAILED';
      const error = new Error('el servicio de correo no pudo procesar la solicitud');
      error.code = errorCode;
      throw error;
    }

    if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
      const error = new Error('respuesta del servicio de correo sin identificador de entrega');
      error.code = 'EMAIL_SEND_NO_MESSAGE_ID';
      throw error;
    }

    return {
      ok: true,
      id: data.id.trim()
    };
  } catch (err) {
    if (err.code && err.code.startsWith('EMAIL_')) {
      throw err;
    }

    if (err.name === 'TimeoutError') {
      const error = new Error('tiempo de espera agotado al conectar con el servicio de correo');
      error.code = 'EMAIL_TIMEOUT';
      throw error;
    }

    const safeError = new Error('no fue posible enviar el correo electronico a traves de Google Apps Script');
    safeError.code = err.code || 'EMAIL_SEND_FAILED';
    throw safeError;
  }
}

export default {
  sendEmail
};
