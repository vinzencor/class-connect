-- Copies QA + RA modules and all their sub-modules
-- from SSC REGULAR COURSE -> NTPC.
-- Safe to run multiple times (uses upsert behavior).

DO $$
DECLARE
  v_source_subject_id UUID;
  v_target_subject_id UUID;
  v_organization_id UUID;
  v_branch_id UUID;
  v_source_group_count INTEGER;
BEGIN
  -- 1) Find source subject: SSC REGULAR COURSE
  SELECT id, organization_id, branch_id
  INTO v_source_subject_id, v_organization_id, v_branch_id
  FROM module_subjects
  WHERE name ILIKE '%SSC%REGULAR%COURSE%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_source_subject_id IS NULL THEN
    RAISE EXCEPTION 'SSC REGULAR COURSE module_subject not found. Update the source WHERE clause.';
  END IF;

  -- 2) Find target subject: NTPC (same organization)
  SELECT id
  INTO v_target_subject_id
  FROM module_subjects
  WHERE organization_id = v_organization_id
    AND name ILIKE '%NTPC%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_target_subject_id IS NULL THEN
    RAISE EXCEPTION 'NTPC module_subject not found in same organization. Create NTPC subject first or update target WHERE clause.';
  END IF;

  IF v_source_subject_id = v_target_subject_id THEN
    RAISE EXCEPTION 'Source and target subjects resolved to same record. Please fix name filters.';
  END IF;

  SELECT COUNT(*)
  INTO v_source_group_count
  FROM module_groups g
  WHERE g.subject_id = v_source_subject_id
    AND UPPER(TRIM(g.name)) IN ('QA', 'RA');

  IF v_source_group_count = 0 THEN
    RAISE EXCEPTION 'No QA/RA groups found under SSC REGULAR COURSE. Please verify group names.';
  END IF;

  -- 3) Copy/Upsert QA + RA groups from source subject to target subject
  WITH source_groups AS (
    SELECT
      g.id AS source_group_id,
      g.organization_id,
      g.branch_id,
      g.name,
      g.description,
      g.sort_order
    FROM module_groups g
    WHERE g.subject_id = v_source_subject_id
      AND UPPER(TRIM(g.name)) IN ('QA', 'RA')
  ),
  upsert_groups AS (
    INSERT INTO module_groups (
      subject_id,
      organization_id,
      branch_id,
      name,
      description,
      sort_order
    )
    SELECT
      v_target_subject_id,
      v_organization_id,
      COALESCE(sg.branch_id, v_branch_id),
      sg.name,
      sg.description,
      sg.sort_order
    FROM source_groups sg
    ON CONFLICT (subject_id, name)
    DO UPDATE SET
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      updated_at = NOW()
    RETURNING id, name
  ),
  mapped_groups AS (
    SELECT
      sg.source_group_id,
      tg.id AS target_group_id,
      sg.name
    FROM source_groups sg
    JOIN module_groups tg
      ON tg.subject_id = v_target_subject_id
     AND tg.name = sg.name
  )
  -- 4) Copy/Upsert all sub-groups under QA + RA
  INSERT INTO module_sub_groups (
    group_id,
    organization_id,
    branch_id,
    name,
    description,
    sort_order
  )
  SELECT
    mg.target_group_id,
    v_organization_id,
    COALESCE(ssg.branch_id, v_branch_id),
    ssg.name,
    ssg.description,
    ssg.sort_order
  FROM module_sub_groups ssg
  JOIN mapped_groups mg
    ON mg.source_group_id = ssg.group_id
  ON CONFLICT (group_id, name)
  DO UPDATE SET
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
END $$;
