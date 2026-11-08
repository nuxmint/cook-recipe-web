"use strict";

// The published site runs this same file read-only, from data/recipes.json instead of the Mac server.
const PUBLISHED = document.documentElement.dataset.mode === "published";
const SERVINGS = [1, 2];
const LOOSE = "loose"; // The tab for ingredients whose serving the video never stated.
const MIN_ROWS = 4;
// Suggestions only: the 보조(단위) cell accepts any text.
const COUNTED_UNITS = [["pc", "pcs"], ["Tbs", "Tbs"], ["ts", "ts"], ["cup", "cups"], ["pinch", "pinches"], ["handful", "handfuls"], ["clove", "cloves"]];
const OTHER_UNITS = ["통", "바퀴", "조각", "spoon", "bunch", "sheet", "block", "drop", "g", "ml"];
const RECENT_COUNT = 8;
const app = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
// The dashboard shows dishes or prep items. A prep item has batch tables instead of serving tabs.
const KIND_NAMES = { menu: "메뉴", prep: "프렙" };
// The switch itself is English by the user's choice; headings such as "내 메뉴" keep KIND_NAMES.
const KIND_LABELS = { menu: "Menu", prep: "Prep" };
const INFO_FIELDS = [["yield_text", "완성량"], ["storage_method", "보관 방법"], ["storage_period", "보관 기간"]];
const state = {
  guides: { menu: "", prep: "" }, categories: [], recipe: null, recipes: [],
  kind: "menu", filter: "all", category: "all", query: "", highlightId: null,
  tab: 1, dirty: false, saveFailed: false, timer: null, queue: Promise.resolve(),
};

/* Fixed artwork and icons. These strings are constants, never user text. */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  pot: '<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M2.5 10h19"/><path d="M9 6.5c0-1.5 1-1.5 1-3M14 6.5c0-1.5 1-1.5 1-3"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 21H19v-3"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  people: '<circle cx="9" cy="8.5" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.5 14.5a5 5 0 0 1 4.5 5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  link: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  power: '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
};
const POT_ART = `<svg viewBox="0 0 200 130" aria-hidden="true">
  <g fill="none" stroke="#fffdf8" stroke-opacity=".75" stroke-width="4.5" stroke-linecap="round">
    <path d="M78 34c-7-7 7-12 0-20"/><path d="M100 30c-7-7 7-12 0-20"/><path d="M122 34c-7-7 7-12 0-20"/></g>
  <ellipse cx="100" cy="122" rx="74" ry="5.5" fill="#26291f" fill-opacity=".14"/>
  <rect x="30" y="58" width="24" height="9" rx="4.5" fill="#2f3a24"/>
  <rect x="146" y="58" width="24" height="9" rx="4.5" fill="#2f3a24"/>
  <path d="M46 50h108v48a22 22 0 0 1-22 22H68a22 22 0 0 1-22-22z" fill="#c23f26"/>
  <path d="M46 50h108v12H46z" fill="#a03220"/>
  <rect x="40" y="44" width="120" height="10" rx="5" fill="#fffdf8"/>
  <circle cx="72" cy="42" r="9" fill="#c23f26"/><circle cx="102" cy="40" r="7" fill="#e9b949"/><circle cx="128" cy="42" r="8" fill="#6d8a48"/></svg>`;
const JAR_ART = `<svg viewBox="0 0 200 130" aria-hidden="true">
  <ellipse cx="100" cy="122" rx="56" ry="5.5" fill="#26291f" fill-opacity=".14"/>
  <rect x="72" y="9" width="56" height="18" rx="5" fill="#2f3a24"/>
  <rect x="76" y="27" width="48" height="7" rx="3" fill="#fffdf8" fill-opacity=".85"/>
  <path d="M66 34h68v72a16 16 0 0 1-16 16H82a16 16 0 0 1-16-16z" fill="#fffdf8"/>
  <path d="M66 64h68v42a16 16 0 0 1-16 16H82a16 16 0 0 1-16-16z" fill="#c23f26"/>
  <path d="M66 64c12 6 22-4 34 2s22 2 34-2v8H66z" fill="#a03220"/>
  <rect x="80" y="76" width="40" height="24" rx="4" fill="#e9b949"/>
  <path d="M92 92c4-8 12-10 16-10-1 6-6 11-16 10z" fill="#2f3a24"/></svg>`;

function fromMarkup(markup) {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  return template.content.firstChild;
}

function icon(name) {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`);
}

function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === "class") element.className = value;
    else if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else if (key in element && key !== "list") element[key] = value;
    else element.setAttribute(key, value);
  }
  element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return element;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "요청을 처리하지 못했습니다");
  return body;
}

function sendJson(method, value) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}

function toast(message, duration = 2200) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), duration);
}

/* ---------- saving ---------- */

function setSaveState(text) {
  const element = document.getElementById("save-state");
  if (element) element.textContent = text;
}

function changed() {
  state.dirty = true;
  setSaveState("저장 중…");
  clearTimeout(state.timer);
  state.timer = setTimeout(save, 500);
}

function save() {
  clearTimeout(state.timer);
  if (!state.dirty || !state.recipe) return state.queue;
  state.dirty = false;
  const snapshot = JSON.stringify(state.recipe);
  const { id } = state.recipe;
  state.queue = state.queue.then(async () => {
    try {
      const saved = await api(`/api/recipes/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: snapshot,
      });
      state.saveFailed = false;
      if (state.recipe && state.recipe.id === id) state.recipe.md_name = saved.md_name;
      if (!state.dirty) setSaveState(`저장됨 · recipes/${saved.md_name}`);
      await loadRecipes();
      if (state.recipe && state.recipe.id === id) renderSidebar(id);
    } catch (error) {
      state.saveFailed = true;
      setSaveState(`저장 실패: ${error.message}`);
    }
  });
  return state.queue;
}

