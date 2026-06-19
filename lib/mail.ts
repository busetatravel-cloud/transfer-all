import "server-only";

import net from "node:net";
import tls from "node:tls";

export type MailProvider = "resend" | "smtp" | "placeholder";
export type MailSendStatus = "sent" | "sent_placeholder" | "failed";

export type MailSendResult = {
  provider: MailProvider;
  status: MailSendStatus;
  messageId?: string;
  details?: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  from?: string;
};

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function getFromAddress() {
  return (
    normalizeText(process.env.MAIL_FROM_EMAIL) ||
    normalizeText(process.env.RESEND_FROM_EMAIL) ||
    normalizeText(process.env.SMTP_FROM_EMAIL)
  );
}

function getResendApiKey() {
  return normalizeText(process.env.RESEND_API_KEY);
}

function getSmtpConfig() {
  const host = normalizeText(process.env.SMTP_HOST);
  const port = Number(normalizeText(process.env.SMTP_PORT) || "0");
  const user = normalizeText(process.env.SMTP_USER);
  const password = normalizeText(process.env.SMTP_PASSWORD);
  const secure = ["1", "true", "yes"].includes(
    normalizeText(process.env.SMTP_SECURE).toLowerCase(),
  );
  const from = getFromAddress();

  if (!host || !port || !from) {
    return null;
  }

  return { host, port, user, password, secure, from };
}

function base64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

async function sendResendMail(message: MailMessage): Promise<MailSendResult> {
  const apiKey = getResendApiKey();
  const from = normalizeText(message.from) || getFromAddress();

  if (!apiKey || !from) {
    return {
      provider: "placeholder",
      status: "sent_placeholder",
      details: "Resend env bulunamadı.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details.trim() || "Mail gönderilemedi.");
  }

  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  return {
    provider: "resend",
    status: "sent",
    messageId: body?.id,
  };
}

function splitSmtpLines(buffer: string) {
  const lines: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const index = buffer.indexOf("\r\n", cursor);
    if (index === -1) {
      break;
    }

    lines.push(buffer.slice(cursor, index));
    cursor = index + 2;
  }

  return { lines, rest: buffer.slice(cursor) };
}

async function readSmtpResponse(socket: net.Socket | tls.TLSSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const lines: string[] = [];

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const split = splitSmtpLines(buffer);
      buffer = split.rest;

      for (const line of split.lines) {
        lines.push(line);
      }

      const last = lines[lines.length - 1] ?? "";
      if (/^\d{3} /.test(last)) {
        cleanup();
        resolve(lines.join("\n"));
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendSmtpMail(message: MailMessage): Promise<MailSendResult> {
  const config = getSmtpConfig();

  if (!config) {
    return {
      provider: "placeholder",
      status: "sent_placeholder",
      details: "SMTP env bulunamadı.",
    };
  }

  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });

  const writeLine = (line: string) => {
    socket.write(`${line}\r\n`);
  };

  await readSmtpResponse(socket);
  writeLine("EHLO localhost");
  await readSmtpResponse(socket);

  if (config.user && config.password) {
    writeLine("AUTH LOGIN");
    await readSmtpResponse(socket);
    writeLine(base64(config.user));
    await readSmtpResponse(socket);
    writeLine(base64(config.password));
    await readSmtpResponse(socket);
  }

  writeLine(`MAIL FROM:<${config.from}>`);
  await readSmtpResponse(socket);
  writeLine(`RCPT TO:<${message.to}>`);
  await readSmtpResponse(socket);
  writeLine("DATA");
  await readSmtpResponse(socket);
  writeLine(`From: ${normalizeText(message.from) || config.from}`);
  writeLine(`To: ${message.to}`);
  writeLine(`Subject: ${message.subject}`);
  writeLine("Content-Type: text/plain; charset=utf-8");
  writeLine("");

  for (const line of message.text.split("\n")) {
    writeLine(line.startsWith(".") ? `.${line}` : line);
  }

  writeLine(".");
  await readSmtpResponse(socket);
  writeLine("QUIT");
  socket.end();

  return {
    provider: "smtp",
    status: "sent",
  };
}

export async function sendVoucherMail(message: MailMessage): Promise<MailSendResult> {
  const recipient = normalizeText(message.to);
  const subject = normalizeText(message.subject);
  const text = normalizeText(message.text);

  if (!recipient || !subject || !text) {
    throw new Error("Mail gönderimi için zorunlu alanlar eksik.");
  }

  try {
    const resendResult = await sendResendMail(message);
    if (resendResult.provider !== "placeholder") {
      return resendResult;
    }
  } catch (error) {
    console.warn("mail.resend.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const smtpResult = await sendSmtpMail(message);
    if (smtpResult.provider !== "placeholder") {
      return smtpResult;
    }
  } catch (error) {
    console.warn("mail.smtp.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    provider: "placeholder",
    status: "sent_placeholder",
    details: "Gerçek provider env bulunamadı.",
  };
}
