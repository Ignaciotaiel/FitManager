// funciones utilitarias de validacion

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  // validacion simple y segura de formato de correo electronico
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

export function isValidRole(role) {
  return ['admin', 'trainer', 'member'].includes(role);
}

export function isValidPassword(password) {
  // minima longitud para garantizar seguridad de contrasenas
  return typeof password === 'string' && password.length >= 6;
}
