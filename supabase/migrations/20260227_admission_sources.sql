CREATE TABLE IF NOT EXISTS public.admission_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(organization_id, name)
);

ALTER TABLE public.admission_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'admission_sources' AND policyname = 'Users can view admission sources for their organization'
    ) THEN
        CREATE POLICY "Users can view admission sources for their organization"
            ON public.admission_sources FOR SELECT
            USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'admission_sources' AND policyname = 'Admins can manage admission sources'
    ) THEN
        CREATE POLICY "Admins can manage admission sources"
            ON public.admission_sources FOR ALL
            USING (
                organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            );
    END IF;
END $$;
