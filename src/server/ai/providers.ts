const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export async function callClaude(
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>,
  options: {
    system?: string;
    maxTokens?: number;
    model?: string;
  } = {}
): Promise<string> {
  const {
    system,
    maxTokens = 4096,
    model = "claude-haiku-4-5-20251001",
  } = options;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };

  if (system) body.system = system;

  console.log("[claude] Calling API, model:", model, "maxTokens:", maxTokens);
  const start = Date.now();

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  console.log("[claude] Response status:", res.status, "in", Date.now() - start, "ms");

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${error}`);
  }

  const data: AnthropicResponse = await res.json();
  console.log("[claude] Tokens:", data.usage.input_tokens, "in /", data.usage.output_tokens, "out");
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

export async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  options: {
    maxTokens?: number;
    model?: string;
  } = {}
): Promise<string> {
  const {
    maxTokens = 4096,
    model = "gpt-4.1-mini",
  } = options;

  console.log("[openai] Calling API, model:", model, "maxTokens:", maxTokens);
  const start = Date.now();

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY!}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  console.log("[openai] Response status:", res.status, "in", Date.now() - start, "ms");

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${error}`);
  }

  const data: OpenAIResponse = await res.json();
  console.log("[openai] Tokens:", data.usage.prompt_tokens, "in /", data.usage.completion_tokens, "out");
  return data.choices[0]?.message?.content ?? "";
}
