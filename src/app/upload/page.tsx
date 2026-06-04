'use client';
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file") as File | null;

    if (!file) {
      setError("Please choose a PDF file before uploading.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Upload failed.");
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
      <form onSubmit={handleSubmit} encType="multipart/form-data" style={{display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 420}}>
        <label style={{display: 'flex', flexDirection: 'column', gap: 8, color: '#e2e8f0'}}>
          PDF file (max 10MB):
          <input type="file" name="file" accept="application/pdf" />
        </label>
        {error && <div style={{color: '#fb7185'}}>{error}</div>}
        <button type="submit" disabled={loading} style={{padding: '8px 12px', opacity: loading ? 0.7 : 1}}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </main>
  );
}
