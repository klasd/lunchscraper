"use strict";

// Replace this if you move to another proxy using the same `?url=` format.
const PROXY_BASE_URL = "https://api.allorigins.win/raw?url=";
const KOTTHANDLARN_DATA_URL = "https://raw.githubusercontent.com/klasd/lunchscraper/main/data/kotthandlarn.json";
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_PREFIX = "lunchrundan:v1:";
const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

const restaurants = [
  {
    id: "tybble",
    name: "Restaurang Tybble",
    sourceUrl: "https://www.restaurangtybble.se/lunchmeny/",
    fetchMenu: fetchTybble,
  },
  {
    id: "29an",
    name: "Restaurang 29",
    sourceUrl: "http://restaurang29.se/",
    fetchMenu: fetchRestaurant29,
  },
  {
    id: "parken",
    name: "Restaurang Parken",
    sourceUrl: "https://www.restaurangparken.se/lunchmeny",
    fetchMenu: fetchParken,
  },
  {
    id: "kotthandlarn",
    name: "Kötthandlarn",
    sourceUrl: "https://www.kotthandlarn.se/lunch",
    fetchMenu: fetchKotthandlarn,
  },
];

const state = {
  selectedDay: getInitialDay(),
  menus: new Map(),
  loading: new Set(restaurants.map(({ id }) => id)),
  errors: new Map(),
};

const dayPicker = document.querySelector("#day-picker");
const menuGrid = document.querySelector("#menu-grid");
const refreshButton = document.querySelector("#refresh-button");
const todayLabel = document.querySelector("#today-label");
const updatedLabel = document.querySelector("#updated-label");
const cardTemplate = document.querySelector("#restaurant-card-template");

initialize();

function initialize() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  todayLabel.textContent = `Idag är det ${today}`;
  renderDayPicker();
  renderCards();
  refreshButton.addEventListener("click", loadMenus);
  loadMenus();
}

function getInitialDay() {
  const dayIndex = new Date().getDay();
  return dayIndex >= 1 && dayIndex <= 5 ? WEEKDAYS[dayIndex - 1] : "Fredag";
}

function renderDayPicker() {
  dayPicker.replaceChildren();
  for (const day of WEEKDAYS) {
    const button = document.createElement("button");
    button.className = "day-button";
    button.type = "button";
    button.textContent = day;
    button.setAttribute("aria-pressed", String(day === state.selectedDay));
    button.addEventListener("click", () => {
      state.selectedDay = day;
      renderDayPicker();
      renderCards();
    });
    dayPicker.append(button);
  }
}

function renderCards() {
  menuGrid.replaceChildren();
  restaurants.forEach((restaurant, index) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".restaurant-card");
    const menu = state.menus.get(restaurant.id);
    const error = state.errors.get(restaurant.id);

    card.dataset.restaurant = restaurant.id;
    fragment.querySelector(".card-number").textContent = String(index + 1).padStart(2, "0");
    fragment.querySelector(".restaurant-name").textContent = restaurant.name;
    fragment.querySelector(".week-label").textContent = menu?.week ? `Vecka ${menu.week}` : "Veckans meny";

    const sourceLink = fragment.querySelector(".source-link");
    sourceLink.href = restaurant.sourceUrl;
    const body = fragment.querySelector(".card-body");
    const meta = fragment.querySelector(".card-meta");

    if (state.loading.has(restaurant.id) && !menu) {
      renderLoading(body);
      meta.textContent = "Hämtar aktuell meny…";
    } else if (menu) {
      renderMenu(body, menu, state.selectedDay);
      meta.textContent = menu.cached
        ? `Sparad meny från ${formatTimestamp(menu.fetchedAt)}`
        : `Hämtad ${formatTimestamp(menu.fetchedAt)}`;
      if (error && menu.cached) meta.title = `Kunde inte uppdatera: ${error}`;
    } else {
      renderError(body, error);
      meta.textContent = "Ingen sparad meny finns";
    }

    menuGrid.append(fragment);
  });
}

function renderLoading(container) {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("aria-label", "Menyn hämtas");
  for (let index = 0; index < 3; index += 1) {
    const line = document.createElement("div");
    line.className = "skeleton-line";
    wrapper.append(line);
  }
  container.append(wrapper);
}

