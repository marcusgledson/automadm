// SMS listener: works ONLY on native Android via Capacitor.
// On web / iOS it is a no-op. Callers should show fallback UI.

import { parseSms, type SmsBankConfig } from "./smsParser";

type IncomingSms = { address: string; body: string; date?: number };

export async function isSmsAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!(await isSmsAvailable())) return false;
  try {
    const mod: any = await import("capacitor-sms-inbox");
    const plugin = mod.SMSInboxReader ?? mod.default ?? mod;
    const res = await plugin.checkPermissions?.();
    if (res?.sms === "granted") return true;
    const req = await plugin.requestPermissions?.();
    return req?.sms === "granted";
  } catch (e) {
    console.warn("SMS permission failed", e);
    return false;
  }
}

export async function readRecentSms(sinceMs?: number): Promise<IncomingSms[]> {
  if (!(await isSmsAvailable())) return [];
  try {
    const mod: any = await import("capacitor-sms-inbox");
    const plugin = mod.SMSInboxReader ?? mod.default ?? mod;
    const filter: Record<string, unknown> = { maxCount: 200 };
    if (sinceMs) filter.minDate = sinceMs;
    const res = await plugin.getSMSList?.({ filter });
    return (res?.smsList ?? []) as IncomingSms[];
  } catch (e) {
    console.warn("SMS read failed", e);
    return [];
  }
}

export function classifySms(
  sender: string,
  body: string,
  configs: SmsBankConfig[],
  receivedAt?: Date,
) {
  const cfg = configs.find((c) =>
    c.senders.some((s) => sender?.toLowerCase().includes(s.toLowerCase())),
  );
  if (!cfg) return null;
  return { cfg, parsed: parseSms(sender, body, cfg, receivedAt) };
}
