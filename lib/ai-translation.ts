import "server-only";

type TranslateTextsInput = {
  targetLocale: string;
  sourceLocale: string;
  section: string;
  fieldKeys: string[];
  texts: string[];
  context?: string;
};

function hasOpenAIConfig() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function buildPlaceholder(locale: string, text: string) {
  const prefix = locale.trim().toUpperCase();
  return `[${prefix}] ${text}`;
}

function extractJsonArray(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[0]) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export async function translateTexts(input: TranslateTextsInput): Promise<string[]> {
  if (!input.texts.length) {
    return [];
  }

  if (!hasOpenAIConfig()) {
    return input.texts.map((text) => buildPlaceholder(input.targetLocale, text));
  }

  const model =
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1-mini";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return input.texts.map((text) => buildPlaceholder(input.targetLocale, text));
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a professional translation engine. Translate only the provided strings. Return JSON with a `translations` array in the same order. Do not add commentary.",
        },
        {
          role: "user",
          content: JSON.stringify({
            targetLocale: input.targetLocale,
            sourceLocale: input.sourceLocale,
            section: input.section,
            fieldKeys: input.fieldKeys,
            texts: input.texts,
            context: input.context ?? "",
          }),
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return input.texts.map((text) => buildPlaceholder(input.targetLocale, text));
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
      }
    | null;

  const content = payload?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonArray(content);

  if (!parsed || parsed.length !== input.texts.length) {
    return input.texts.map((text) => buildPlaceholder(input.targetLocale, text));
  }

  return parsed.map((item, index) => {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }

    return buildPlaceholder(input.targetLocale, input.texts[index] ?? "");
  });
}

export function buildTranslationFallback(locale: string, text: string) {
  return buildPlaceholder(locale, text);
}

