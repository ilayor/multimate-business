-- ORSHINA CRM: clients and leads, packages, coaching sessions, payments, message templates, synced preferences.
-- Old coaching tables stay in place, unused.

-- ---------- business settings ----------
alter table public.businesses
  add column if not exists monthly_income_goal numeric,
  add column if not exists default_session_price numeric not null default 300,
  add column if not exists default_session_minutes int not null default 60;

-- ---------- clients (a lead and a client are the same person at different stages) ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  kind text not null default 'lead' check (kind in ('lead','client')),
  lead_stage text not null default 'new' check (lead_stage in ('new','contacted','intro_call','won','lost')),
  lost_reason text,
  client_status text not null default 'active' check (client_status in ('active','paused','done')),
  source text,
  goal text,
  notes text,
  next_follow_up date,
  follow_up_note text,
  became_client_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.clients(business_id, kind);
create index on public.clients(business_id, next_follow_up);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null default 'חבילת מפגשים',
  sessions_total int not null check (sessions_total > 0),
  price numeric not null default 0,
  purchased_on date not null default current_date,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.packages(business_id, client_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  package_id uuid references public.packages(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes int not null default 60,
  status text not null default 'scheduled' check (status in ('scheduled','done','cancelled','no_show')),
  price numeric not null default 300,
  summary text,
  external_id text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.sessions(business_id, starts_at);
create index on public.sessions(client_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'bit' check (method in ('bit','cash','transfer','paybox','other')),
  paid_on date not null default current_date,
  session_id uuid references public.sessions(id) on delete set null,
  package_id uuid references public.packages(id) on delete set null,
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.payments(business_id, paid_on);
create index on public.payments(client_id);
create index on public.payments(session_id);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key text not null,
  title text not null,
  body text not null,
  position int not null default 0,
  unique (business_id, key)
);

create table public.user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.clients enable row level security;
alter table public.packages enable row level security;
alter table public.sessions enable row level security;
alter table public.payments enable row level security;
alter table public.message_templates enable row level security;
alter table public.user_prefs enable row level security;

create policy clients_all on public.clients for all to authenticated
  using (is_business_member(business_id)) with check (is_business_member(business_id));
create policy packages_all on public.packages for all to authenticated
  using (is_business_member(business_id)) with check (is_business_member(business_id));
create policy sessions_all on public.sessions for all to authenticated
  using (is_business_member(business_id)) with check (is_business_member(business_id));
create policy payments_all on public.payments for all to authenticated
  using (is_business_member(business_id)) with check (is_business_member(business_id));
create policy templates_all on public.message_templates for all to authenticated
  using (is_business_member(business_id)) with check (is_business_member(business_id));
create policy prefs_own on public.user_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- seed: WhatsApp templates for every business ----------
insert into public.message_templates (business_id, key, title, body, position)
select b.id, t.key, t.title, t.body, t.pos
from public.businesses b
cross join (values
  ('reminder', 'תזכורת למפגש', 'היי {שם}, רק מזכירה שנפגשות {יום} בשעה {שעה}. מחכה לך 🌿', 1),
  ('follow_up', 'פולואפ למתעניינת', 'היי {שם}, זו אורית מאורשינא. רציתי לבדוק אם עדיין רלוונטי לך לדבר על תהליך אימון? אשמח לקבוע שיחת היכרות קצרה.', 2),
  ('payment', 'בקשת תשלום', 'היי {שם}, תודה על המפגש! התשלום הוא {סכום} ₪, אפשר בביט או בהעברה. תודה 🙏', 3),
  ('referral', 'בקשת המלצה', 'היי {שם}, היה לי כיף ללוות אותך. אם יש לך כמה מילים על התהליך, או מישהי שיכולה להתאים לה, אשמח מאוד 💛', 4)
) as t(key, title, body, pos)
on conflict (business_id, key) do nothing;

-- ---------- seed: the 31 setup tasks for אורשינא (skips titles that already exist) ----------
insert into public.tasks (business_id, title, department_code, status, assignee_name, position)
select b.id, s.title, s.dept, 'todo', 'אורית', s.pos
from public.businesses b
cross join (values
  ('להגדיר קהל יעד מרכזי ופרופיל לקוחה אידיאלית', 'marketing', 101),
  ('לגבש בידול, מסר שיווקי והצעת ערך', 'marketing', 102),
  ('לסדר ולעדכן פרופילים עסקיים ברשתות החברתיות', 'marketing', 103),
  ('לבנות תוכנית תוכן חודשית עם נושאים ותאריכי פרסום', 'marketing', 104),
  ('לצלם, לערוך ולפרסם תכנים ראשונים', 'marketing', 105),
  ('לבנות תהליך למדידת פניות שמגיעות מהשיווק', 'marketing', 106),
  ('להגדיר את שלבי המכירה מהפנייה הראשונה ועד התשלום', 'sales', 201),
  ('לכתוב שאלות מנחות לשיחת היכרות', 'sales', 202),
  ('להכין הצגה ברורה של השירות והמחירים', 'sales', 203),
  ('לבנות טבלת מעקב אחר פניות ומתעניינות', 'sales', 204),
  ('להגדיר מתי ואיך מבצעים פולואפ', 'sales', 205),
  ('לתעד פניות ותוצאות של שיחות מכירה', 'sales', 206),
  ('להגדיר את התוצאה שכל שירות אימון אמור לספק', 'product', 301),
  ('לבחון את מודל הפגישה הבודדת במחיר 300 ₪', 'product', 302),
  ('לבחון בניית מסלולי אימון וחבילות מפגשים', 'product', 303),
  ('לחשב עלות, זמן עבודה ורווחיות לכל שירות', 'product', 304),
  ('לתעד את שלבי תהליך האימון', 'product', 305),
  ('להגדיר כיצד מודדים התקדמות של מתאמנת', 'product', 306),
  ('להגדיר תהליך קליטת מתאמנת חדשה', 'service', 401),
  ('ליצור טופס היכרות ותיאום ציפיות', 'service', 402),
  ('להסדיר תיאום מפגשים, תזכורות ומדיניות ביטולים', 'service', 403),
  ('לבנות מערכת למעקב אחר מפגשים והתקדמות', 'service', 404),
  ('להכין שאלון משוב לסיום תהליך', 'service', 405),
  ('לבנות תהליך לבקשת המלצות ושמירה על קשר', 'service', 406),
  ('להסדיר פתיחת תיקי העסק וההתנהלות מול הרשויות בעזרת איש מקצוע לפי הצורך', 'finance', 501),
  ('לבחור כלי להפקת מסמכים וניהול הוצאות', 'finance', 502),
  ('לבנות מעקב חודשי אחר הכנסות והוצאות', 'finance', 503),
  ('למפות עלויות קבועות ומשתנות ולהגדיר תקציב', 'finance', 504),
  ('להגדיר יעד הכנסות, רווח ונקודת איזון', 'finance', 505),
  ('לבנות מערכת משימות ולוח עבודה שבועי', 'finance', 506),
  ('להגדיר שגרת בקרה שבועית וחודשית', 'finance', 507)
) as s(title, dept, pos)
where b.name = 'אורשינא'
  and not exists (select 1 from public.tasks t where t.business_id = b.id and t.title = s.title);
