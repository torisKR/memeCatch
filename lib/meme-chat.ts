import { z } from "zod";

export const MEME_CHAT_LOCALES = ["ko", "en", "ja", "zh", "zh-tw"] as const;
export type MemeChatLocale = (typeof MEME_CHAT_LOCALES)[number];
export const memeChatRequestSchema = z.object({
  question: z.string().trim().min(2).max(120),
  locale: z.enum(MEME_CHAT_LOCALES).default("ko"),
}).strict();
export type MemeChatRequest = z.infer<typeof memeChatRequestSchema>;
export type MemeChatItem = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  href: string;
  sources: Array<{ url: string; label: string }>;
};
export type MemeChatResult = {
  answer: string;
  mode: "generated" | "retrieved" | "empty";
  retrievalMode: "hybrid" | "keyword";
  items: MemeChatItem[];
};
