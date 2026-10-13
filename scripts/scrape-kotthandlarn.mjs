import { mkdir, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://www.kotthandlarn.se/lunch";
const OUTPUT_FILE = new URL("../data/kotthandlarn.json", import.meta.url);
const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

const response = await fetch(SOURCE_URL, {
  headers: {
    "User-Agent": "Lunchrundan menu updater (+https://github.com/klasd/lunchscraper)",
  },
});

if (!response.ok) throw new Error(`Kötthandlarn returned HTTP ${response.status}`);

const html = await response.text();
const week = text(html.match(/Lunch Vecka[\s\S]{0,80}?(\d{1,2})<\/h1>/i)?.[1]);
const specialMatch = html.match(
  /Veckans special[\s\S]{0,1200}?<h2[^>]*>([\s\S]*?)<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
);
const special = specialMatch ? {
  name: text(specialMatch[1]),
  description: text(specialMatch[2]),
  price: text(specialMatch[3]),
} : null;
const days = Object.fromEntries(WEEKDAYS.map((day) => [day, []]));

for (const day of WEEKDAYS) {
  const match = html.match(new RegExp(
    `<p[^>]*>\\s*${day}\\s*</p>\\s*<h3[^>]*>([\\s\\S]*?)</h3>\\s*<p[^>]*>([\\s\\S]*?)</p>\\s*<p[^>]*>([\\s\\S]*?)</p>`,
    "i",
  ));

  if (!match) throw new Error(`Could not find Kötthandlarn's ${day} menu`);
  days[day].push({
    name: text(match[1]),
    description: text(match[2]),
    price: text(match[3]),
  });
  if (special) days[day].push({ ...special });
}

if (!week || !special) throw new Error("Could not parse Kötthandlarn's week or weekly special");

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify({ week, days }, null, 2)}\n`);
console.log(`Saved Kötthandlarn week ${week}`);

function text(value = "") {
  return decodeEntities(value.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
