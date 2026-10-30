import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let mailTransporter = null;

/**
 * Obtiene o inicializa la instancia singleton del transportador Nodemailer con Gmail SMTP.
 * Valida la presencia de SMTP_USER y SMTP_PASS sin exponer sus valores.
 */
function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || typeof user !== 'string' || user.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta SMTP_USER');
    error.code = 'EMAIL_CONFIG_MISSING_USER';
    throw error;
  }

  if (!pass || typeof pass !== 'string' || pass.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta SMTP_PASS');
    error.code = 'EMAIL_CONFIG_MISSING_PASS';
    throw error;
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL en puerto 465
      auth: {
        user: user.trim(),
        pass: pass.trim()
      }
    });
  }

  return mailTransporter;
}

/**
 * Envia un correo electronico utilizando Gmail SMTP a traves de Nodemailer.
 * Mantiene exactamente la firma publica: sendEmail({ to, subject, html, text, from })
 * y el formato de respuesta: { ok: true, id: messageId }
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Direccion(es) de correo destinatario
 * @param {string} options.subject - Asunto del correo
 * @param {string} options.html - Contenido del correo en formato HTML
 * @param {string} [options.text] - Version en texto plano opcional
 * @param {string} [options.from] - Remitente opcional (por defecto usa process.env.SMTP_FROM_EMAIL)
 * @returns {Promise<{ ok: boolean, id?: string }>}
 */
export async function sendEmail({ to, subject, html, text, from }) {
  // Validacion de remitente predeterminado
  const sender = from || process.env.SMTP_FROM_EMAIL;
  if (!sender || typeof sender !== 'string' || sender.trim().length === 0) {
    const error = new Error('el servicio de correo no esta configurado: falta SMTP_FROM_EMAIL');
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

  const transporter = getTransporter();
  const recipientList = Array.isArray(to) ? to.join(', ') : to;

  const mailOptions = {
    from: sender.trim(),
    to: recipientList,
    subject: subject.trim(),
    html: html.trim()
  };

  if (text && typeof text === 'string' && text.trim().length > 0) {
    mailOptions.text = text.trim();
  }

  try {
    const info = await transporter.sendMail(mailOptions);

    if (!info || !info.messageId || typeof info.messageId !== 'string' || info.messageId.trim().length === 0) {
      const error = new Error('no fue posible confirmar la entrega del correo: respuesta de servidor de correo sin identificador');
      error.code = 'EMAIL_SEND_NO_MESSAGE_ID';
      throw error;
    }

    return {
      ok: true,
      id: info.messageId.trim()
    };
  } catch (err) {
    if (err.code === 'EMAIL_SEND_NO_MESSAGE_ID') {
      throw err;
    }
    // Manejo seguro de errores sin exponer contrasenas ni secretos de configuracion
    const safeError = new Error('no fue posible enviar el correo electronico a traves de Gmail SMTP');
    safeError.code = err.code || 'EMAIL_SEND_FAILED';
    throw safeError;
  }
}

export default {
  sendEmail
};