function renderMenu(container, menu, day) {
  const dishes = menu.days[day] || [];
  if (!dishes.length) return renderEmpty(container, day);

  const list = document.createElement("ol");
  list.className = "dish-list";
  for (const dish of dishes) {
    const item = document.createElement("li");
    item.className = "dish";
    const name = document.createElement("strong");
    name.className = "dish-name";

    if (dish.vegetarian) {
      const badge = document.createElement("span");
      badge.className = "vegetarian-badge";
      badge.textContent = "VEG";
      name.append(badge);
    }
    name.append(document.createTextNode(dish.name));
    item.append(name);

    if (dish.description) {
      const description = document.createElement("span");
      description.className = "dish-description";
      description.textContent = dish.description;
      item.append(description);
    }
    if (dish.price) {
      const price = document.createElement("span");
      price.className = "dish-price";
      price.textContent = dish.price;
      item.append(price);
    }
    list.append(item);
  }
  container.append(list);
}

function renderEmpty(container, day) {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";
  const title = document.createElement("strong");
  title.textContent = `Inget för ${day.toLowerCase()}`;
  const message = document.createElement("p");
  message.textContent = "Restaurangen har inte publicerat någon meny för den här dagen.";
  wrapper.append(title, message);
  container.append(wrapper);
}

function renderError(container, error) {
  const wrapper = document.createElement("div");
  wrapper.className = "error-state";
  const title = document.createElement("strong");
  title.textContent = "Menyn kunde inte hämtas";
  const message = document.createElement("p");
  message.textContent = error || "Försök igen senare eller öppna restaurangens originalmeny.";
  wrapper.append(title, message);
  container.append(wrapper);
}

async function loadMenus() {
  refreshButton.disabled = true;
  state.loading = new Set(restaurants.map(({ id }) => id));
  state.errors.clear();
  renderCards();
  await Promise.allSettled(restaurants.map(loadRestaurant));
  refreshButton.disabled = false;
  const newest = Math.max(...[...state.menus.values()].map((menu) => menu.fetchedAt || 0));
  updatedLabel.textContent = Number.isFinite(newest) ? `Senast kontrollerad ${formatTimestamp(newest)}` : "";
}

async function loadRestaurant(restaurant) {
  try {
    const menu = await restaurant.fetchMenu();
    const normalized = validateMenu({
      ...menu,
      restaurantId: restaurant.id,
      fetchedAt: Date.now(),
      cached: false,
    });
    state.menus.set(restaurant.id, normalized);
    saveCache(restaurant.id, normalized);
  } catch (error) {
    state.errors.set(restaurant.id, friendlyError(error));
    const cached = readCache(restaurant.id);
    if (cached) state.menus.set(restaurant.id, { ...cached, cached: true });
  } finally {
    state.loading.delete(restaurant.id);
    renderCards();
  }
}

async function fetchTybble() {
  const response = await fetchWithTimeout("https://www.restaurangtybble.se/wp-json/wp/v2/pages/8676");
  const data = await response.json();
  if (!data.content?.rendered) throw new Error("Tybble returnerade ingen meny.");
  return parseTybble(data.content.rendered);
}

async function fetchRestaurant29() {
  return parseRestaurant29(await fetchViaProxy("http://restaurang29.se/"));
}

async function fetchParken() {
  return parseParken(await fetchViaProxy("https://www.restaurangparken.se/lunchmeny"));
}

async function fetchKotthandlarn() {
  try {
    const response = await fetchWithTimeout(`${KOTTHANDLARN_DATA_URL}?t=${Date.now()}`);
    return response.json();
  } catch {
    const response = await fetchWithTimeout(`data/kotthandlarn.json?t=${Date.now()}`);
    return response.json();
  }
}

