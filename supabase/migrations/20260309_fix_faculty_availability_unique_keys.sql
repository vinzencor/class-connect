-- Fix faculty_availability uniqueness to support per-slot and per-week records.
-- Also removes legacy uniqueness on (organization_id, faculty_id, day_of_week)
-- which causes duplicate key errors when saving multiple slots.

-- 1) Remove legacy constraint if it exists.
ALTER TABLE public.faculty_availability
DROP CONSTRAINT IF EXISTS faculty_availability_organization_id_faculty_id_day_of_week_key;

-- 2) De-duplicate existing rows to allow creating unique indexes safely.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        organization_id,
        faculty_id,
        day_of_week,
        time_slot_id,
        COALESCE(week_start_date, DATE '0001-01-01')
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.faculty_availability
)
DELETE FROM public.faculty_availability fa
USING ranked r
WHERE fa.id = r.id
  AND r.rn > 1;

-- 3) Enforce uniqueness for week-specific rows (week_start_date IS NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS faculty_availability_unique_weekly_idx
ON public.faculty_availability (
  organization_id,
  faculty_id,
  day_of_week,
  time_slot_id,
  week_start_date
)
WHERE week_start_date IS NOT NULL;

-- 4) Enforce uniqueness for recurring rows (week_start_date IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS faculty_availability_unique_recurring_idx
ON public.faculty_availability (
  organization_id,
  faculty_id,
  day_of_week,
  time_slot_id
)
WHERE week_start_date IS NULL;
