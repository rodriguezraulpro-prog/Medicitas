// Utilidades de seguridad para proteger el PIN administrativo y la llave de soporte
// sin exponer contraseñas ni códigos en texto plano dentro del código fuente.

const SALT = 'mc_sec_v3_9f8a7b6c';

// Hash precalculado del PIN inicial de plantilla y de la llave maestra de soporte
export const DEFAULT_PIN_HASH = 'enc:eaca5e7d984d326d';
const MASTER_RECOVERY_HASH = 'enc:9db875ea1855263d';

export function computeSecretHash(input: string): string {
  const normalized = input.trim();
  const str = `${SALT}:${normalized}:${SALT.split('').reverse().join('')}`;
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'enc:' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function encodePinForStorage(pin: string): string {
  const clean = pin.trim();
  if (!clean) return DEFAULT_PIN_HASH;
  if (clean.startsWith('enc:')) return clean;
  return computeSecretHash(clean);
}

export function verifyAdminPin(inputPin: string, storedPinOrHash?: string): boolean {
  const cleanInput = inputPin.trim();
  if (!cleanInput) return false;

  const target = storedPinOrHash?.trim() || DEFAULT_PIN_HASH;
  const inputHash = computeSecretHash(cleanInput);

  if (target.startsWith('enc:')) {
    return inputHash === target;
  }

  // Compatibilidad si en la base de datos se guardó un valor personalizado anterior
  return cleanInput === target || inputHash === target;
}

export function verifyMasterRecoveryKey(inputKey: string): boolean {
  const cleanKey = inputKey.trim().toUpperCase();
  if (!cleanKey) return false;
  return computeSecretHash(cleanKey) === MASTER_RECOVERY_HASH;
}
