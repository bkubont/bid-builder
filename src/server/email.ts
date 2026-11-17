import "server-only";

/**
 * Sends email through Resend's HTTP API (https://resend.com). Off unless
 * RESEND_API_KEY and EMAIL_FROM are set. EMAIL_FROM must be an address on a
 * domain verified in Resend, e.g. "F&G Home Maintenance <estimates@fandg-llc.com>".
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  fromName?: string;
  attachment: { filename: string; base64: string };
}): Promise<{ id?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("Email isn't set up on the server.");

  // RESEND_API_URL is only for tests (a fake server); leave it unset.
  const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: withDisplayName(from, input.fromName),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      reply_to: input.replyTo || undefined,
      attachments: [{ filename: input.attachment.filename, content: input.attachment.base64 }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Resend send failed", response.status, detail.slice(0, 500));
    throw new Error(`Email service returned ${response.status}`);
  }
  const json = (await response.json().catch(() => ({}))) as { id?: string };
  return { id: json.id };
}

/** Use the company name as the sender name when EMAIL_FROM is a bare address. */
function withDisplayName(from: string, name?: string) {
  if (!name || from.includes("<")) return from;
  const safe = name.replace(/["<>\r\n]/g, "").trim();
  return safe ? `"${safe}" <${from}>` : from;
}
