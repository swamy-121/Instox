export function toE164(countryCode: string, nationalNumber: string): string | null {
  const cc = countryCode.replace(/\D/g, "");
  const national = nationalNumber.replace(/\D/g, "");
  if (!cc || !national) return null;
  if (cc === "91") {
    return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
  }
  if (cc.length > 3 || national.length < 6 || national.length > 12) return null;
  return `+${cc}${national}`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••••${digits.slice(-4)}`;
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!name || !domain) return "••••";
  const visible = name.slice(0, 1);
  return `${visible}•••@${domain}`;
}
