"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

/**
 * Lightweight markdown renderer backed by `react-markdown` + `remark-gfm`.
 * Supports: headings, lists, links, code, bold/italic, blockquotes,
 * tables, images and line breaks. Designed to fit inside an Alert.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;
  return (
    <div className="markdown-content text-sm leading-relaxed [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_p]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_img]:my-2 [&_img]:max-h-[200px] [&_img]:inline-block [&_img]:rounded [&_table]:my-2 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;