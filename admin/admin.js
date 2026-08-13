const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");
const loginMsg = document.getElementById("loginMsg");
const formMsg = document.getElementById("formMsg");
let adminProperties = [];

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  loginMsg.textContent = "جاري الدخول...";
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById("email").value,
    password: document.getElementById("password").value
  });
  if (error) { loginMsg.textContent = "بيانات الدخول غير صحيحة أو الحساب غير مفعل."; return; }
  await showDashboard(data.user);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

document.getElementById("newPropertyBtn").addEventListener("click", resetForm);
document.getElementById("cancelEdit").addEventListener("click", resetForm);

document.getElementById("imageFiles").addEventListener("change", e => previewFiles(e.target.files, "imagePreview", false));
document.getElementById("videoFiles").addEventListener("change", e => previewFiles(e.target.files, "videoPreview", true));

function previewFiles(files, elementId, video) {
  const root = document.getElementById(elementId);
  root.innerHTML = "";
  [...files].forEach(file => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(video ? "video" : "img");
    el.src = url;
    if (video) { el.controls = true; el.muted = true; }
    root.appendChild(el);
  });
}

async function showDashboard(user) {
  const { data: admin } = await supabaseClient.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) {
    await supabaseClient.auth.signOut();
    loginMsg.textContent = "الحساب صحيح، لكنه غير مضاف كأدمن.";
    return;
  }
  loginSection.classList.add("hidden");
  dashboard.classList.remove("hidden");
  document.getElementById("adminEmail").textContent = user.email || "";
  loadProperties();
}

async function loadProperties() {
  const { data, error } = await supabaseClient.from("properties").select("*").order("created_at", { ascending:false });
  if (error) { document.getElementById("propertyList").innerHTML = `<p class="muted">تعذر تحميل الشقق.</p>`; return; }
  adminProperties = data || [];
  renderAdminProperties();
  const list = adminProperties;
  document.getElementById("totalCount").textContent = list.length;
  document.getElementById("availableCount").textContent = list.filter(p=>p.status==="available").length;
  document.getElementById("fullCount").textContent = list.filter(p=>p.status==="full").length;
  renderAdminProperties();
}

function renderAdminProperties() {
  const search = (document.getElementById("adminSearch")?.value || "").trim().toLowerCase();
  const status = document.getElementById("adminStatusFilter")?.value || "";
  const list = adminProperties.filter(p => {
    const hay = `${p.governorate||""} ${p.area||""} ${p.university||""}`.toLowerCase();
    return (!search || hay.includes(search)) && (!status || p.status === status);
  });
  document.getElementById("propertyList").innerHTML = list.length ? list.map(p => `
    <div class="admin-card" style="padding:14px">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div><b>${escapeHtml(p.university)}</b><div class="muted">${escapeHtml(p.governorate)} · ${escapeHtml(p.area)} · ${Number(p.available_beds)} متاح</div></div>
        <span class="chip">${p.status}</span>
      </div>
      <div class="admin-actions" style="margin-top:10px">
        <button class="btn btn-small" onclick="editProperty('${p.id}')">تعديل</button>
        <button class="btn btn-small danger" onclick="deleteProperty('${p.id}')">حذف</button>
      </div>
    </div>`).join("") : `<p class="muted">لا توجد نتائج.</p>`;
}

async function editProperty(id) {
  const { data: p, error } = await supabaseClient.from("properties").select("*, property_images(*), property_videos(*)").eq("id", id).single();
  if (error) return alert("تعذر تحميل الشقة.");
  resetForm();
  document.getElementById("propertyId").value=p.id;
  document.getElementById("governorate").value=p.governorate||"";
  document.getElementById("university").value=p.university;
  document.getElementById("area").value=p.area;
  document.getElementById("price").value=p.price;
  document.getElementById("rooms").value=p.rooms;
  document.getElementById("beds").value=p.beds;
  document.getElementById("availableBeds").value=p.available_beds;
  document.getElementById("amenities").value=(p.amenities||[]).join(", ");
  document.getElementById("description").value=p.description||"";
  document.getElementById("status").value=p.status;
  window.scrollTo({top:0,behavior:"smooth"});
}

