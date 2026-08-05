// Autenticação por segurança nativa do aparelho (biometria / reconhecimento facial).
// Estratégia:
//  - Android/iOS nativo (Capacitor): usa o plugin de biometria, se disponível.
//  - Web / PWA: usa WebAuthn com autenticador de plataforma (Touch ID, Face ID,
//    leitor de digital do Windows Hello / Android).

const CRED_PREFIX = "biometric_cred_";
const ENABLED_PREFIX = "biometric_enabled_";

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function nativePlugin(): Promise<any | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform?.()) return null;
    const spec = "@capgo/capacitor-native-biometric";
    const mod: any = await import(/* @vite-ignore */ spec).catch(() => null);
    return mod?.NativeBiometric ?? null;
  } catch {
    return null;
  }
}

/** O aparelho oferece biometria / reconhecimento facial? */
export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = await nativePlugin();
  if (plugin) {
    try {
      const res = await plugin.isAvailable();
      return !!res?.isAvailable;
    } catch {
      return false;
    }
  }
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled(userId: string) {
  return localStorage.getItem(ENABLED_PREFIX + userId) === "1";
}

export function disableBiometric(userId: string) {
  localStorage.removeItem(ENABLED_PREFIX + userId);
  localStorage.removeItem(CRED_PREFIX + userId);
}

/** Cadastra a biometria do aparelho para este usuário. */
export async function enrollBiometric(userId: string, label: string): Promise<void> {
  const plugin = await nativePlugin();
  if (plugin) {
    await plugin.verifyIdentity({
      reason: "Confirme sua identidade para ativar o desbloqueio biométrico",
      title: "Desbloqueio biométrico",
      subtitle: label,
    });
    localStorage.setItem(ENABLED_PREFIX + userId, "1");
    return;
  }

  if (!window.PublicKeyCredential) throw new Error("Este dispositivo não suporta biometria.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "automadm", id: window.location.hostname },
      user: {
        id: Uint8Array.from(userId.slice(0, 32), (c) => c.charCodeAt(0)),
        name: label,
        displayName: label,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Cadastro biométrico cancelado.");
  localStorage.setItem(CRED_PREFIX + userId, b64url(cred.rawId));
  localStorage.setItem(ENABLED_PREFIX + userId, "1");
}

/** Solicita a confirmação biométrica do aparelho. */
export async function verifyBiometric(userId: string): Promise<boolean> {
  const plugin = await nativePlugin();
  if (plugin) {
    try {
      await plugin.verifyIdentity({
        reason: "Desbloqueie para acessar seus dados financeiros",
        title: "Desbloqueio biométrico",
      });
      return true;
    } catch {
      return false;
    }
  }

  if (!window.PublicKeyCredential) return false;
  const stored = localStorage.getItem(CRED_PREFIX + userId);
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: stored
          ? [{ type: "public-key", id: fromB64url(stored) }]
          : undefined,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
