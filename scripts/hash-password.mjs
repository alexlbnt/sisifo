// Gera o hash da senha do Sísifo e um SESSION_SECRET novo.
// Uso: npm run hash-password -- "minha senha"   (ou rode sem argumento para digitar)
import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 2 ** 15;
const r = 8;
const p = 1;

let password = process.argv[2];
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Senha do Sísifo: ');
  rl.close();
}
if (!password || password.length < 4) {
  console.error('Use uma senha com pelo menos 4 caracteres.');
  process.exit(1);
}
if (password.length < 10) {
  console.warn(
    '\nAtenção: senhas curtas (como um PIN) são fáceis de adivinhar por quem testa a partir de vários IPs.' +
      '\nO limite de tentativas ajuda, mas uma frase longa protege muito mais.',
  );
}

const salt = randomBytes(16);
const hash = await scryptAsync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
const value = ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join(':');

console.log('\nCadastre na Vercel (Settings → Environment Variables) e no .env.local:\n');
console.log(`SISIFO_PASSWORD_HASH=${value}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
console.log('\nA senha em si não é guardada em lugar nenhum. Guarde-a com você.');
