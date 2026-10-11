/** Produces IDs that satisfy `idSchema` (`[A-Za-z0-9_-]`, ≤ 64) and never repeat in a session. */
export type IdGenerator = (prefix: string) => string;

type RandomSource = (bytes: Uint8Array) => void;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function defaultRandom(): RandomSource {
  const webCrypto = (
    globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } }
  ).crypto;
  if (webCrypto?.getRandomValues) {
    const getRandomValues = webCrypto.getRandomValues.bind(webCrypto);
    return (bytes) => {
      getRandomValues(bytes);
    };
  }
  return (bytes) => {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  };
}

/** 12 base36 chars ≈ 62 bits: collisions inside one document are not a practical concern. */
export function createIdGenerator(random: RandomSource = defaultRandom()): IdGenerator {
  return (prefix) => {
    const bytes = new Uint8Array(12);
    random(bytes);
    let suffix = '';
    for (const byte of bytes) {
      suffix += ALPHABET[byte % ALPHABET.length] ?? '0';
    }
    return `${prefix}_${suffix}`;
  };
}

/** Deterministic generator for tests and fixtures. */
export function createSequentialIdGenerator(): IdGenerator {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}_${counter.toString(36).padStart(4, '0')}`;
  };
}
