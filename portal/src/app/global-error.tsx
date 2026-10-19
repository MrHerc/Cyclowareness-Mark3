"use client";

/**
 * Last-resort boundary when the root layout itself fails (no fonts, no translations available).
 * Kept in plain HTML with the three interface languages.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="az">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f6fb", color: "#16123a" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Xəta baş verdi · Something went wrong · Произошла ошибка</h1>
            <p style={{ color: "#5b5878", margin: "0 0 20px" }}>Bir az sonra yenidən cəhd edin. · Try again in a moment. · Попробуйте ещё раз чуть позже.</p>
            <button type="button" onClick={reset} style={{ height: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#4f46e5", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Yenidən · Retry · Повторить
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
