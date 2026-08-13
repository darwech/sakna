const WHATSAPP_NUMBER = "201146611925";
const FAVORITES_KEY = "sakna_favorites";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); }
  catch { return []; }
}

function toggleFavorite(id, event) {
  event.preventDefault();
  event.stopPropagation();
  const set = new Set(getFavorites());
  set.has(id) ? set.delete(id) : set.add(id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
  const btn = event.currentTarget;
  const active = set.has(id);
  btn.classList.toggle("active", active);
  btn.setAttribute("aria-label", active ? "إزالة من المفضلة" : "إضافة للمفضلة");
  btn.textContent = active ? "♥" : "♡";
}

function availabilityBadge(property) {
  const n = Number(property.available_beds || 0);
  if (n <= 0) return `<span class="status status-full">مكتملة</span>`;
  if (n === 1) return `<span class="status status-last">آخر سرير</span>`;
  return `<span class="status">متاحة</span>`;
}

function mediaPlaceholder() {
  return `<div class="property-placeholder"><span>🏠</span><small>صورة السكن ستظهر هنا</small></div>`;
}

function propertyCard(property) {
  const favorites = new Set(getFavorites());
  const image = property.images?.[0];
  return `
    <article class="property-card">
      <a href="property.html?id=${property.id}">
        <div class="property-image">
          ${image ? `<img src="${escapeHtml(image)}" alt="سكن طلابي في ${escapeHtml(property.area)}" loading="lazy">` : mediaPlaceholder()}
          ${availabilityBadge(property)}
          ${property.videos?.length ? `<span class="media-badge">🎥 فيديو</span>` : ""}
          <button class="favorite-btn ${favorites.has(property.id) ? "active" : ""}" onclick="toggleFavorite('${property.id}', event)" aria-label="${favorites.has(property.id) ? "إزالة من المفضلة" : "إضافة للمفضلة"}">${favorites.has(property.id) ? "♥" : "♡"}</button>
        </div>
        <div class="property-body">
          <div class="location-line">📍 ${escapeHtml(property.governorate)} · ${escapeHtml(property.area)}</div>
          <h3 class="property-area-title">${escapeHtml(property.area)}</h3><p class="property-university">🎓 ${escapeHtml(property.university)}</p>
          <div class="property-meta">
            <span class="chip">🛏️ ${Number(property.available_beds)} متاح</span>
            <span class="chip">🏠 ${Number(property.rooms)} غرف</span>
            <span class="chip">👥 ${Number(property.beds)} سرير</span>
          </div>
          <div class="property-bottom">
            <span class="price">${Number(property.price).toLocaleString("ar-EG")} ج <small>/ سرير شهريًا</small></span>
            <span class="text-link">التفاصيل ←</span>
          </div>
        </div>
      </a>
    </article>`;
}

function renderProperties(list, elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = list.length ? list.map(propertyCard).join("") :
    `<div class="empty">مفيش سكن مطابق للبحث حاليًا.</div>`;
}

function renderSkeletons(elementId, count = 3) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = Array.from({length: count}, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-line wide"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line short"></div>
    </div>`).join("");
}

async function getProperties(filters = {}) {
  let query = supabaseClient.from("properties")
    .select("*, property_images(*), property_videos(*)")
    .eq("status", "available").order("created_at", { ascending: false });
  if (filters.governorate) query = query.eq("governorate", filters.governorate);
  if (filters.university) query = query.eq("university", filters.university);
  if (filters.area) query = query.eq("area", filters.area);
  if (filters.maxPrice) query = query.lte("price", Number(filters.maxPrice));

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    images: (p.property_images || []).sort((a,b)=>a.sort_order-b.sort_order).map(i=>i.image_url),
    videos: (p.property_videos || []).sort((a,b)=>a.sort_order-b.sort_order).map(v=>v.video_url)
  }));
}

async function populateSelect(select, values) {
  if (!select) return;
  select.innerHTML = '<option value="">الكل</option>';
  [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")).forEach(v => {
    const o = document.createElement("option");
    o.value = v; o.textContent = v; select.appendChild(o);
  });
}

async function initHome() {
  renderSkeletons("featuredProperties", 3);
  try {
    const all = await getProperties();
    renderProperties(all.slice(0,3), "featuredProperties");
    const countEl = document.getElementById("homePropertyCount");
    if (countEl) countEl.textContent = `+${all.length} سكن متاح حاليًا`;

    await populateSelect(document.getElementById("homeGovernorate"), all.map(p=>p.governorate));
    await populateSelect(document.getElementById("homeUniversity"), all.map(p=>p.university));
    await populateSelect(document.getElementById("homeArea"), all.map(p=>p.area));
  } catch(e) {
    console.error(e);
    document.getElementById("featuredProperties").innerHTML = `<div class="empty">تعذر تحميل السكن حاليًا.</div>`;
  }

  document.getElementById("homeSearch")?.addEventListener("click", () => {
    const params = new URLSearchParams();
    ["homeGovernorate","homeUniversity","homeArea"].forEach((id,key) => {
      const v = document.getElementById(id)?.value;
      if (v) params.set(["governorate","university","area"][key], v);
    });
    window.location.href = `properties.html?${params.toString()}`;
  });
}

async function initPropertiesPage() {
  const govEl = document.getElementById("filterGovernorate");
  const universityEl = document.getElementById("filterUniversity");
  const areaEl = document.getElementById("filterArea");
  const params = new URLSearchParams(window.location.search);

  try {
    const all = await getProperties();
    await populateSelect(govEl, all.map(p=>p.governorate));
    await populateSelect(universityEl, all.map(p=>p.university));
    await populateSelect(areaEl, all.map(p=>p.area));

    if (govEl) govEl.value = params.get("governorate") || "";
    if (universityEl) universityEl.value = params.get("university") || "";
    if (areaEl) areaEl.value = params.get("area") || "";

    const render = async () => {
      renderSkeletons("allProperties", 6);
      const list = await getProperties({
        governorate: govEl?.value || "",
        university: universityEl?.value || "",
        area: areaEl?.value || "",
        maxPrice: document.getElementById("filterPrice")?.value || ""
      });
      renderProperties(list, "allProperties");
      const count = document.getElementById("resultsCount");
      if (count) count.textContent = `${list.length} سكن متاح`;
    };
    document.getElementById("applyFilters")?.addEventListener("click", render);
    document.getElementById("clearFilters")?.addEventListener("click", () => {
      [govEl,universityEl,areaEl].forEach(x=>{if(x)x.value=""});
      document.getElementById("filterPrice").value = "";
      render();
    });
    await render();
  } catch(e) {
    console.error(e);
    document.getElementById("allProperties").innerHTML = `<div class="empty">تعذر تحميل البيانات حاليًا.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("featuredProperties")) initHome();
  if (document.getElementById("allProperties")) initPropertiesPage();
});