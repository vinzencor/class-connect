-- Migration: Add course_combo_batches table
-- Run this in Supabase SQL Editor to enable explicit batch assignment for combos

CREATE TABLE IF NOT EXISTS public.course_combo_batches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    combo_id uuid NOT NULL REFERENCES public.course_combos(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(combo_id, batch_id)
);

-- Enable RLS
ALTER TABLE public.course_combo_batches ENABLE ROW LEVEL SECURITY;

-- Allow org members to view combo batches
CREATE POLICY "Users can view combo batches in their org"
ON public.course_combo_batches FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.course_combos cc
        WHERE cc.id = course_combo_batches.combo_id
          AND cc.organization_id = (
              SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
          )
    )
);

-- Allow admins to manage combo batches
CREATE POLICY "Admins can manage combo batches"
ON public.course_combo_batches FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.course_combos cc
        WHERE cc.id = course_combo_batches.combo_id
          AND cc.organization_id = (
              SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
          )
    )
);