window.addEventListener("beforeunload", () => {
  if (state.dirty && state.recipe) {
    fetch(`/api/recipes/${state.recipe.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.recipe), keepalive: true,
    });
  }
});

/* ---------- data source ---------- */

async function fetchPublished() {
  const response = await fetch("data/recipes.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("레시피를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
  return response.json();
}

async function readSetup() {
  if (PUBLISHED) return { guides: { menu: "", prep: "" }, categories: (await fetchPublished()).categories || [] };
  const [guide, categories] = await Promise.all([api("/api/guide"), api("/api/categories")]);
  return { guides: { menu: guide.text, prep: guide.prep }, categories };
}

async function readRecipes() {
  return PUBLISHED ? (await fetchPublished()).recipes : api("/api/recipes");
}

async function readRecipe(id) {
  if (!PUBLISHED) return api(`/api/recipes/${id}`);
  const recipe = state.recipes.find((item) => item.id === Number(id));
  if (!recipe) throw new Error("레시피를 찾을 수 없습니다.");
  return recipe;
}

/* ---------- shared recipe list ---------- */

async function loadRecipes() {
  state.recipes = await readRecipes();
}

function isPrep(recipe) {
  return recipe.kind === "prep";
}

// The same comparison as prep.name_key: spaces and letter case do not count.
function nameKey(name) {
  return (name || "").replace(/\s+/g, "").toLowerCase();
}

// Which prep each ingredient name stands for, worked out like storage._prep_ids:
// a prep's own name comes before its other names, and the older prep wins a tie.
function prepIndex() {
  if (prepIndex.source === state.recipes) return prepIndex.map;
  const preps = state.recipes.filter(isPrep).sort((a, b) => a.id - b.id);
  const map = new Map();
  const add = (name, prep) => {
    const key = nameKey(name);
    if (key && !map.has(key)) map.set(key, prep);
  };
  preps.forEach((prep) => add(prep.menu_name, prep));
  preps.forEach((prep) => (prep.aliases || []).forEach((alias) => add(alias, prep)));
  prepIndex.source = state.recipes;
  prepIndex.map = map;
  return map;
}

function linkedPrep(name) {
  const prep = prepIndex().get(nameKey(name));
  return prep && prep.id !== state.recipe.id ? prep : null;
}

// Korean particles follow the last syllable: 을/를, 과/와, 이/가, and 으로/로, where ㄹ also takes 로.
function josa(word, withFinal, withoutFinal) {
  const code = (word || "").trim().slice(-1).charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code < 11172)) return withoutFinal;
  const final = code % 28;
  return final && !(withFinal === "으로" && final === 8) ? withFinal : withoutFinal;
}

// Enter that finishes a Korean syllable is not a submit. Safari reports it as key code 229.
function composing(event) {
  return event.isComposing || event.keyCode === 229;
}

// A prep item has no serving to settle, but it waits for review until it has a category.
function needsAttention(recipe) {
  return recipe.blank_count > 0 || recipe.loose_count > 0 || recipe.portion_count === 0 || (isPrep(recipe) && !recipe.category);
}

function renderSidebar(activeId) {
  const recent = state.recipes.slice(0, RECENT_COUNT);
  const parts = [
    h("a", { class: "brand", href: "#/" }, h("span", { class: "brand-mark" }, icon("pot")), PUBLISHED ? "Cook Note" : "Cook Recipe Note"),
    PUBLISHED ? null : h("button", { class: "new-button", onclick: openNewDialog }, icon("plus"), "New Recipe"),
    h("nav", { class: "side-nav" },
      h("a", { class: `side-link ${activeId ? "" : "active"}`, href: "#/" }, icon("grid"), "Dashboard")),
    h("p", { class: "side-title" }, "Recent Recipes"),
    h("div", { class: "side-list" }, recent.length
      ? recent.map((recipe) => h("a", {
        class: `side-link ${recipe.id === activeId ? "active" : ""}`, href: `#/recipe/${recipe.id}`,
      }, h("span", { class: `side-dot ${isPrep(recipe) ? "prep" : ""} ${!PUBLISHED && needsAttention(recipe) ? "warn" : ""}` }),
      h("span", { class: "side-name" }, recipe.menu_name || (isPrep(recipe) ? "프렙명 미확인" : "메뉴명 미확인"))))
      : h("p", { class: "side-empty" }, "아직 없습니다")),
    PUBLISHED ? null : h("button", { class: "publish-button", onclick: publishSite }, icon("phone"), "Publish to Phone"),
    PUBLISHED ? null : h("button", { class: "quit-button", onclick: quitApp }, icon("power"), "Quit App"),
  ];
  sidebar.replaceChildren(...parts.filter(Boolean));
}

async function quitApp() {
  if (document.querySelector(".publish-button").disabled) {
    toast("게시가 끝난 뒤에 종료해 주세요.");
    return;
  }
  await save();
  if (state.saveFailed) {
    toast("저장하지 못한 내용이 있어 종료하지 않았습니다. 내용을 확인해 주세요.", 5000);
    return;
  }
  try {
    await api("/api/quit", { method: "POST" });
  } catch (error) {
    // No reply at all means the server is already off, as in a tab left open from earlier.
    if (!(error instanceof TypeError)) {
      toast(error.message, 5000);
      return;
    }
  }
  document.title = "Cook Recipe Note 종료됨";
  document.getElementById("toast").classList.remove("show");
  document.querySelector(".shell").replaceChildren(h("main", { class: "quit-page" },
    h("h1", {}, "레시피 앱을 종료했습니다"),
    h("p", { class: "muted" }, "이 탭은 닫으셔도 됩니다. 다시 쓰려면 Cook Note 앱을 실행하세요.")));
}

async function publishSite(event) {
  const button = event.currentTarget;
  if (!confirm("현재 레시피 전체를 공개 사이트에 올릴까요? 주소를 아는 사람은 누구나 볼 수 있습니다.")) return;
  button.disabled = true;
  try {
    await save();
    const { message } = await api("/api/publish", { method: "POST" });
    toast(message, 7000);
  } catch (error) {
    toast(error.message, 9000);
  } finally {
    button.disabled = false;
  }
}

/* ---------- dashboard ---------- */

const TILES = [
  { key: "all", label: "전체 메뉴", icon: "book", match: () => true },
  { key: "one", label: "1인분", icon: "person", match: (r) => r.servings.includes(1) },
  { key: "two", label: "2인분", icon: "people", match: (r) => r.servings.includes(2) },
  { key: "review", label: "확인 필요", icon: "alert", match: needsAttention },
].filter((item) => !PUBLISHED || item.key !== "review");

function renderDashboard() {
  document.title = PUBLISHED ? "Cook Note" : "Cook Recipe Dashboard";
  const content = h("div", { class: "content" });
  app.replaceChildren(content);
  if (!state.recipes.length) {
    content.append(
      h("div", { class: "page-head" }, h("div", {}, h("h1", {}, PUBLISHED ? "Cook Note" : "Dashboard"))),
      h("div", { class: "empty" },
        h("div", { class: "art" }, fromMarkup(POT_ART)),
        h("h2", {}, PUBLISHED ? "아직 게시된 레시피가 없습니다" : "첫 레시피를 만들어 보세요"),
        h("p", {}, PUBLISHED
          ? "Mac 앱에서 '휴대폰에 게시'를 누르면 레시피가 이곳에 나타납니다."
          : "Gemini 요약을 넣으면 서식이 자동으로 채워지고, 레시피가 이곳에 카드로 나타납니다."),
        PUBLISHED ? null : h("button", { class: "button primary", onclick: openNewDialog }, icon("plus"), "새 레시피 작성")));
    return;
  }
  const switcher = h("div", { class: "kind-switch", role: "group", "aria-label": "메뉴와 프렙" });
  const tiles = h("div");
  const list = h("div");
  const paint = () => {
    switcher.replaceChildren(...["menu", "prep"].map(kindOption));
    tiles.className = state.kind === "prep" ? "chips" : "tiles";
    tiles.replaceChildren(...(state.kind === "prep" ? prepChips() : TILES.map(tile)));
    list.replaceChildren(...recipeSection());
  };
  renderDashboard.paint = paint;
  content.append(
    h("div", { class: "page-head" },
      h("div", {}, h("h1", {}, PUBLISHED ? "Cook Note" : "Dashboard"),
        h("p", { class: "muted" }, PUBLISHED ? "게시한 레시피를 확인하세요" : "저장한 레시피를 한눈에 확인하세요")),
      h("label", { class: "search" }, icon("search"), h("input", {
        type: "search", placeholder: "이름, 채널 검색", "aria-label": "레시피 검색", value: state.query,
        oninput: (event) => { state.query = event.target.value; paint(); },
      }))),
    switcher, tiles, list);
  paint();
  const fresh = list.querySelector(".is-new");
  if (fresh) fresh.scrollIntoView({ block: "center", behavior: "smooth" });
}

function ofKind(kind) {
  return state.recipes.filter((recipe) => (isPrep(recipe) ? "prep" : "menu") === kind);
}

function kindOption(kind) {
  return h("button", {
    class: "kind-option", "aria-pressed": String(state.kind === kind),
    onclick: () => {
      state.kind = kind;
      state.filter = "all";
      state.category = "all";
      renderDashboard.paint();
    },
  }, KIND_LABELS[kind], h("span", { class: "kind-count" }, String(ofKind(kind).length)));
}

