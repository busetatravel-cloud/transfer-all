import "server-only";

export type WhatsAppProvider = "meta" | "twilio" | "placeholder";
export type WhatsAppSendStatus = "sent" | "sent_placeholder" | "failed";

export type WhatsAppMessage = {
  to: string;
  body: string;
  from?: string;
};

export type WhatsAppSendResult = {
  provider: WhatsAppProvider;
  status: WhatsAppSendStatus;
  messageId?: string;
  details?: string;
};

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

// sendVoucherWhatsApp içinde, Meta/Twilio try/catch bloklarına girmeden ÖNCE fırlatılır;
// böylece geçersiz telefon hatası diğer provider hataları gibi yutulup placeholder'a
// düşürülmez, çağırana (route) kadar ulaşır.
export class InvalidWhatsAppPhoneError extends Error {}

// Telefon numarasını "+<ülke kodu><abone numarası>" (E.164) kanonik formuna çevirir.
// Ayraçları (boşluk, tire, parantez, nokta) kaldırır, "00" önekini "+" ile değiştirir.
// Ülke kodu belirtilmemiş yerel numaraları OTOMATİK bir ülkeye bağlamaz — işletmenin
// veya numaranın ülkesi kesin bilinmediği için bu durumda anlamlı bir hata fırlatır.
export function normalizeWhatsAppPhone(rawValue: string | null | undefined): string {
  const trimmed = String(rawValue ?? "").trim();

  if (!trimmed) {
    throw new InvalidWhatsAppPhoneError("Telefon numarası boş.");
  }

  let cleaned = trimmed.replace(/[\s\-().]/g, "");

  if (cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  if (!cleaned.startsWith("+")) {
    throw new InvalidWhatsAppPhoneError(
      "Telefon numarası uluslararası formatta değil. Örnek: +905551112233",
    );
  }

  const digits = cleaned.slice(1);

  if (!digits || !/^\d+$/.test(digits)) {
    throw new InvalidWhatsAppPhoneError(
      "Telefon numarası uluslararası formatta değil. Örnek: +905551112233",
    );
  }

  if (digits.length < 8 || digits.length > 15) {
    throw new InvalidWhatsAppPhoneError(
      "Telefon numarası uluslararası formatta değil. Örnek: +905551112233",
    );
  }

  return `+${digits}`;
}

function ensureWhatsAppPrefix(value: string) {
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function getMetaConfig() {
  const token = normalizeText(process.env.WHATSAPP_META_TOKEN);
  const phoneNumberId = normalizeText(process.env.WHATSAPP_META_PHONE_NUMBER_ID);
  const from = normalizeText(process.env.WHATSAPP_META_FROM) || normalizeText(process.env.WHATSAPP_FROM);

  if (!token || !phoneNumberId) {
    return null;
  }

  return { token, phoneNumberId, from };
}

function getTwilioConfig() {
  const accountSid = normalizeText(process.env.TWILIO_ACCOUNT_SID);
  const authToken = normalizeText(process.env.TWILIO_AUTH_TOKEN);
  const from = normalizeText(process.env.TWILIO_WHATSAPP_FROM) || normalizeText(process.env.WHATSAPP_FROM);

  if (!accountSid || !authToken || !from) {
    return null;
  }

  return { accountSid, authToken, from };
}

async function sendMetaWhatsApp(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
  const config = getMetaConfig();

  if (!config) {
    return {
      provider: "placeholder",
      status: "sent_placeholder",
      details: "Meta WhatsApp env bulunamadı.",
    };
  }

  // Meta Cloud API "to" alanını yalnızca rakamlardan (baştaki "+" olmadan) bekler.
  // message.to bu noktada sendVoucherWhatsApp tarafından zaten "+<digits>" formuna
  // normalize edilmiş olarak gelir.
  const metaPhone = message.to.replace(/^\+/, "");

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: metaPhone,
        type: "text",
        text: {
          preview_url: true,
          body: message.body,
        },
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details.trim() || "WhatsApp gönderilemedi.");
  }

  const body = (await response.json().catch(() => null)) as {
    messages?: Array<{ id?: string }>;
  } | null;

  return {
    provider: "meta",
    status: "sent",
    messageId: body?.messages?.[0]?.id,
  };
}

async function sendTwilioWhatsApp(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
  const config = getTwilioConfig();

  if (!config) {
    return {
      provider: "placeholder",
      status: "sent_placeholder",
      details: "Twilio WhatsApp env bulunamadı.",
    };
  }

  const url = new URL(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
  );
  // Twilio'nun WhatsApp kanalı hem From hem To alanında "whatsapp:" öneki bekler;
  // önek zaten varsa ikinci kez eklenmez.
  const body = new URLSearchParams({
    From: ensureWhatsAppPrefix(config.from),
    To: ensureWhatsAppPrefix(message.to),
    Body: message.body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details.trim() || "WhatsApp gönderilemedi.");
  }

  const json = (await response.json().catch(() => null)) as { sid?: string } | null;

  return {
    provider: "twilio",
    status: "sent",
    messageId: json?.sid,
  };
}

export async function sendVoucherWhatsApp(
  message: WhatsAppMessage,
): Promise<WhatsAppSendResult> {
  const body = normalizeText(message.body);

  if (!body) {
    throw new Error("WhatsApp gönderimi için mesaj gövdesi gerekli.");
  }

  // normalizeWhatsAppPhone burada, try/catch bloklarının DIŞINDA çağrılıyor: geçersiz
  // telefon hatası (InvalidWhatsAppPhoneError) provider hataları gibi yutulmaz, olduğu
  // gibi çağırana ulaşır.
  const normalizedPhone = normalizeWhatsAppPhone(message.to);
  const normalizedMessage: WhatsAppMessage = { ...message, to: normalizedPhone, body };

  try {
    const metaResult = await sendMetaWhatsApp(normalizedMessage);
    if (metaResult.provider !== "placeholder") {
      return metaResult;
    }
  } catch (error) {
    console.warn("whatsapp.meta.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const twilioResult = await sendTwilioWhatsApp(normalizedMessage);
    if (twilioResult.provider !== "placeholder") {
      return twilioResult;
    }
  } catch (error) {
    console.warn("whatsapp.twilio.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    provider: "placeholder",
    status: "sent_placeholder",
    details: "Gerçek WhatsApp provider env bulunamadı.",
  };
}