async function fetchViaProxy(url) {
  const response = await fetchWithTimeout(`${PROXY_BASE_URL}${encodeURIComponent(url)}`);
  return response.text();
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Webbservern svarade med ${response.status}.`);
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseTybble(html) {
  const document = parseHtml(html);
  const weekText = [...document.querySelectorAll("h1, h2, h3, h4, h5")]
    .map((element) => cleanText(element.textContent))
    .find((text) => /lunchmeny\s*v(?:ecka)?\.?\s*\d+/i.test(text));
  const days = emptyDays();
  const dayHeadings = [...document.querySelectorAll("p > strong")]
    .filter((element) => WEEKDAYS.some((day) => sameDay(element.textContent, day)));

  for (const heading of dayHeadings) {
    const day = WEEKDAYS.find((candidate) => sameDay(heading.textContent, candidate));
    let sibling = heading.parentElement.nextElementSibling;
    while (sibling && !sibling.querySelector(":scope > strong")) {
      const text = cleanText(sibling.textContent);
      if (text && !text.includes("[/vc_")) days[day].push(splitTybbleDish(text));
      sibling = sibling.nextElementSibling;
    }
  }
  return { week: extractWeek(weekText), days };
}

function splitTybbleDish(text) {
  const separator = text.search(/\smed\s/i);
  if (separator === -1) return { name: text, description: "" };

  return {
    name: text.slice(0, separator),
    description: text.slice(separator + 1),
  };
}

function parseRestaurant29(html) {
  const document = parseHtml(html);
  const lunchSection = document.querySelector("section#lunch");
  const menuRoot = lunchSection?.querySelector(".lunch_menu");
  if (!lunchSection || !menuRoot) throw new Error("29ans meny hittades inte i sidans lunchsektion.");

  const dishes = [...menuRoot.querySelectorAll("ul.myul > li, .myul > li")].map((item) => {
    const parts = [...item.querySelectorAll(":scope > span")].map((span) => cleanText(span.textContent));
    return {
      name: parts[0] || cleanText(item.textContent),
      description: parts[1] || "",
      price: (parts[2] || "").replace(/^[-–]\s*/, ""),
    };
  }).filter((dish) => dish.name);

  const days = emptyDays();
  for (const day of WEEKDAYS) days[day] = dishes.map((dish) => ({ ...dish }));
  return { week: extractWeek(menuRoot.querySelector("h1")?.textContent), days };
}

function parseParken(html) {
  const document = parseHtml(html);
  const sheet = document.querySelector("section.lunch-week-sheet");
  if (!sheet) throw new Error("Parkens meny hittades inte i sidans lunchsektion.");

  const days = emptyDays();
  for (const dayElement of sheet.querySelectorAll(".lunch-day")) {
    const heading = cleanText(dayElement.querySelector("h3")?.textContent);
    const day = WEEKDAYS.find((candidate) => sameDay(heading, candidate));
    if (!day) continue;

    for (const item of dayElement.querySelectorAll("ol > li")) {
      days[day].push({
        name: sentenceCase(cleanText(item.querySelector("strong")?.textContent || item.textContent)),
        description: cleanText(item.querySelector("span")?.textContent),
      });
    }

    const vegetarian = dayElement.querySelector(".vegetarian-lunch p");
    if (vegetarian) {
      const name = cleanText(vegetarian.querySelector("strong")?.textContent);
      const fullText = cleanText(vegetarian.textContent);
      days[day].push({
        name: sentenceCase(name || fullText),
        description: name ? cleanText(fullText.slice(name.length)) : "",
        vegetarian: true,
      });
    }
  }
  return {
    week: extractWeek(sheet.querySelector(".lunch-sheet-header h2")?.textContent),
    days,
  };
}

function parseHtml(html) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, style, noscript").forEach((element) => element.remove());
  return document;
}

function emptyDays() {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, []]));
}

function sameDay(value, day) {
  return cleanText(value).toLocaleLowerCase("sv-SE") === day.toLocaleLowerCase("sv-SE");
}

function cleanText(value = "") {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function sentenceCase(value) {
  if (!value) return "";
  const lowerCase = value.toLocaleLowerCase("sv-SE");
  return lowerCase.charAt(0).toLocaleUpperCase("sv-SE") + lowerCase.slice(1);
}

function extractWeek(value = "") {
  return value.match(/(?:v(?:ecka)?\.?\s*)?(\d{1,2})/i)?.[1] || "";
}

function validateMenu(menu) {
  const dishCount = WEEKDAYS.reduce((count, day) => count + (menu.days?.[day]?.length || 0), 0);
  if (!menu.days || dishCount === 0) throw new Error("Menyn var tom eller hade ett oväntat format.");
  return menu;
}

function saveCache(id, menu) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(menu));
  } catch {
    // The live menu still works if storage is disabled or full.
  }
}

function readCache(id) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${id}`));
    return cached ? validateMenu(cached) : null;
  } catch {
    return null;
  }
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function friendlyError(error) {
  if (error?.name === "AbortError") return "Hämtningen tog för lång tid. Prova igen eller öppna originalmenyn.";
  if (error instanceof TypeError) return "Kunde inte nå menyservern. CORS-proxyn kan vara tillfälligt nere.";
  return error?.message || "Ett okänt fel inträffade.";
}