// Chips for prep items: every category in order, then the ones still waiting for one.
const UNSET = "unset";
const REVIEW = "review";

function prepChoices() {
  const choices = [{ key: "all", label: "전체", match: () => true },
    ...state.categories.map((name) => ({ key: name, label: name, match: (r) => r.category === name }))];
  if (ofKind("prep").some((r) => !r.category)) choices.push({ key: UNSET, label: "분류 미지정", match: (r) => !r.category });
  if (!PUBLISHED) choices.push({ key: REVIEW, label: "확인 필요", match: needsAttention });
  return choices;
}

function prepChips() {
  return prepChoices().map((choice) => h("button", {
    class: `chip ${choice.key === REVIEW || choice.key === UNSET ? "review" : ""}`,
    "aria-pressed": String(state.category === choice.key),
    onclick: () => { state.category = state.category === choice.key ? "all" : choice.key; renderDashboard.paint(); },
  }, choice.label, h("span", { class: "chip-count" }, String(ofKind("prep").filter(choice.match).length))));
}

function tile(item) {
  return h("button", {
    class: `tile ${item.key === "review" ? "review" : ""}`,
    "aria-pressed": String(state.filter === item.key),
    onclick: () => { state.filter = state.filter === item.key ? "all" : item.key; renderDashboard.paint(); },
  },
  h("span", { class: "tile-icon" }, icon(item.icon)),
  h("span", {},
    h("span", { class: "tile-label" }, item.label),
    h("span", { class: "tile-value" }, String(ofKind("menu").filter(item.match).length))));
}

function currentChoice() {
  if (state.kind === "menu") return TILES.find((item) => item.key === state.filter);
  return prepChoices().find((item) => item.key === state.category) || prepChoices()[0];
}

function visibleRecipes() {
  const { match } = currentChoice();
  const query = state.query.trim().toLowerCase();
  return ofKind(state.kind).filter((recipe) => match(recipe)
    && `${recipe.menu_name || ""} ${recipe.channel || ""} ${(recipe.aliases || []).join(" ")}`.toLowerCase().includes(query));
}

function recipeSection() {
  const recipes = visibleRecipes();
  const choice = currentChoice();
  const empty = !ofKind(state.kind).length && state.kind === "prep"
    ? (PUBLISHED ? "아직 게시된 프렙이 없습니다." : "아직 프렙이 없습니다. 새 레시피 작성에서 프렙 안내문을 쓰거나 빈 프렙 서식으로 시작하세요.")
    : "조건에 맞는 레시피가 없습니다.";
  return [
    h("div", { class: "section-head" }, h("h2", {}, choice.key === "all" ? `내 ${KIND_NAMES[state.kind]}` : choice.label),
      h("span", { class: "muted" }, `${recipes.length}개`)),
    recipes.length
      ? h("div", { class: "cards" }, recipes.map((recipe) => (isPrep(recipe) ? prepCard(recipe) : card(recipe))))
      : h("p", { class: "no-result" }, empty),
  ];
}

function servingTags(recipe) {
  const tags = recipe.servings.map((serving) => h("span", { class: "tag" }, `${serving}인분`));
  if (recipe.loose_count) tags.push(h("span", { class: "tag loose" }, "인분 미지정"));
  return tags.length ? h("div", { class: "tags" }, tags) : null;
}

function statusOf(recipe) {
  if (recipe.portion_count === 0) return h("span", { class: "status draft" }, icon("pencil"), "작성 중");
  const parts = [];
  if (recipe.blank_count) parts.push(`빈칸 ${recipe.blank_count}`);
  if (recipe.loose_count) parts.push("인분 확인");
  if (isPrep(recipe) && !recipe.category) parts.push("분류 미지정");
  return parts.length
    ? h("span", { class: "status warn" }, icon("alert"), parts.join(" · "))
    : h("span", { class: "status good" }, icon("check"), "빈칸 없음");
}

function timeAgo(text) {
  const minutes = Math.floor((Date.now() - new Date(text).getTime()) / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 43200) return `${Math.floor(minutes / 1440)}일 전`;
  return text.slice(0, 10);
}

function card(recipe) {
  const art = h("div", { class: "art" }, recipe.photo ? h("img", { src: recipe.photo, alt: "" }) : fromMarkup(POT_ART));
  const isNew = recipe.id === state.highlightId;
  if (isNew) art.append(h("span", { class: "new-tag" }, "방금 추가"));
  return h("a", { class: `card ${isNew ? "is-new" : ""}`, href: `#/recipe/${recipe.id}` },
    art,
    h("div", { class: "card-body" },
      h("div", { class: "card-title" }, recipe.menu_name || "메뉴명 미확인"),
      recipe.channel ? h("div", { class: "card-channel" }, recipe.channel) : null,
      servingTags(recipe),
      h("div", { class: "card-foot" }, PUBLISHED ? null : statusOf(recipe), h("span", {}, timeAgo(recipe.updated_at)))));
}

function prepCard(recipe) {
  const art = h("div", { class: "art" }, recipe.photo ? h("img", { src: recipe.photo, alt: "" }) : fromMarkup(JAR_ART));
  const isNew = recipe.id === state.highlightId;
  if (isNew) art.append(h("span", { class: "new-tag" }, "방금 추가"));
  return h("a", { class: `card ${isNew ? "is-new" : ""}`, href: `#/recipe/${recipe.id}` },
    art,
    h("div", { class: "card-body" },
      h("div", { class: "card-title" }, recipe.menu_name || "프렙명 미확인"),
      recipe.channel ? h("div", { class: "card-channel" }, recipe.channel) : null,
      h("div", { class: "tags" }, h("span", { class: `tag ${recipe.category ? "prep" : "loose"}` }, recipe.category || "분류 미지정")),
      h("div", { class: "card-foot" }, PUBLISHED ? null : statusOf(recipe), h("span", {}, timeAgo(recipe.updated_at)))));
}

function goToDashboard() {
  if (location.hash === "#/" || location.hash === "") route();
  else location.hash = "#/";
}

/* ---------- new recipe ---------- */

const newDialog = document.getElementById("new-dialog");
const newText = document.getElementById("new-text");
const newError = document.getElementById("new-error");
const newGuide = document.getElementById("new-guide");
const newPrepGuide = document.getElementById("new-prep-guide");
const GUIDE_LABELS = { menu: "메뉴 안내문 복사", prep: "프렙 안내문 복사" };
// Only the new-recipe window is English; the Gemini 원문 window keeps GUIDE_LABELS.
const NEW_GUIDE_LABELS = { menu: "Copy Menu Prompt", prep: "Copy Prep Prompt" };

function showNewError(message) {
  newError.textContent = message;
  newError.hidden = !message;
}

function openNewDialog() {
  newText.value = "";
  showNewError("");
  newGuide.textContent = NEW_GUIDE_LABELS.menu;
  newPrepGuide.textContent = NEW_GUIDE_LABELS.prep;
  newDialog.showModal();
}

async function submitNew() {
  try {
    const recipe = await api("/api/recipes", sendJson("POST", { text: newText.value }));
    newDialog.close();
    state.highlightId = recipe.id;
    state.kind = isPrep(recipe) ? "prep" : "menu";
    state.filter = "all";
    state.category = "all";
    state.query = "";
    const name = recipe.menu_name || "메뉴명 미확인";
    toast(recipe.free_form
      ? `'${name}'를 추가했습니다. 카드를 열어 비어 있는 칸을 채워 주세요.`
      : `'${name}' 레시피를 대시보드에 추가했습니다.`);
    goToDashboard();
  } catch (error) {
    showNewError(error.message);
  }
}

