"use client";

/**
 * Last-resort error boundary. Replaces the *entire* root layout (and
 * therefore the html/body) when an error escapes the Providers tree —
 * for example, if a font loader or the QueryClient provider itself
 * throws. Next.js requires this file to be a complete HTML document.
 */
import { Icon } from "@iconify/react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorBoundary({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#fafafa",
          color: "#111",
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          style={{
            maxWidth: 480,
            width: "100%",
            padding: "1.5rem",
            background: "white",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: "#fee",
                color: "#c00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon icon="tabler:alert-triangle" width={20} height={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
              应用初始化失败
            </h1>
          </div>
          <p
            style={{
              margin: "0 0 12px",
              color: "#666",
              fontSize: 14,
            }}
          >
            应用的根组件加载失败。这通常是配置问题（例如后端不可用或
            资源加载错误）。请刷新页面重试。
          </p>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              overflow: "auto",
              margin: "0 0 16px",
              color: "#444",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.message || "未知错误"}
            {error.digest && `\ndigest: ${error.digest}`}
          </pre>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              background: "#111",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}