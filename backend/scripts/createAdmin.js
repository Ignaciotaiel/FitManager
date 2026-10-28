import readline from 'readline';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { isValidEmail, isValidPassword } from '../middlewares/validate.js';

const SALT_ROUNDS = 10;

// Utilidad para solicitar entrada en terminal ocultando la escritura para passwords
function askQuestion(query, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (!hidden) {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    } else {
      // Entrada oculta: silencia la salida de caracteres en stdout
      process.stdout.write(query);
      const stdin = process.stdin;
      const isRaw = stdin.isRaw;
      if (stdin.setRawMode) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      let password = '';
      const onData = (char) => {
        const c = char.toString('utf8');
        switch (c) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.setRawMode && stdin.setRawMode(isRaw);
            stdin.removeListener('data', onData);
            process.stdout.write('\n');
            rl.close();
            resolve(password.trim());
            break;
          case '\u0003': // Ctrl+C
            stdin.setRawMode && stdin.setRawMode(isRaw);
            stdin.removeListener('data', onData);
            process.stdout.write('\n');
            process.exit(1);
            break;
          case '\u007f':
          case '\b':
            if (password.length > 0) {
              password = password.slice(0, -1);
            }
            break;
          default:
            password += c;
            break;
        }
      };

      stdin.on('data', onData);
    }
  });
}

async function main() {
  console.log('\n======================================================');
  console.log('   FitManager — Inicializador de Administrador CLI    ');
  console.log('======================================================\n');

  let connection;
  let lockAcquired = false;

  try {
    connection = await pool.getConnection();

    // 1. Exclusión mutua a nivel de MariaDB para evitar ejecuciones concurrentes
    const [lockRes] = await connection.execute("SELECT GET_LOCK('fitmanager_admin_setup_lock', 10) AS acquired");
    if (!lockRes || lockRes[0]?.acquired !== 1) {
      console.error('❌ Error: Operación de inicialización bloqueada por otra sesión concurrente.');
      process.exit(1);
    }
    lockAcquired = true;

    // 2. Comprobar si ya existe algún administrador en la base de datos
    const [adminRows] = await connection.execute("SELECT id, name, email FROM users WHERE role = 'admin' LIMIT 1");
    if (adminRows.length > 0) {
      console.warn('⚠️  Aviso: El sistema ya cuenta con al menos un administrador configurado.');
      console.warn('Por motivos de seguridad y soberanía del sistema, este inicializador solo crea el primer administrador.\n');
      process.exit(1);
    }

    // 3. Captura interactiva y segura de datos
    const name = await askQuestion('Ingrese el nombre completo del administrador: ');
    if (!name || name.length === 0) {
      console.error('❌ Error: El nombre es obligatorio.');
      process.exit(1);
    }

    const email = await askQuestion('Ingrese el correo electrónico: ');
    if (!isValidEmail(email)) {
      console.error('❌ Error: El formato del correo electrónico no es válido.');
      process.exit(1);
    }

    const cleanEmail = email.toLowerCase();

    // Comprobar si el correo ya existe
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    if (existing.length > 0) {
      console.error('❌ Error: El correo electrónico ya se encuentra registrado.');
      process.exit(1);
    }

    const password = await askQuestion('Ingrese la contraseña (mínimo 6 caracteres): ', true);
    if (!isValidPassword(password)) {
      console.error('❌ Error: La contraseña debe tener al menos 6 caracteres.');
      process.exit(1);
    }

    const confirmPassword = await askQuestion('Confirme la contraseña: ', true);
    if (password !== confirmPassword) {
      console.error('❌ Error: Las contraseñas no coinciden.');
      process.exit(1);
    }

    // 4. Hash seguro con bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await connection.beginTransaction();

    const [insertResult] = await connection.execute(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, 'admin', 1)",
      [name, cleanEmail, passwordHash]
    );

    await connection.commit();

    console.log('\n✅ ¡Primer administrador creado exitosamente!');
    console.log(`- ID de Usuario: ${insertResult.insertId}`);
    console.log(`- Nombre: ${name}`);
    console.log(`- Correo: ${cleanEmail}`);
    console.log('- Rol: admin');
    console.log('- Estado: activo\n');
    console.log('Ya puedes iniciar sesión desde la aplicación móvil o web con estas credenciales.\n');

    process.exit(0);
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }
    console.error('\n❌ Ocurrió un error al crear el administrador:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      if (lockAcquired) {
        try {
          await connection.execute("SELECT RELEASE_LOCK('fitmanager_admin_setup_lock')");
        } catch {}
      }
      connection.release();
    }
  }
}

main();
