// Gera o par de chaves VAPID das notificações push.
// Uso: npm run vapid   → cole as linhas em .env.local e na Vercel (Settings → Environment Variables).
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:seu-email@exemplo.com');
console.log('\nGuarde a chave privada em segredo. Trocar as chaves exige ativar as notificações de novo em cada aparelho.');