// Safari only allows the copy if it starts directly from the click, so both texts are loaded beforehand.
async function copyGuide(kind = "menu") {
  try {
    await navigator.clipboard.writeText(state.guides[kind]);
    return "복사했습니다. Gemini에 붙여넣고 맨 아래에 YouTube 주소를 넣으세요.";
  } catch {
    return "복사하지 못했습니다. 다시 눌러 주세요.";
  }
}

async function readFile(file) {
  newText.value = await file.text();
  await submitNew();
}

// The published page has none of these elements.
function wireEditor() {
  // Inside the dialog a toast would be hidden behind it, so the link itself answers.
  newGuide.addEventListener("click", async () => {
    newGuide.textContent = await copyGuide("menu");
  });
  newPrepGuide.addEventListener("click", async () => {
    newPrepGuide.textContent = await copyGuide("prep");
  });
  document.getElementById("new-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitNew();
  });
  document.getElementById("new-cancel").addEventListener("click", () => newDialog.close());
  document.getElementById("new-file").addEventListener("change", (event) => {
    if (event.target.files[0]) readFile(event.target.files[0]);
    event.target.value = "";
  });
  const startBlank = async (kind) => {
    const recipe = await api("/api/recipes/blank", sendJson("POST", { kind }));
    newDialog.close();
    location.hash = `#/recipe/${recipe.id}`;
  };
  document.getElementById("new-blank").addEventListener("click", () => startBlank("menu"));
  document.getElementById("new-prep-blank").addEventListener("click", () => startBlank("prep"));
  newText.addEventListener("dragover", (event) => {
    event.preventDefault();
    newText.classList.add("dragging");
  });
  newText.addEventListener("dragleave", () => newText.classList.remove("dragging"));
  newText.addEventListener("drop", (event) => {
    event.preventDefault();
    newText.classList.remove("dragging");
    if (event.dataTransfer.files[0]) readFile(event.dataTransfer.files[0]);
  });
  const rawDialog = document.getElementById("raw-dialog");
  const rawGuide = document.getElementById("raw-guide");
  rawGuide.addEventListener("click", async () => {
    rawGuide.textContent = await copyGuide("menu");
  });
  const rawPrepGuide = document.getElementById("raw-prep-guide");
  rawPrepGuide.addEventListener("click", async () => {
    rawPrepGuide.textContent = await copyGuide("prep");
  });
  document.getElementById("raw-close").addEventListener("click", () => rawDialog.close());
  document.getElementById("raw-edit").addEventListener("click", editRaw);
  document.getElementById("raw-cancel").addEventListener("click", () => {
    if (state.recipe.raw_text) setRawEditing(false);
    else rawDialog.close();
  });
  document.getElementById("raw-apply").addEventListener("click", applyRaw);
  document.getElementById("raw-undo").addEventListener("click", undoRaw);
  document.getElementById("aux-options").replaceChildren(
    ...[
      ...COUNTED_UNITS.flatMap(([one, many]) => [`1 ${one}`, `2 ${many}`, `3 ${many}`]),
      "1/2 ts", "1/2 Tbs", "1/2 cup", "1/2 통",
      ...COUNTED_UNITS.map(([one]) => one),
      ...OTHER_UNITS,
    ].map((value) => h("option", { value })),
  );
}

/* ---------- recipe sheet ---------- */

async function showRecipe(id) {
  try {
    state.recipe = await readRecipe(id);
  } catch (error) {
    app.replaceChildren(h("p", { class: "error" }, error.message), h("a", { href: "#/" }, "Dashboard"));
    return;
  }
  chooseTab();
  renderRecipe();
}

function loosePortions() {
  return state.recipe.portions.filter((portion) => !portion.serving);
}

function findPortion(serving) {
  return state.recipe.portions.find((portion) => portion.serving === serving);
}

function usedTabs() {
  const used = SERVINGS.filter(findPortion);
  return loosePortions().length ? [LOOSE, ...used] : used;
}

function chooseTab() {
  const used = usedTabs();
  state.tab = used.find((tab) => tab !== LOOSE) || used[0] || SERVINGS[0];
}

function tabName(tab) {
  return tab === LOOSE ? "인분 미지정" : `${tab}인분`;
}

function renderPublishedRecipe() {
  const { recipe } = state;
  const link = /^https?:\/\//.test(recipe.source_url || "")
    ? h("a", { class: "button", href: recipe.source_url, target: "_blank", rel: "noreferrer" }, icon("link"), "출처 영상")
    : null;
  app.replaceChildren(h("div", { class: "recipe-page" },
    h("div", { class: "recipe-head" },
      h("a", { class: "button", href: "#/" }, icon("back"), "목록"),
      recipe.channel ? h("span", { class: "muted" }, recipe.channel) : null,
      h("span", { class: "spacer" }),
      link),
    isPrep(recipe) ? prepSheet(true) : sheet(state.tab, true)));
}

function renderRecipe() {
  const { recipe } = state;
  closePop();
  document.title = recipe.menu_name || (isPrep(recipe) ? "프렙" : "레시피");
  if (state.tab === LOOSE && !loosePortions().length) chooseTab();
  if (PUBLISHED) {
    renderPublishedRecipe();
    return;
  }
  const link = /^https?:\/\//.test(recipe.source_url || "")
    ? h("a", { class: "button", href: recipe.source_url, target: "_blank", rel: "noreferrer" }, icon("link"), "영상 열기")
    : null;
  app.replaceChildren(h("div", { class: "recipe-page" },
    h("div", { class: "recipe-head" },
      h("a", { class: "button", href: "#/" }, icon("back"), "Dashboard"),
      h("span", { id: "save-state" }, recipe.md_name ? `저장됨 · recipes/${recipe.md_name}` : ""),
      h("span", { class: "spacer" }),
      h("button", { class: "button", onclick: showRaw }, icon("file"), "Gemini 원문"),
      h("button", { class: "button", onclick: printRecipe }, icon("printer"), "인쇄/PDF"),
      h("button", { class: "button danger", onclick: deleteRecipe }, icon("trash"), "삭제")),
    h("div", { class: "meta" },
      field("source_url", "출처 YouTube 주소"), link, field("channel", "채널")),
    isPrep(recipe) ? prepSheet(false) : sheet(state.tab, false),
    freeFormPanel(),
    unreadPanel()));
  document.querySelectorAll("#app textarea").forEach(grow);
}

function field(key, placeholder) {
  return h("input", {
    value: state.recipe[key] || "", placeholder,
    oninput: (event) => { state.recipe[key] = event.target.value; changed(); },
  });
}

function grow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

// tab is what the table shows; null means every table at once, for printing.
function sheet(tab, readonly) {
  const { recipe } = state;
  return h("section", { class: "sheet" },
    h("div", { class: "title-row" },
      readonly
        ? h("h1", {}, recipe.menu_name || "메뉴명 미확인")
        : h("input", {
          value: recipe.menu_name || "", placeholder: "메뉴명 입력", "aria-label": "메뉴명",
          oninput: (event) => { recipe.menu_name = event.target.value; changed(); },
        })),
    tab ? tabs(tab) : null,
    bodyRow(tab, readonly),
    !readonly || recipe.steps.length ? [h("h2", { class: "section-title" }, "제조방법"), stepsArea(readonly)] : null,
    !readonly || recipe.memo ? [h("h2", { class: "section-title" }, "메모"), memoArea(readonly)] : null);
}

