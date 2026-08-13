document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(window.location.search).get("id");
  const root = document.getElementById("propertyDetails");

  try {
    const { data: property, error } = await supabaseClient.from("properties")
      .select("*, property_images(*), property_videos(*)")
      .eq("id", id).eq("status", "available").single();
    if (error || !property) throw new Error("not found");

    const images = (property.property_images || []).sort((a,b)=>a.sort_order-b.sort_order).map(i=>i.image_url);
    const videos = (property.property_videos || []).sort((a,b)=>a.sort_order-b.sort_order).map(v=>v.video_url);
    const message = encodeURIComponent(`السلام عليكم، أنا مهتم بالسكن في ${property.governorate} - ${property.area} - ${property.university}`);
    const whatsappUrl = `${CONTACT_WHATSAPP_LINK}?text=${message}`;
    const mapQuery = encodeURIComponent(property.location_text || `${property.area}, ${property.governorate}, مصر`);
    const allMedia = [
      ...images.map((src,i)=>({type:"image",src,alt:`صورة السكن ${i+1}`})),
      ...videos.map((src,i)=>({type:"video",src,alt:`فيديو السكن ${i+1}`}))
    ];
    const first = allMedia[0];

    root.innerHTML = `
      <div class="detail-top">
        <div><span class="eyebrow">سكن طلابي</span>
        <h1 class="detail-heading">${escapeHtml(property.area)}</h1>
        <div class="detail-university">🎓 ${escapeHtml(property.university)}</div>
        <div class="detail-location">📍 ${escapeHtml(property.governorate)}</div></div>
        <div class="detail-price-mobile">${Number(property.price).toLocaleString("ar-EG")} ج <small>/ سرير شهريًا</small></div>
      </div>

      <div class="detail-grid">
        <section>
          <div class="gallery-pro">
            <div class="gallery-main" id="galleryMain">${renderMainMedia(first)}</div>
            <div class="gallery-thumbs" id="galleryThumbs">
              ${allMedia.map((m,i)=>`
                <button class="gallery-thumb ${i===0?"active":""}" data-index="${i}">
                  ${m.type==="video" ? `<span class="thumb-video">▶</span>` : ""}
                  <img src="${escapeHtml(m.src)}" alt="${escapeHtml(m.alt)}" loading="lazy">
                </button>`).join("")}
            </div>
          </div>

          <div class="detail-content">
            <div class="quick-stats">
              <div><b>${property.rooms}</b><span>غرف</span></div>
              <div><b>${property.beds}</b><span>سرير</span></div>
              <div><b>${property.available_beds}</b><span>متاح</span></div>
            </div>
            <h2>عن السكن</h2>
            <p class="description">${escapeHtml(property.description)}</p>
            <h2>المميزات</h2>
            <div class="amenities">${(property.amenities||[]).map(a=>`<span class="chip">${escapeHtml(a)}</span>`).join("")}</div>

            <div class="map-card">
              <div><strong>📍 موقع السكن</strong><span>${escapeHtml(property.area)} · ${escapeHtml(property.governorate)}</span></div>
              <a class="btn btn-outline" target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${mapQuery}">فتح في خرائط جوجل</a>
            </div>
          </div>
        </section>

        <aside class="details-card">
          <span class="muted">سعر السرير شهريًا</span>
          <div class="details-price">${Number(property.price).toLocaleString("ar-EG")} ج</div>
          <div class="details-list">
            <div class="details-row"><span>المحافظة</span><strong>${escapeHtml(property.governorate)}</strong></div>
            <div class="details-row"><span>المنطقة</span><strong>${escapeHtml(property.area)}</strong></div>
            <div class="details-row"><span>الجامعة</span><strong>${escapeHtml(property.university)}</strong></div>
            <div class="details-row"><span>عدد الغرف</span><strong>${property.rooms}</strong></div>
            <div class="details-row"><span>عدد السراير</span><strong>${property.beds}</strong></div>
            <div class="details-row"><span>السراير المتاحة</span><strong style="color:#047857">${property.available_beds}</strong></div>
          </div>
          <a class="whatsapp-btn" href="${whatsappUrl}" target="_blank">💬 تواصل واتساب</a>
          <a class="call-btn" href="${CONTACT_PHONE_LINK}">📞 اتصال مباشر</a>
          <a class="facebook-btn" href="${CONTACT_FACEBOOK_LINK}" target="_blank" rel="noreferrer">ⓕ فيسبوك</a>
        </aside>
      </div>`;

    document.querySelectorAll(".gallery-thumb").forEach(btn => btn.addEventListener("click", () => {
      const m = allMedia[Number(btn.dataset.index)];
      document.getElementById("galleryMain").innerHTML = renderMainMedia(m);
      document.querySelectorAll(".gallery-thumb").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
    }));
  } catch(e) {
    console.error(e);
    root.innerHTML = `<div class="empty">السكن غير موجود أو غير متاح حاليًا.</div>`;
  }
});

function renderMainMedia(media) {
  if (!media) return `<div class="property-placeholder large"><span>🏠</span><small>لا توجد وسائط</small></div>`;
  if (media.type === "video") return `<video class="gallery-main-media video-fit" controls playsinline preload="metadata" src="${escapeHtml(media.src)}"></video>`;
  return `<img class="gallery-main-media" src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt)}">`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}