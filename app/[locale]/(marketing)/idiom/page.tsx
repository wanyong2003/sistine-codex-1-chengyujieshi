import type { Metadata } from "next";
import { IdiomTool } from "@/features/idiom/components/idiom-tool";
import { generatePageMetadata } from "@/lib/metadata";
import type { Locale } from "@/i18n.config";

export async function generateMetadata(
  props: { params: Promise<{ locale: Locale }> },
): Promise<Metadata> {
  const { locale } = await props.params;
  return generatePageMetadata({
    locale,
    path: "/idiom",
    title: "成语解释器",
    description: "输入一个成语，获取简洁易懂的成语解释和出处。",
  });
}

export default function IdiomPage() {
  return <IdiomTool />;
}