function bodyRow(tab, readonly) {
  const picture = photo(readonly);
  const tables = tab ? slotsOf(tab).map((slot) => portionTable(slot, readonly, false))
    : usedTabs().flatMap(slotsOf).map((slot) => portionTable(slot, true, true));
  return h("div", { class: `body-row ${picture ? "" : "no-photo"}` }, picture, h("div", { class: "tables" }, tables));
}

function tabs(active) {
  const shown = PUBLISHED ? usedTabs() : [...(loosePortions().length ? [LOOSE] : []), ...SERVINGS];
  if (!shown.length) return null;
  return h("div", { class: "tabs" }, shown.map((tab) =>
    h("button", {
      class: `tab ${tab === LOOSE ? "loose" : ""} ${tab === active ? "active" : ""}`,
      "aria-pressed": String(tab === active),
      onclick: () => { state.tab = tab; renderRecipe(); },
    }, tabName(tab))));
}

/* ---------- prep sheet ---------- */

// A prep item's sheet: no serving tabs, just its info line and batch tables, then where it is used.
function prepSheet(readonly) {
  const { recipe } = state;
  return h("section", { class: "sheet prep-sheet" },
    h("div", { class: "title-row" },
      h("span", { class: "eyebrow" }, "프렙"),
      readonly
        ? h("h1", {}, recipe.menu_name || "프렙명 미확인")
        : h("input", {
          value: recipe.menu_name || "", placeholder: "프렙명 입력", "aria-label": "프렙명",
          oninput: (event) => { recipe.menu_name = event.target.value; changed(); },
        }),
      readonly ? aliasLine() : aliasRow()),
    prepInfo(readonly),
    prepBody(readonly),
    !readonly || recipe.steps.length ? [h("h2", { class: "section-title" }, "제조방법"), stepsArea(readonly)] : null,
    usedIn(),
    !readonly || recipe.memo ? [h("h2", { class: "section-title" }, "메모"), memoArea(readonly)] : null);
}

// Other names the prep goes by in menus, like 만능 간장 for 만능 간장소스. They are typed here or come from a
// menu's [+프렙], never from a Gemini answer, so refilling and undo leave them alone.
function aliasLine() {
  const aliases = state.recipe.aliases || [];
  return aliases.length ? h("div", { class: "alias-line" }, `다른 이름 · ${aliases.join(", ")}`) : null;
}

function aliasRow() {
  const recipe = state.recipe;
  const input = h("input", { class: "alias-input", placeholder: "다른 이름 입력 후 Enter", "aria-label": "다른 이름 추가" });
  const add = async () => {
    const name = input.value.trim();
    if (!name) return;
    if (await linkPrep(recipe, name)) {
      const next = document.querySelector(".alias-input");
      if (next) next.focus();
    }
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !composing(event)) {
      event.preventDefault();
      add();
    }
  });
  return h("div", { class: "alias-row" },
    h("div", { class: "alias-label" }, "다른 이름"),
    h("div", { class: "alias-list" },
      (recipe.aliases || []).map((name) => h("span", { class: "alias-chip" }, name, h("button", {
        type: "button", class: "alias-remove", title: `'${name}' 빼기`, "aria-label": `${name} 빼기`,
        onclick: () => unlinkPrep(recipe, name),
      }, "×"))),
      input,
      h("button", { type: "button", class: "button small", onclick: add }, "추가")));
}

// Only what the video said is kept here, so the phone hides an empty field instead of showing a blank.
function prepInfo(readonly) {
  const { recipe } = state;
  if (readonly) {
    const shown = [["분류", recipe.category || (PUBLISHED ? null : "미지정")],
      ...INFO_FIELDS.map(([key, title]) => [title, recipe[key]])].filter(([, value]) => value || !PUBLISHED);
    if (!shown.length) return null;
    return h("div", { class: `prep-info cols-${shown.length}` }, shown.map(([title, value]) =>
      h("div", {}, h("span", { class: "info-label" }, title), h("span", { class: "info-value" }, value || ""))));
  }
  const select = h("select", {
    "aria-label": "분류",
    onchange: () => {
      recipe.category = select.value || null;
      select.parentElement.classList.toggle("unset", !recipe.category);
      changed();
    },
  },
  h("option", { value: "", selected: !recipe.category }, "분류 미지정"),
  state.categories.map((name) => h("option", { value: name, selected: recipe.category === name }, name)));
  return h("div", { class: "prep-info" },
    h("div", { class: recipe.category ? "" : "unset" }, h("span", { class: "info-label" }, "분류"), select),
    INFO_FIELDS.map(([key, title]) => h("div", {}, h("span", { class: "info-label" }, title), h("input", {
      value: recipe[key] || "", placeholder: "미확인", "aria-label": title,
      oninput: (event) => { recipe[key] = event.target.value; changed(); },
    }))));
}

function prepBody(readonly) {
  const picture = photo(readonly);
  const batches = state.recipe.portions;
  const slots = batches.length ? batches.map(batchSlot) : [batchSlot(null)];
  return h("div", { class: `body-row ${picture ? "" : "no-photo"}` }, picture,
    h("div", { class: "tables" }, slots.map((slot) => portionTable(slot, readonly, false))));
}

// One slot per batch. A blank prep gets one empty slot that becomes a batch when typed into.
function batchSlot(portion) {
  const slot = {
    label: "배합",
    find: () => portion || state.recipe.portions[0],
    make: () => {
      const made = { serving: null, label: null, note: null, ingredients: [] };
      state.recipe.portions.push(made);
      return made;
    },
    // The batch basis is the video's own words, such as "간장 1컵 기준". Nothing is scaled from it.
    head: (found, readonly) => {
      const label = found ? found.label : null;
      return h("div", { class: "portion-head" },
        h("strong", {}, "배합"),
        readonly
          ? h("span", { class: label ? "" : "original" }, label || "배합 기준 미확인")
          : h("input", {
            class: "batch-label", value: label || "", placeholder: "배합 기준 (예: 간장 1컵 기준)", "aria-label": "배합 기준",
            oninput: (event) => { (slot.find() || slot.make()).label = event.target.value; changed(); },
          }));
    },
  };
  return slot;
}

function useWhere(use) {
  if (use.kind === "prep") return "프렙";
  return use.serving ? `${use.serving}인분` : "인분 미지정";
}

// Dishes whose ingredient name is this prep's name or one of its other names, worked out by the Mac app when it loads.
function usedIn() {
  const { recipe } = state;
  const uses = recipe.used_in || [];
  if (PUBLISHED && !uses.length) return null;
  const via = (use) => (use.name && nameKey(use.name) !== nameKey(recipe.menu_name)
    ? `'${use.name}'${josa(use.name, "으로", "로")} 연결` : null);
  return [h("h2", { class: "section-title" }, "이 프렙을 쓰는 메뉴"),
    uses.length
      ? h("ul", { class: "used-in" }, uses.map((use) => h("li", {},
        h("a", { href: `#/recipe/${use.id}` }, use.menu_name || "메뉴명 미확인"),
        h("span", { class: "muted" }, [useWhere(use), use.amount, use.aux, via(use)].filter(Boolean).join(" · ")))))
      : h("p", { class: "used-empty muted" },
        "아직 이 프렙을 재료로 쓰는 메뉴가 없습니다. 메뉴 재료표에서 재료명 옆 [+프렙]을 누르거나, 재료명을 프렙명이나 다른 이름과 똑같이 쓰면 여기에 연결됩니다.")];
}