function setUploadStatus(text, percent = 0) {
  const status = document.getElementById("uploadStatus");
  const bar = document.getElementById("uploadProgress");
  if (!status || !bar) return;
  if (!text) {
    status.classList.add("hidden");
    bar.style.width = "0%";
    return;
  }
  status.classList.remove("hidden");
  status.textContent = text;
  bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

async function uploadFiles(files, bucket, propertyId, kind) {
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (kind === "video" && file.size > 50 * 1024 * 1024) {
      throw new Error(`الفيديو "${file.name}" أكبر من 50MB. استخدم فيديو أصغر.`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${propertyId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });
    if (error) throw error;
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

document.getElementById("propertyForm").addEventListener("submit", async e => {
  e.preventDefault();
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "جاري الحفظ...";
  formMsg.textContent = "جاري حفظ الشقة...";
  const id = document.getElementById("propertyId").value;
  const payload = {
    title: `سكن طلابي - ${document.getElementById("area").value.trim()}`,
    governorate: document.getElementById("governorate").value.trim(),
    university: document.getElementById("university").value.trim(),
    area: document.getElementById("area").value.trim(),
    price: Number(document.getElementById("price").value),
    rooms: Number(document.getElementById("rooms").value),
    beds: Number(document.getElementById("beds").value),
    available_beds: Number(document.getElementById("availableBeds").value),
    amenities: document.getElementById("amenities").value.split(",").map(x=>x.trim()).filter(Boolean),
    description: document.getElementById("description").value.trim(),
    status: document.getElementById("status").value
  };

  let result;
  if (id) result = await supabaseClient.from("properties").update(payload).eq("id", id).select().single();
  else result = await supabaseClient.from("properties").insert(payload).select().single();
  if (result.error) { formMsg.textContent = result.error.message; return; }

  const propertyId = result.data.id;
  const imageFiles = [...document.getElementById("imageFiles").files];
  const videoFiles = [...document.getElementById("videoFiles").files];

  try {
    if (imageFiles.length) {
      const urls = await uploadFiles(imageFiles, "property-images", propertyId, "image");
      const start = (await supabaseClient.from("property_images").select("id", {count:"exact", head:true}).eq("property_id", propertyId)).count || 0;
      const { error } = await supabaseClient.from("property_images").insert(
        urls.map((url,i)=>({property_id:propertyId,image_url:url,is_primary:(start+i===0),sort_order:start+i}))
      );
      if (error) throw error;
    }

    if (videoFiles.length) {
      const urls = await uploadFiles(videoFiles, "property-videos", propertyId, "video");
      const start = (await supabaseClient.from("property_videos").select("id", {count:"exact", head:true}).eq("property_id", propertyId)).count || 0;
      const { error } = await supabaseClient.from("property_videos").insert(
        urls.map((url,i)=>({property_id:propertyId,video_url:url,sort_order:start+i}))
      );
      if (error) throw error;
    }
  } catch (uploadError) {
    formMsg.textContent = "تم حفظ بيانات الشقة، لكن حصل خطأ أثناء رفع الوسائط: " + uploadError.message;
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ الشقة";
    await loadProperties();
    return;
  }

  formMsg.textContent = "تم الحفظ بنجاح.";
  saveBtn.disabled = false;
  saveBtn.textContent = "حفظ الشقة";
  resetForm();
  await loadProperties();
});

async function deleteProperty(id) {
  if (!confirm("متأكد إنك عايز تحذف الشقة؟")) return;
  const { error } = await supabaseClient.from("properties").delete().eq("id", id);
  if (error) return alert(error.message);
  loadProperties();
}

function resetForm() {
  document.getElementById("propertyForm").reset();
  document.getElementById("propertyId").value="";
  document.getElementById("imagePreview").innerHTML="";
  document.getElementById("videoPreview").innerHTML="";
  formMsg.textContent="";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

supabaseClient.auth.getSession().then(async ({data}) => {
  if (data.session?.user) await showDashboard(data.session.user);
});
document.getElementById("adminSearch")?.addEventListener("input", renderAdminProperties);
document.getElementById("adminStatusFilter")?.addEventListener("change", renderAdminProperties);
