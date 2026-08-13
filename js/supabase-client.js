const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

async function getProperties(filters = {}) {
  let query = supabaseClient
    .from("properties")
    .select("*, property_images(*)")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (filters.university) query = query.eq("university", filters.university);
  if (filters.area) query = query.eq("area", filters.area);
  if (filters.maxPrice) query = query.lte("price", Number(filters.maxPrice));

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(p => ({
    ...p,
    images: (p.property_images || [])
      .sort((a,b) => a.sort_order - b.sort_order)
      .map(i => i.image_url)
  }));
}

function demoSafeImage(property) {
  return property.images?.[0] ||
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80";
}