function photo(readonly) {
  const url = state.recipe.photo;
  if (readonly) return url ? h("div", { class: "photo" }, h("img", { src: url, alt: "완성 사진" })) : null;
  const input = h("input", {
    type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true,
    onchange: () => { if (input.files[0]) uploadPhoto(input.files[0]); },
  });
  const box = h("div", {
    class: `photo ${url ? "" : "is-empty"}`,
    onclick: () => input.click(),
    ondragover: (event) => { event.preventDefault(); box.classList.add("dragging"); },
    ondragleave: () => box.classList.remove("dragging"),
    ondrop: (event) => {
      event.preventDefault();
      box.classList.remove("dragging");
      if (event.dataTransfer.files[0]) uploadPhoto(event.dataTransfer.files[0]);
    },
  }, input, url
    ? [h("img", { src: url, alt: "완성 사진" }),
      h("button", { class: "button small", onclick: (event) => { event.stopPropagation(); removePhoto(); } }, "사진 삭제")]
    : "완성 사진 넣기 (선택)");
  return box;
}

async function uploadPhoto(file) {
  try {
    const { url } = await api(`/api/recipes/${state.recipe.id}/photo`, {
      method: "POST", headers: { "Content-Type": file.type }, body: file,
    });
    state.recipe.photo = url;
    renderRecipe();
  } catch (error) {
    toast(error.message);
  }
}

async function removePhoto() {
  await api(`/api/recipes/${state.recipe.id}/photo`, { method: "DELETE" });
  state.recipe.photo = null;
  renderRecipe();
}

function ensureRow(portion, index) {
  while (portion.ingredients.length <= index) {
    portion.ingredients.push({ name: null, amount: null, aux: null, note: null, evidence: null });
  }
  return portion.ingredients[index];
}

// A slot is one ingredient table: a fixed serving, or ingredients still waiting for one.
function servingSlot(serving) {
  return {
    label: tabName(serving),
    find: () => findPortion(serving),
    make: () => {
      const portion = { serving, label: null, note: null, ingredients: [] };
      state.recipe.portions.push(portion);
      return portion;
    },
  };
}

function looseSlot(portion) {
  return { label: tabName(LOOSE), loose: true, find: () => portion, make: () => portion };
}

function slotsOf(tab) {
  return tab === LOOSE ? loosePortions().map(looseSlot) : [servingSlot(tab)];
}

function portionHead(slot, portion, readonly, printing) {
  if (!slot.loose && !printing && (readonly || !portion)) return null;
  return h("div", { class: `portion-head ${slot.loose ? "loose" : ""}` },
    h("strong", {}, slot.label),
    slot.loose ? h("span", { class: "original" }, `영상 표기 ${portion.label || "미확인"}`) : null,
    slot.loose && portion.note ? h("span", { class: "original" }, portion.note) : null,
    h("span", { class: "spacer" }),
    readonly ? null : moveSelect(portion));
}

function portionTable(slot, readonly, printing) {
  const portion = slot.find();
  const count = portion ? portion.ingredients.length : 0;
  const total = readonly ? count : Math.max(count + 1, MIN_ROWS);
  const rows = [];
  for (let index = 0; index < total; index += 1) rows.push(ingredientRow(slot, index, readonly));
  if (!rows.length) rows.push(h("tr", {}, h("td", { colSpan: 4, class: "no-rows" }, "재료 정보가 없습니다")));
  return h("div", { class: "portion" },
    slot.head ? slot.head(portion, readonly) : portionHead(slot, portion, readonly, printing),
    h("table", { class: "ingredients" },
      h("colgroup", {},
        h("col", { style: "width:27%" }), h("col", { style: "width:17%" }),
        h("col", { style: "width:19%" }), h("col"), readonly ? null : h("col", { style: "width:30px" })),
      h("thead", {}, h("tr", {},
        ["재료명", "분량(단위)", "보조(단위)", "비고"].map((name) => h("th", {}, name)),
        readonly ? null : h("th", { class: "row-end" }))),
      h("tbody", {}, rows)));
}

function moveSelect(portion) {
  const select = h("select", {
    "aria-label": "인분 옮기기",
    onchange: () => {
      if (select.value) movePortion(portion, select.value === "none" ? null : Number(select.value));
    },
  },
  h("option", { value: "", selected: true }, portion.serving ? "옮기기…" : "인분 선택…"),
  SERVINGS.filter((serving) => serving !== portion.serving).map((serving) => h("option", { value: String(serving) }, `${serving}인분으로`)),
  portion.serving ? h("option", { value: "none" }, "미지정으로") : null);
  return select;
}

// Moving changes which tab holds the table; its numbers stay exactly as written.
function movePortion(portion, serving) {
  const other = serving && findPortion(serving);
  if (other && other.ingredients.some(hasContent)) {
    toast("그 인분 칸에는 이미 내용이 있습니다.");
    renderRecipe();
    return;
  }
  if (other) state.recipe.portions.splice(state.recipe.portions.indexOf(other), 1);
  portion.serving = serving;
  portion.note = null;
  state.tab = serving || LOOSE;
  changed();
  renderRecipe();
}

function hasContent(row) {
  return row.name || row.amount || row.aux || row.note;
}

function ingredientRow(slot, index, readonly) {
  const portion = slot.find();
  const row = portion ? portion.ingredients[index] : null;
  if (readonly) {
    return h("tr", {}, ["name", "amount", "aux", "note"].map((key) => h("td", {}, (row && row[key]) || "",
      key === "name" ? prepLink(row) : null)));
  }
  // Many ingredients are counted, like "감자 2개", so a row is blank only with neither quantity.
  const paintBlank = (cells) => {
    const current = slot.find() ? slot.find().ingredients[index] : null;
    const blank = Boolean(current && current.name && !current.amount && !current.aux);
    cells[1].classList.toggle("blank", blank);
    cells[2].classList.toggle("blank", blank);
  };
  const chip = h("span", { class: "chip-slot" });
  const paintChip = () => {
    const current = slot.find() ? slot.find().ingredients[index] : null;
    chip.replaceChildren(...[prepChip(current && current.name)].filter(Boolean));
  };
  const cells = ["name", "amount", "aux", "note"].map((key) => h("td", {}, h(key === "note" ? "textarea" : "input", {
    value: (row && row[key]) || "",
    rows: key === "note" ? 1 : null,
    title: row && row.evidence && (key === "amount" || key === "aux") ? `근거: ${row.evidence}` : "",
    list: key === "aux" ? "aux-options" : null,
    "aria-label": `${slot.label} ${key}`,
    oninput: (event) => {
      ensureRow(slot.find() || slot.make(), index)[key] = event.target.value;
      if (key === "note") grow(event.target);
      if (key === "name") paintChip();
      paintBlank(cells);
      changed();
    },
  })));
  cells[0].classList.add("name-cell");
  cells[0].append(chip);
  paintChip();
  paintBlank(cells);
  const end = h("td", { class: "row-end" }, row
    ? h("button", {
      class: "row-tool row-delete", title: "행 삭제", "aria-label": "행 삭제",
      onclick: () => {
        portion.ingredients.splice(index, 1);
        if (!portion.ingredients.length) state.recipe.portions.splice(state.recipe.portions.indexOf(portion), 1);
        changed();
        renderRecipe();
      },
    }, "×")
    : h("button", {
      class: "row-tool row-add", title: "행 추가", "aria-label": "행 추가",
      onclick: () => { ensureRow(slot.find() || slot.make(), index); renderRecipe(); },
    }, "+"));
  return h("tr", {}, cells, end);
}

