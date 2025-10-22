// API service wrapper
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export async function spawn() {
  const res = await fetch(`${BASE_URL}/api/spawn`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Spawn failed: ${res.status}`);
  return res.json();
}

export async function catchPokemon(payload: any) {
  const res = await fetch(`${BASE_URL}/api/catch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(`Catch failed: ${res.status}`);
  return res.json();
}

export async function getPokemon(idOrName: string | number) {
  const res = await fetch(`${BASE_URL}/api/pokemon/${encodeURIComponent(idOrName)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pokemon fetch failed: ${res.status}`);
  return res.json();
}
