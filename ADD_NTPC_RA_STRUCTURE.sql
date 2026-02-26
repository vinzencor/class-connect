-- Copies RA module and all its sub-modules
-- from SSC REGULAR COURSE -> NTPC.
-- Safe to run multiple times (uses upsert behavior).

DO $$
DECLARE
  v_source_subject_id UUID;
  v_target_subject_id UUID;
  v_organization_id UUID;
  v_branch_id UUID;
  v_source_group_id UUID;
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

  -- 3) Find RA source group (supports RA or Reasoning naming)
  SELECT g.id
  INTO v_source_group_id
  FROM module_groups g
  WHERE g.subject_id = v_source_subject_id
    AND (
      UPPER(TRIM(g.name)) = 'RA'
      OR g.name ILIKE '%REASONING%'
    )
  ORDER BY
    CASE WHEN UPPER(TRIM(g.name)) = 'RA' THEN 0 ELSE 1 END,
    g.sort_order ASC,
    g.created_at ASC
  LIMIT 1;

  IF v_source_group_id IS NULL THEN
    RAISE EXCEPTION 'RA group not found under SSC REGULAR COURSE. Expected name RA or containing REASONING.';
  END IF;

  -- 4) Upsert RA group into NTPC
  WITH source_ra AS (
    SELECT
      g.id,
      g.name,
      g.description,
      g.sort_order,
      g.branch_id
    FROM module_groups g
    WHERE g.id = v_source_group_id
  )
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
    COALESCE(s.branch_id, v_branch_id),
    s.name,
    s.description,
    s.sort_order
  FROM source_ra s
  ON CONFLICT (subject_id, name)
  DO UPDATE SET
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

  -- 5) Upsert all RA sub-groups into NTPC RA
  WITH target_ra AS (
    SELECT id
    FROM module_groups
    WHERE subject_id = v_target_subject_id
      AND name = (SELECT name FROM module_groups WHERE id = v_source_group_id)
    LIMIT 1
  )
  INSERT INTO module_sub_groups (
    group_id,
    organization_id,
    branch_id,
    name,
    description,
    sort_order
  )
  SELECT
    (SELECT id FROM target_ra),
    v_organization_id,
    COALESCE(ssg.branch_id, v_branch_id),
    ssg.name,
    ssg.description,
    ssg.sort_order
  FROM module_sub_groups ssg
  WHERE ssg.group_id = v_source_group_id
  ON CONFLICT (group_id, name)
  DO UPDATE SET
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
END $$;