// On the read-only sheet an ingredient that stands for a prep links to it.
function prepLink(row) {
  const prep = row && row.name ? linkedPrep(row.name) : null;
  if (!prep) return null;
  return h("a", { class: "prep-link", href: `#/recipe/${prep.id}`, title: "프렙 레시피 열기" }, "프렙");
}

/* ---------- linking ingredients to prep items ---------- */

function otherPreps() {
  return state.recipes.filter((recipe) => isPrep(recipe) && recipe.id !== state.recipe.id);
}

// Similar names are only offered, never linked: one name holds the other, like 크림 and 수제크림.
function similarPreps(name) {
  const key = nameKey(name);
  if (key.length < 2) return [];
  return otherPreps().filter((prep) => [prep.menu_name, ...(prep.aliases || [])].some((other) => {
    const otherKey = nameKey(other);
    return otherKey.length >= 2 && (otherKey.includes(key) || key.includes(otherKey));
  }));
}

// [프렙] on a linked row, [+프렙] on an unlinked one. [+프렙] shows on hover unless a similar prep exists.
function prepChip(name) {
  const text = (name || "").trim();
  if (!text) return null;
  const prep = linkedPrep(text);
  if (prep) {
    return h("button", {
      type: "button", class: "prep-link", title: `${prep.menu_name || "프렙"} · 열기 또는 연결 풀기`,
      onclick: (event) => openLinkMenu(event.currentTarget, text, prep),
    }, "프렙");
  }
  if (!otherPreps().length) return null;
  const similar = similarPreps(text);
  return h("button", {
    type: "button", class: `prep-add ${similar.length ? "suggested" : ""}`,
    title: similar.length ? `비슷한 프렙: ${similar.map((p) => p.menu_name).join(", ")}` : "프렙과 연결",
    onclick: (event) => openPrepPicker(event.currentTarget, text),
  }, similar.length ? "+프렙 후보" : "+프렙");
}

let pop = null;

function closePop() {
  if (pop) pop.remove();
  pop = null;
}

function openPop(anchor, ...children) {
  closePop();
  pop = h("div", { class: "prep-pop", role: "dialog" }, ...children);
  pop.anchor = anchor;
  document.body.append(pop);
  const box = anchor.getBoundingClientRect();
  const height = pop.offsetHeight;
  const left = Math.min(Math.max(8, box.left), document.documentElement.clientWidth - pop.offsetWidth - 8);
  const below = box.bottom + 4 + height <= window.innerHeight || box.top - 4 - height < 0;
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${(below ? box.bottom + 4 : box.top - 4 - height) + window.scrollY}px`;
  const first = pop.querySelector("input, button");
  if (first) first.focus();
}

document.addEventListener("mousedown", (event) => {
  if (pop && !pop.contains(event.target) && !pop.anchor.contains(event.target)) closePop();
});
document.addEventListener("keydown", (event) => {
  if (pop && event.key === "Escape") closePop();
});

function openPrepPicker(anchor, name) {
  if (pop && pop.anchor === anchor) {
    closePop();
    return;
  }
  const preps = otherPreps();
  const similar = similarPreps(name);
  const list = h("div", { class: "pop-list" });
  const item = (prep) => h("button", { type: "button", class: "pop-item", onclick: () => linkPrep(prep, name) },
    h("span", {}, prep.menu_name || "프렙명 미확인"),
    prep.aliases && prep.aliases.length ? h("span", { class: "pop-aliases" }, prep.aliases.join(", ")) : null);
  const search = h("input", {
    type: "search", placeholder: "프렙 검색", "aria-label": "프렙 검색",
    oninput: () => paint(),
    onkeydown: (event) => {
      if (event.key !== "Enter" || composing(event)) return;
      event.preventDefault();
      const first = list.querySelector(".pop-item");
      if (first) first.click();
    },
  });
  const paint = () => {
    const query = nameKey(search.value);
    const shown = (prep) => !query || [prep.menu_name, ...(prep.aliases || [])].some((n) => nameKey(n).includes(query));
    const groups = [
      ...(query ? [] : [["비슷한 이름", similar]]),
      ...state.categories.map((category) => [category, preps.filter((p) => p.category === category)]),
      ["분류 미지정", preps.filter((p) => !p.category)],
    ].map(([title, items]) => [title, items.filter(shown)]).filter(([, items]) => items.length);
    list.replaceChildren(...(groups.length
      ? groups.flatMap(([title, items]) => [h("p", { class: "pop-group" }, title), ...items.map(item)])
      : [h("p", { class: "pop-empty" }, "맞는 프렙이 없습니다.")]));
  };
  paint();
  openPop(anchor,
    h("p", { class: "pop-title" }, `'${name}'${josa(name, "과", "와")} 연결할 프렙`),
    search, list,
    h("p", { class: "pop-note" }, `고른 프렙의 다른 이름에 '${name}'${josa(name, "이", "가")} 들어갑니다.`));
}

function openLinkMenu(anchor, name, prep) {
  if (pop && pop.anchor === anchor) {
    closePop();
    return;
  }
  const byAlias = nameKey(name) !== nameKey(prep.menu_name);
  openPop(anchor,
    h("p", { class: "pop-title" }, `프렙 · ${prep.menu_name || "프렙명 미확인"}`),
    byAlias ? h("p", { class: "pop-note" }, `다른 이름 '${name}'${josa(name, "으로", "로")} 연결되어 있습니다.`) : null,
    h("button", {
      type: "button", class: "pop-item",
      onclick: () => { closePop(); location.hash = `#/recipe/${prep.id}`; },
    }, "프렙 열기"),
    byAlias
      ? h("button", { type: "button", class: "pop-item danger", onclick: () => unlinkPrep(prep, name) }, "연결 풀기")
      : h("p", { class: "pop-note" }, "재료명이 프렙 이름과 같아서 연결되어 있습니다. 풀려면 재료명을 바꾸세요."));
}

// Other recipes with this ingredient name: a link or unlink changes them too, so they are named first.
async function usesElsewhere(name, prep) {
  try {
    const uses = await api(`/api/uses?name=${encodeURIComponent(name)}`);
    return uses.filter((use) => use.id !== state.recipe.id && use.id !== prep.id)
      .map((use) => use.menu_name || (isPrep(use) ? "프렙명 미확인" : "메뉴명 미확인"));
  } catch (error) {
    toast(error.message, 5000);
    return null;
  }
}

async function changeAlias(method, prep, name, message) {
  try {
    const saved = await api(`/api/recipes/${prep.id}/aliases`, sendJson(method, { name }));
    if (state.recipe && state.recipe.id === saved.id) {
      state.recipe.aliases = saved.aliases;
      state.recipe.used_in = saved.used_in;
      state.recipe.md_name = saved.md_name;
    }
    await loadRecipes();
    renderRecipe();
    toast(message, 3500);
    return true;
  } catch (error) {
    toast(error.message, 5000);
    return false;
  }
}

// A name that already stands for a prep is answered at once, before any question about other recipes.
// The server checks the same rules again.
function takenMessage(name, prep) {
  const owner = prepIndex().get(nameKey(name));
  if (!owner) return null;
  if (owner.id !== prep.id) return `이미 '${owner.menu_name || "프렙명 미확인"}' 프렙에 연결된 이름입니다: ${name}`;
  return nameKey(name) === nameKey(prep.menu_name)
    ? "프렙 이름과 같은 이름은 따로 넣지 않아도 연결됩니다."
    : `'${name}'${josa(name, "은", "는")} 이미 이 프렙의 다른 이름입니다.`;
}

