"use client";

import { useState } from "react";

export default function LoginPage() {
  const [form, setForm] = useState({ emailOrUsername: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      localStorage.setItem("token", data.token);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          className="border rounded p-2 text-black"
          placeholder="Email or Username"
          value={form.emailOrUsername}
          onChange={(e) =>
            setForm({ ...form, emailOrUsername: e.target.value })
          }
        />
        <input
          className="border rounded p-2 text-black"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="bg-blue-600 text-white rounded p-2" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
