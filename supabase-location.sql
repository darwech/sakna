-- تحديث بيانات السكن:
-- المحافظة + المنطقة + الجامعة، مع الإبقاء على title داخليًا للتوافق مع النسخة السابقة.
alter table public.properties
  add column if not exists governorate text not null default 'سوهاج';

alter table public.properties
  alter column title set default 'سكن طلابي';

-- فهارس للبحث والفلاتر
create index if not exists properties_governorate_idx
  on public.properties(governorate);

-- تحديث الشقق القديمة تلقائيًا إذا كانت المنطقة موجودة.
-- راجع البيانات القديمة وعدل المحافظة عند الحاجة.
update public.properties
set governorate = 'سوهاج'
where governorate is null or trim(governorate) = '';


alter table public.properties add column if not exists location_text text;