async function linkPrep(prep, name) {
  closePop();
  await save(); // Saving reloads the recipe list, so the checks below see the latest names.
  const taken = takenMessage(name, prep);
  if (taken) {
    toast(taken, 4000);
    return false;
  }
  const others = await usesElsewhere(name, prep);
  if (others === null) return false;
  const prepName = prep.menu_name || "프렙명 미확인";
  if (others.length && !confirm(`'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름으로 넣으면, 이 이름을 쓰는 다른 레시피 ${others.length}곳도 함께 연결됩니다.\n\n${others.join(", ")}\n\n연결할까요?`)) return false;
  return changeAlias("POST", prep, name, `'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름에 넣었습니다.`);
}

async function unlinkPrep(prep, name) {
  closePop();
  await save();
  const others = await usesElsewhere(name, prep);
  if (others === null) return false;
  const prepName = prep.menu_name || "프렙명 미확인";
  if (others.length && !confirm(`'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름에서 빼면, 이 이름을 쓰는 다른 레시피 ${others.length}곳도 함께 연결이 풀립니다.\n\n${others.join(", ")}\n\n뺄까요?`)) return false;
  return changeAlias("DELETE", prep, name, `'${name}'${josa(name, "을", "를")} '${prepName}'의 다른 이름에서 뺐습니다.`);
}

function stepsText(steps) {
  let number = 0;
  return steps.map((step) => {
    if (step.startsWith("- ")) return `   ${step}`;
    number += 1;
    return `${number}. ${step}`;
  }).join("\n");
}

// Lines starting with "- " are tips for the numbered step above them.
function stepsList(steps) {
  const items = [];
  for (const step of steps) {
    if (step.startsWith("- ") && items.length) items[items.length - 1].tips.push(step.slice(2));
    else items.push({ text: step.replace(/^- /, ""), tips: [] });
  }
  return h("ol", { class: "steps" }, items.map(({ text, tips }) => h("li", {},
    h("p", {}, text),
    tips.length ? h("ul", {}, tips.map((tip) => h("li", {}, tip))) : null)));
}

function stepsArea(readonly) {
  const { recipe } = state;
  if (readonly) return stepsList(recipe.steps);
  return h("textarea", {
    class: "writing", value: stepsText(recipe.steps), placeholder: "1. 첫 번째 단계",
    oninput: (event) => {
      grow(event.target);
      recipe.steps = event.target.value.split("\n")
        .map((line) => line.trim().replace(/^\d+[.)]\s*/, ""))
        .filter(Boolean);
      changed();
    },
  });
}

function memoArea(readonly) {
  const { recipe } = state;
  if (readonly) return h("div", { class: "memo" }, recipe.memo || "");
  return h("textarea", {
    class: "writing", value: recipe.memo || "", placeholder: "메모 입력",
    oninput: (event) => { grow(event.target); recipe.memo = event.target.value; changed(); },
  });
}

function freeFormPanel() {
  const { recipe } = state;
  if (!recipe.raw_text || recipe.portions.length) return null;
  return h("section", { class: "panel" },
    h("h3", {}, "재료표가 비어 있습니다"),
    h("p", {}, "요약글의 문장 속 분량은 추측하지 않고 비워 둡니다. 직접 입력하거나, 양식 안내문을 함께 넣어 Gemini 답변을 다시 받으면 자동으로 채워집니다."),
    h("button", { class: "link", onclick: async () => toast(await copyGuide(isPrep(recipe) ? "prep" : "menu")) },
      isPrep(recipe) ? "프렙 안내문 복사" : "메뉴 안내문 복사"));
}

function unreadPanel() {
  const { unread } = state.recipe;
  if (!unread) return null;
  return h("section", { class: "panel" }, h("h3", {}, "확인이 필요한 내용"), h("pre", {}, unread));
}

function showRawError(message) {
  const element = document.getElementById("raw-error");
  element.textContent = message;
  element.hidden = !message;
}

function setRawEditing(editing) {
  const shown = {
    "raw-editor": editing, "raw-cancel": editing, "raw-apply": editing,
    "raw-text": !editing, "raw-edit": !editing, "raw-close": !editing,
    "raw-undo": !editing && state.recipe.can_undo,
  };
  Object.entries(shown).forEach(([id, visible]) => { document.getElementById(id).hidden = !visible; });
  showRawError("");
}

function showRaw() {
  const text = state.recipe.raw_text;
  document.getElementById("raw-text").textContent = text;
  document.getElementById("raw-input").value = text || "";
  document.getElementById("raw-guide").textContent = GUIDE_LABELS.menu;
  document.getElementById("raw-prep-guide").textContent = GUIDE_LABELS.prep;
  setRawEditing(!text);
  document.getElementById("raw-dialog").showModal();
}

function editRaw() {
  document.getElementById("raw-input").value = state.recipe.raw_text;
  setRawEditing(true);
}

async function showChanged(recipe) {
  state.recipe = recipe;
  chooseTab();
  document.getElementById("raw-dialog").close();
  renderRecipe();
  await loadRecipes();
  renderSidebar(recipe.id);
}

async function applyRaw() {
  if (!confirm("재료표와 제조방법을 이 내용으로 바꿀까요? 사진은 그대로 두고, 결과가 이상하면 Gemini 원문 창의 [되돌리기]로 바로 전 상태로 돌아갈 수 있습니다.")) return;
  await save(); // A pending autosave must land first, or it would overwrite the new sheet.
  try {
    const text = document.getElementById("raw-input").value;
    const recipe = await api(`/api/recipes/${state.recipe.id}/answer`, sendJson("PUT", { text }));
    await showChanged(recipe);
    toast(recipe.free_form ? "서식을 다시 채웠습니다. 비어 있는 칸을 확인해 주세요." : "서식을 다시 채웠습니다.");
  } catch (error) {
    showRawError(error.message);
  }
}

async function undoRaw() {
  if (!confirm("서식을 다시 채우기 전 상태로 되돌릴까요? 다시 채운 뒤에 직접 고친 내용은 사라집니다.")) return;
  await save();
  try {
    await showChanged(await api(`/api/recipes/${state.recipe.id}/answer/undo`, { method: "POST" }));
    toast("이전 상태로 되돌렸습니다.");
  } catch (error) {
    showRawError(error.message);
  }
}

function printRecipe() {
  document.getElementById("print-root").replaceChildren(isPrep(state.recipe) ? prepSheet(true) : sheet(null, true));
  window.print();
}

async function deleteRecipe() {
  const name = state.recipe.menu_name || "이 레시피";
  if (!confirm(`'${name}'를 삭제할까요? 저장된 .md와 사진도 함께 지워지고 되돌릴 수 없습니다.`)) return;
  clearTimeout(state.timer);
  state.dirty = false;
  await state.queue;
  await api(`/api/recipes/${state.recipe.id}`, { method: "DELETE" });
  location.hash = "#/";
}

/* ---------- routing ---------- */

async function route() {
  closePop();
  await save();
  try {
    await loadRecipes();
  } catch (error) {
    if (!state.recipes.length) {
      app.replaceChildren(h("p", { class: "no-result" }, error.message));
      return;
    }
  }
  const match = location.hash.match(/^#\/recipe\/(\d+)$/);
  if (match) {
    state.highlightId = null;
    renderSidebar(Number(match[1]));
    await showRecipe(match[1]);
  } else {
    state.recipe = null;
    renderSidebar(null);
    renderDashboard();
  }
}

window.addEventListener("hashchange", route);
if (!PUBLISHED) wireEditor();
if (PUBLISHED && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

readSetup().then(({ guides, categories }) => {
  state.guides = guides;
  state.categories = categories;
  route();
}).catch((error) => {
  app.replaceChildren(h("p", { class: "no-result" }, error.message));
});
