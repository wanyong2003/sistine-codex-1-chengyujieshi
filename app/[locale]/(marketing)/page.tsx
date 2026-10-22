import { Container } from "@/components/container";
import { Background } from "@/components/background";
import { Button } from "@/components/button";
import { LocaleLink } from "@/components/locale-link";
import { Metadata } from "next";
import { getTranslations } from 'next-intl/server';
import type { Locale } from "@/i18n.config";
import { generatePageMetadata } from "@/lib/metadata";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: Locale }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const t = await getTranslations({ locale, namespace: 'hero' });

  return generatePageMetadata({
    locale,
    path: '',
    title: t('title'),
    description: t('description'),
  });
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Background />
      <Container className="relative z-10 flex min-h-screen flex-col items-center justify-center py-32 text-center">
        <p className="text-sm font-medium text-primary">面向中小学生的 AI 学习工具</p>
        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
          一句话，读懂一个成语
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
          输入成语，获取简洁易懂的字面义、实际义和出处。遇到不确定的内容，我们会明确告诉你。
        </p>
        <Button as={LocaleLink} href="/idiom" size="lg" className="mt-10">
          开始查询
        </Button>

        <div className="mt-20 grid w-full max-w-3xl gap-4 text-left md:grid-cols-3">
          {[
            ["画蛇添足", "比喻做了多余的事，反而不恰当。"],
            ["亡羊补牢", "出了问题以后想办法补救，还不算晚。"],
            ["守株待兔", "不主动努力，只想靠偶然机会获得成功。"],
          ].map(([idiom, description]) => (
            <div key={idiom} className="rounded-2xl border border-border bg-card/70 p-5 backdrop-blur">
              <h2 className="text-lg font-semibold text-foreground">{idiom}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
