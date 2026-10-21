-- Pilot diagnostic template for אורשינא: 6 departments x 5 prompts.
-- Usage: replace :org_id with the consulting organization id.
with t as (
  insert into public.questionnaire_templates(organization_id, title, version)
  values (:'org_id', 'אבחון ראשוני — 6 מחלקות', 1) returning id
)
insert into public.template_questions(template_id, department_code, type, position, prompt)
select t.id, q.dept, q.typ, q.pos, q.prompt from t, (values
  ('strategy','long_text',1,'איפה את רואה את העסק בעוד שנה? ובעוד 3 שנים?'),
  ('strategy','number',2,'כמה הכנסה נטו בחודש את צריכה מהעסק כדי שיהיה "מספיק" (₪)?'),
  ('strategy','long_text',3,'מי קהל היעד המדויק? (למשל נשים 45+ שהילדים עזבו את הבית) — מה מאפיין אותן?'),
  ('strategy','long_text',4,'מה מבדל אותך ממאמנות / מטפלות אחרות? למה לבחור דווקא בך?'),
  ('strategy','number',5,'כמה שעות בשבוע את יכולה להקדיש לעסק בפועל, לצד העבודה?'),
  ('finance','long_text',6,'הכנסות ב-3 החודשים האחרונים (לכל חודש בנפרד, ₪)'),
  ('finance','long_text',7,'הוצאות ב-3 החודשים האחרונים (לכל חודש בנפרד, ₪)'),
  ('finance','long_text',8,'כמה מפגשים בתשלום היו בכל אחד מ-3 החודשים האחרונים?'),
  ('finance','long_text',9,'איך מתועדים תשלומים והוצאות היום? (מחברת, אקסל, אפליקציה, לא מתועד)'),
  ('finance','long_text',10,'מה מצב הרישום מול מס הכנסה / מע"מ / ביטוח לאומי? (לבדוק עם איש מקצוע — לא להניח)'),
  ('product','long_text',11,'איזו בעיה בדיוק את פותרת ללקוחה? עם מה היא מגיעה ועם מה יוצאת?'),
  ('product','long_text',12,'מבנה מפגש: כמה זמן, מה קורה בו, איפה (בבית / זום)?'),
  ('product','long_text',13,'האם יש תהליך / חבילה (מספר מפגשים) או שזה מפגש בודד?'),
  ('product','long_text',14,'אילו תוצאות לקוחות קיבלו? דוגמאות (בלי פרטים מזהים)'),
  ('product','long_text',15,'הכשרות / תעודות / ניסיון רלוונטי'),
  ('marketing','long_text',16,'איפה את נוכחת היום? (פייסבוק, אינסטגרם, וואטסאפ, קבוצות, אין)'),
  ('marketing','long_text',17,'על אילו נושאים את יכולה לדבר באותנטיות ובהנאה?'),
  ('marketing','long_text',18,'האם יש המלצות מלקוחות? האם קיבלת הסכמה לפרסם אותן?'),
  ('marketing','long_text',19,'אילו סרטונים / תכנים קיימים כבר? איפה הם?'),
  ('marketing','single_select',20,'כמה נוח לך מול מצלמה? (1 = בכלל לא, 5 = מאוד)'),
  ('sales','long_text',21,'מאיפה מגיעות פניות היום? (חברות, המלצות, רשתות...)'),
  ('sales','long_text',22,'מה קורה מרגע שמישהי פונה ועד שהיא קובעת מפגש?'),
  ('sales','long_text',23,'איך את מציגה את ההצעה ואת המחיר? מה את אומרת?'),
  ('sales','long_text',24,'כמה פניות היו בחודש האחרון וכמה מהן הפכו ללקוחות?'),
  ('sales','long_text',25,'האם את חוזרת לפונות שלא סגרו? איך ומתי?'),
  ('service','long_text',26,'איך קובעים מפגשים ותזכורות?'),
  ('service','long_text',27,'האם את מתעדת התקדמות של כל לקוחה? איך?'),
  ('service','long_text',28,'האם יש קשר בין המפגשים (הודעה, משימה, תרגיל)?'),
  ('service','long_text',29,'איך את ולקוחה יודעות שהתהליך הצליח?'),
  ('service','long_text',30,'האם לקוחות מפנות חברות? האם את מבקשת את זה?')
) as q(dept, typ, pos, prompt);

update public.template_questions set options_json = '["1","2","3","4","5"]'
where type = 'single_select' and options_json is null;
