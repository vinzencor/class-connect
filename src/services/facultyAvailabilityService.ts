/**
 * Faculty Availability Service
 * Manages time slots and faculty availability for scheduling
 */

import { supabase } from '@/lib/supabase';

export interface TimeSlot {
  id: string;
  organization_id: string;
  name: string;
  start_time: string;
  end_time: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FacultyAvailability {
  id: string;
  organization_id: string;
  branch_id: string | null;
  faculty_id: string;
  day_of_week: number;
  time_slot_id: string;
  is_available: boolean;
  week_start_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── Time Slots CRUD ────────────────────────────────────────

export async function getTimeSlots(organizationId: string): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createTimeSlot(
  organizationId: string,
  slot: { name: string; start_time: string; end_time: string }
): Promise<TimeSlot> {
  // Get max sort_order
  const { data: maxData } = await supabase
    .from('time_slots')
    .select('sort_order')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxData?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('time_slots')
    .insert({
      organization_id: organizationId,
      name: slot.name,
      start_time: slot.start_time,
      end_time: slot.end_time,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTimeSlot(
  slotId: string,
  updates: { name?: string; start_time?: string; end_time?: string }
): Promise<TimeSlot> {
  const { data, error } = await supabase
    .from('time_slots')
    .update(updates)
    .eq('id', slotId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTimeSlot(slotId: string): Promise<void> {
  const { error } = await supabase
    .from('time_slots')
    .delete()
    .eq('id', slotId);

  if (error) throw error;
}

export async function ensureDefaultTimeSlots(organizationId: string): Promise<TimeSlot[]> {
  const existing = await getTimeSlots(organizationId);
  if (existing.length > 0) return existing;

  // Create default slots
  const defaults = [
    { name: 'Morning', start_time: '09:00', end_time: '12:00' },
    { name: 'Afternoon', start_time: '13:00', end_time: '17:00' },
  ];

  const created: TimeSlot[] = [];
  for (const slot of defaults) {
    const s = await createTimeSlot(organizationId, slot);
    created.push(s);
  }
  return created;
}

// ── Faculty Availability CRUD ──────────────────────────────

export async function getFacultyAvailability(
  organizationId: string,
  branchId?: string | null,
  facultyId?: string,
  weekStartDate?: string | null
): Promise<FacultyAvailability[]> {
  let query = supabase
    .from('faculty_availability')
    .select('*')
    .eq('organization_id', organizationId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }
  if (facultyId) {
    query = query.eq('faculty_id', facultyId);
  }
  if (weekStartDate) {
    query = query.eq('week_start_date', weekStartDate);
  } else {
    query = query.is('week_start_date', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function setFacultyAvailability(
  organizationId: string,
  facultyId: string,
  dayOfWeek: number,
  timeSlotId: string,
  isAvailable: boolean,
  branchId?: string | null,
  weekStartDate?: string | null
): Promise<FacultyAvailability> {
  // Upsert — try to find existing record
  const { data: existing } = await supabase
    .from('faculty_availability')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('faculty_id', facultyId)
    .eq('day_of_week', dayOfWeek)
    .eq('time_slot_id', timeSlotId)
    .is('week_start_date', weekStartDate ?? null)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('faculty_availability')
      .update({ is_available: isAvailable })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('faculty_availability')
      .insert({
        organization_id: organizationId,
        branch_id: branchId || null,
        faculty_id: facultyId,
        day_of_week: dayOfWeek,
        time_slot_id: timeSlotId,
        is_available: isAvailable,
        week_start_date: weekStartDate || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function bulkSetFacultyAvailability(
  organizationId: string,
  facultyId: string,
  entries: Array<{ dayOfWeek: number; timeSlotId: string; isAvailable: boolean }>,
  branchId?: string | null,
  weekStartDate?: string | null
): Promise<void> {
  for (const entry of entries) {
    await setFacultyAvailability(
      organizationId,
      facultyId,
      entry.dayOfWeek,
      entry.timeSlotId,
      entry.isAvailable,
      branchId,
      weekStartDate
    );
  }
}

/**
 * Get available faculty for a specific day and time slot
 * Used by scheduling to filter faculty dropdown
 */
export async function getAvailableFaculty(
  organizationId: string,
  dayOfWeek: number,
  timeSlotId: string,
  branchId?: string | null
): Promise<string[]> {
  let query = supabase
    .from('faculty_availability')
    .select('faculty_id')
    .eq('organization_id', organizationId)
    .eq('day_of_week', dayOfWeek)
    .eq('time_slot_id', timeSlotId)
    .eq('is_available', true)
    .is('week_start_date', null);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(d => d.faculty_id);
}

/**
 * Get faculty IDs that are already assigned to sessions on a given date and time range
 */
export async function getAssignedFaculty(
  organizationId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<string[]> {
  // Build datetime range for the given date
  const dayStart = `${date}T${startTime}:00`;
  const dayEnd = `${date}T${endTime}:00`;

  const { data, error } = await supabase
    .from('sessions')
    .select('faculty_id')
    .eq('organization_id', organizationId)
    .not('faculty_id', 'is', null)
    .lt('start_time', dayEnd)
    .gt('end_time', dayStart);

  if (error) throw error;
  const facultyIds = new Set<string>();
  (data || []).forEach((s: any) => {
    if (s.faculty_id) facultyIds.add(s.faculty_id);
  });
  return Array.from(facultyIds);
}

/**
 * Get unavailable faculty IDs for a specific day + time range.
 * Finds time slots that overlap with [startTime, endTime], then
 * returns faculty who marked themselves unavailable in ANY overlapping slot.
 */
export async function getUnavailableFacultyByTime(
  organizationId: string,
  dayOfWeek: number,
  startTime: string,   // "HH:mm"
  endTime: string,      // "HH:mm"
  branchId?: string | null
): Promise<string[]> {
  // 1. Fetch all time slots for the org
  const slots = await getTimeSlots(organizationId);
  if (slots.length === 0) return [];

  // 2. Find slots that overlap the session time
  const overlappingSlotIds = slots
    .filter(slot => {
      // slot.start_time / slot.end_time are "HH:mm:ss" or "HH:mm"
      const slotStart = slot.start_time.substring(0, 5);
      const slotEnd = slot.end_time.substring(0, 5);
      return slotStart < endTime && slotEnd > startTime;
    })
    .map(s => s.id);

  if (overlappingSlotIds.length === 0) return [];

  // 3. Query availability records where is_available = false
  let query = supabase
    .from('faculty_availability')
    .select('faculty_id')
    .eq('organization_id', organizationId)
    .eq('day_of_week', dayOfWeek)
    .in('time_slot_id', overlappingSlotIds)
    .eq('is_available', false)
    .is('week_start_date', null);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const ids = new Set<string>();
  (data || []).forEach((d: any) => ids.add(d.faculty_id));
  return Array.from(ids);
}
