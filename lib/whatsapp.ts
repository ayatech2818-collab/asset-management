// Shared helper for sharing an employee's login credentials over WhatsApp.
// Pure (no client APIs) so it works in both server and client components.

export const LOGIN_URL = "https://asset-management-lovat-eight.vercel.app/login";

// Build a wa.me click-to-chat link pre-filled with the employee's login. Returns
// null when there's no usable WhatsApp number or no stored password to share.
export function credentialShareHref(
  email: string,
  password: string | null | undefined,
  whatsapp: string | null | undefined,
): string | null {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 8 || !password) return null;
  const message = `AssetHub login\n\nEmail: ${email}\nPassword: ${password}\n\nSign in: ${LOGIN_URL}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
