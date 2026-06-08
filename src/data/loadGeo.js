export async function loadGeo() {
  const res = await fetch('/geo.json');
  if (!res.ok) throw new Error(`Failed to load geo.json: ${res.status}`);
  return res.json();
}
