"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Background } from "@/components/background";
import { Button } from "@/components/button";
import { Container } from "@/components/container";

type IdiomResult = {
  status: "match" | "candidates" | "unknown";
  idiom?: string;
  literalMeaning?: string;
  actualMeaning?: string;
  origin?: string;
  originConfirmed?: boolean;
  candidates?: string[];
};

type Quota = {
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  subscriptionQueries: number;
  oneTimeQueries: number;
};

export function IdiomTool() {
  const locale = useLocale();
  const [input, setInput] = useState("");
  const [lastInput, setLastInput] = useState("");
  const [result, setResult] = useState<IdiomResult | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadQuota = useCallback(async () => {
    const response = await fetch("/api/idiom");
    if (response.ok) {
      const data = (await response.json()) as { quota: Quota };
      setQuota(data.quota);
    }
  }, []);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  const submit = useCallback(async (value = input) => {
    const normalized = value.trim();
    if (!normalized || loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);
    setLastInput(normalized);

    try {
      const response = await fetch("/api/idiom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: normalized }),
      });
      const data = (await response.json()) as {
        result?: IdiomResult;
        quota?: Quota;
        error?: string;
      };

      if (data.quota) setQuota(data.quota);
      if (!response.ok) {
        setError(data.error || "解释服务暂时不可用，请稍后重试。");
        return;
      }
      setResult(data.result ?? null);
    } catch {
      setError("解释服务暂时不可用，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const copyResult = async () => {
    if (!result?.idiom) return;
    const text = [
      result.idiom,
      `字面义：${result.literalMeaning}`,
      `实际义：${result.actualMeaning}`,
      `出处：${result.origin}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden py-28 md:py-36">
      <Background />
      <Container className="relative z-10 max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-medium text-primary">成语学习小助手</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            成语解释器
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            输入一个成语，获得简洁易懂的字面义、实际义和出处。
          </p>
        </div>

        <form
          className="mt-12 rounded-3xl border border-border bg-card/80 p-4 shadow-xl backdrop-blur md:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="idiom-input" className="sr-only">请输入成语</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="idiom-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="例如：画蛇添足"
              maxLength={32}
              className="min-h-12 flex-1 rounded-full border border-border bg-background px-5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <Button type="submit" size="lg" disabled={loading || !input.trim()}>
              {loading ? "解释中..." : "开始解释"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>只输入一个成语即可</span>
            {quota && (
              <span>
                今日还可免费查询 {quota.dailyRemaining} 次
                {quota.subscriptionQueries + quota.oneTimeQueries > 0
                  ? `，付费余额 ${quota.subscriptionQueries + quota.oneTimeQueries} 次`
                  : ""}
              </span>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
            <p>{error}</p>
            {lastInput && (
              <button
                type="button"
                onClick={() => void submit(lastInput)}
                className="mt-3 text-sm font-medium underline underline-offset-4"
              >
                再试一次
              </button>
            )}
            <Link href={`/${locale}/pricing`} className="ml-4 text-sm font-medium underline underline-offset-4">
              查看购买方案
            </Link>
          </div>
        )}

        {result?.status === "candidates" && (
          <div className="mt-6 rounded-2xl border border-border bg-card/80 p-6">
            <h2 className="text-lg font-semibold">你是不是想查询：</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(result.candidates ?? []).map((candidate) => (
                <button
                  type="button"
                  key={candidate}
                  onClick={() => {
                    setInput(candidate);
                    void submit(candidate);
                  }}
                  className="rounded-full border border-border px-4 py-2 text-sm transition hover:border-primary hover:text-primary"
                >
                  {candidate}
                </button>
              ))}
            </div>
          </div>
        )}

        {result?.status === "unknown" && (
          <div className="mt-6 rounded-2xl border border-border bg-card/80 p-6 text-muted-foreground">
            暂时无法确认这个词是不是成语，请检查输入后再试一次。
          </div>
        )}

        {result?.status === "match" && (
          <article className="mt-6 rounded-3xl border border-border bg-card/90 p-6 shadow-lg md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="text-3xl font-semibold text-foreground">{result.idiom}</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyResult()}>
                {copied ? "已复制" : "复制结果"}
              </Button>
            </div>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">字面义</dt>
                <dd className="mt-2 leading-7 text-foreground">{result.literalMeaning}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">实际义</dt>
                <dd className="mt-2 leading-7 text-foreground">{result.actualMeaning}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">出处</dt>
                <dd className="mt-2 leading-7 text-foreground">{result.origin}</dd>
              </div>
            </dl>
            <p className="mt-8 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
              内容由 AI 生成，请结合实际学习资料进行核对。
            </p>
          </article>
        )}
      </Container>
    </div>
  );
}
