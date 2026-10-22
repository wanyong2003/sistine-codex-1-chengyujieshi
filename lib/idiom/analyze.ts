import { z } from "zod";
import { createChatCompletion } from "@/lib/volcano-engine/chat";

const resultSchema = z.object({
  status: z.enum(["match", "candidates", "unknown"]),
  idiom: z.string().optional(),
  literalMeaning: z.string().optional(),
  actualMeaning: z.string().optional(),
  origin: z.string().optional(),
  originConfirmed: z.boolean().optional(),
  candidates: z.array(z.string()).max(3).optional(),
});

export type IdiomResult = z.infer<typeof resultSchema>;

export function normalizeIdiomInput(input: string) {
  return input
    .trim()
    .replace(/\s+/gu, "")
    .replace(/[，。！？；：、“”‘’（）()【】\[\]《》<>]/gu, "");
}

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid model response");
  return resultSchema.parse(JSON.parse(text.slice(start, end + 1)));
}

export async function analyzeIdiom(input: string): Promise<IdiomResult> {
  const response = await createChatCompletion(
    [
      {
        role: "system",
        content: [
          "你是面向小学生和初中生的成语解释助手。",
          "只能依据你自己的知识回答，不得联网、不得查询数据库或外部词典。",
          "只返回 JSON，不要 Markdown，不要额外文字。",
          "输入是一个成语；允许忽略输入中的空格和常见标点，但不要把繁体字转换成简体字。",
          "如果输入是明确成语，status 必须是 match，并给出简洁准确的 literalMeaning 和 actualMeaning。",
          "只有你能有把握确认出处时，originConfirmed 才能为 true，origin 格式必须是‘出自《书名》’；不能确认时 originConfirmed 为 false，origin 为‘出处暂时无法确认’。",
          "如果不是明确成语，status 为 candidates，并给出最多 3 个候选；没有合理候选时 status 为 unknown。",
          "match 不要输出拼音、例句、近义词、反义词、用法或作者章节。",
          'JSON 结构：{"status":"match|candidates|unknown","idiom":"","literalMeaning":"","actualMeaning":"","origin":"","originConfirmed":true,"candidates":[]}',
        ].join("\n"),
      },
      { role: "user", content: normalizeIdiomInput(input) },
    ],
    {
      temperature: 0.1,
      top_p: 0.8,
      max_tokens: 700,
      signal: AbortSignal.timeout(15000),
    },
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty model response");
  const parsed = parseJson(text);

  if (parsed.status === "match") {
    if (!parsed.idiom || !parsed.literalMeaning || !parsed.actualMeaning) {
      throw new Error("Incomplete model response");
    }
    if (!parsed.originConfirmed) {
      return {
        ...parsed,
        origin: "出处暂时无法确认",
        originConfirmed: false,
      };
    }
  }

  return parsed;
}
