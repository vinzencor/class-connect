import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { supabase } from '@/lib/supabase';
import {
  getTimeSlots,
  getFacultyAvailability,
  setFacultyAvailability,
  ensureDefaultTimeSlots,
  type TimeSlot,
  type FacultyAvailability,
} from '@/services/facultyAvailabilityService';
import { toast } from 'sonner';
import { CalendarDays, Clock, Users, Save, Loader2, CheckCircle2 } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

interface FacultyItem {
  id: string;
  full_name: string;
  email: string;
}

export default function FacultyAvailabilityPage() {
  const { user } = useAuth();
  const { currentBranchId } = useBranch();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isFacultyUser = user?.role === 'faculty';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (user?.organizationId) {
      loadInitialData();
    }
  }, [user?.organizationId]);

  useEffect(() => {
    if (selectedFaculty && user?.organizationId) {
      loadAvailability(selectedFaculty);
    }
  }, [selectedFaculty]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Ensure default time slots exist
      const slots = await ensureDefaultTimeSlots(user!.organizationId!);
      setTimeSlots(slots);

      if (isAdmin) {
        // Admin sees all faculty
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('organization_id', user!.organizationId!)
          .eq('role', 'faculty')
          .order('full_name', { ascending: true });
        setFaculties(data || []);
        if (data && data.length > 0) {
          setSelectedFaculty(data[0].id);
        }
      } else if (isFacultyUser) {
        // Faculty sees only their own
        setSelectedFaculty(user!.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (facultyId: string) => {
    try {
      const data = await getFacultyAvailability(
        user!.organizationId!,
        currentBranchId,
        facultyId
      );
      const map: Record<string, boolean> = {};
      data.forEach(a => {
        map[`${a.day_of_week}-${a.time_slot_id}`] = a.is_available;
      });
      setAvailability(map);
      setDirty(false);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const toggleAvailability = (dayOfWeek: number, timeSlotId: string) => {
    const key = `${dayOfWeek}-${timeSlotId}`;
    setAvailability(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedFaculty || !user?.organizationId) return;
    setSaving(true);
    try {
      for (const day of DAYS_OF_WEEK) {
        for (const slot of timeSlots) {
          const key = `${day.value}-${slot.id}`;
          const isAvail = availability[key] || false;
          await setFacultyAvailability(
            user.organizationId,
            selectedFaculty,
            day.value,
            slot.id,
            isAvail,
            currentBranchId
          );
        }
      }
      toast.success('Availability saved successfully');
      setDirty(false);
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const setAllDay = (dayOfWeek: number, available: boolean) => {
    setAvailability(prev => {
      const next = { ...prev };
      timeSlots.forEach(slot => {
        next[`${dayOfWeek}-${slot.id}`] = available;
      });
      return next;
    });
    setDirty(true);
  };

  const setAllSlot = (timeSlotId: string, available: boolean) => {
    setAvailability(prev => {
      const next = { ...prev };
      DAYS_OF_WEEK.forEach(day => {
        next[`${day.value}-${timeSlotId}`] = available;
      });
      return next;
    });
    setDirty(true);
  };

  const availableCount = Object.values(availability).filter(Boolean).length;
  const totalSlots = DAYS_OF_WEEK.length * timeSlots.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Faculty Availability
          </h1>
          <p className="text-muted-foreground mt-1">
            Set weekly availability for class scheduling
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Unsaved changes
            </Badge>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />Save Availability</>
            )}
          </Button>
        </div>
      </div>

      {/* Faculty Selector (Admin only) */}
      {isAdmin && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label>Faculty Member</Label>
              </div>
              <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{DAYS_OF_WEEK.length}</p>
                <p className="text-xs text-muted-foreground">Days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{timeSlots.length}</p>
                <p className="text-xs text-muted-foreground">Time Slots</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{availableCount}</p>
                <p className="text-xs text-muted-foreground">Available Slots</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSlots - availableCount}</p>
                <p className="text-xs text-muted-foreground">Unavailable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Availability Grid */}
      {selectedFaculty && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Weekly Availability
            </CardTitle>
            <CardDescription>
              Check the boxes for time slots when the faculty member is available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 text-left text-sm font-medium text-muted-foreground border-b">
                      Time Slot
                    </th>
                    {DAYS_OF_WEEK.map(day => (
                      <th key={day.value} className="p-3 text-center border-b min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-medium">{day.short}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-5 px-1"
                            onClick={() => {
                              const allAvailable = timeSlots.every(
                                slot => availability[`${day.value}-${slot.id}`]
                              );
                              setAllDay(day.value, !allAvailable);
                            }}
                          >
                            {timeSlots.every(slot => availability[`${day.value}-${slot.id}`])
                              ? 'Clear'
                              : 'All'}
                          </Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(slot => (
                    <tr key={slot.id} className="border-b last:border-b-0">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-medium">{slot.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {slot.start_time} - {slot.end_time}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-5 px-1 ml-auto"
                            onClick={() => {
                              const allAvailable = DAYS_OF_WEEK.every(
                                day => availability[`${day.value}-${slot.id}`]
                              );
                              setAllSlot(slot.id, !allAvailable);
                            }}
                          >
                            {DAYS_OF_WEEK.every(day => availability[`${day.value}-${slot.id}`])
                              ? 'Clear'
                              : 'All'}
                          </Button>
                        </div>
                      </td>
                      {DAYS_OF_WEEK.map(day => {
                        const key = `${day.value}-${slot.id}`;
                        const isAvailable = availability[key] || false;
                        return (
                          <td key={day.value} className="p-3 text-center">
                            <div
                              className={`w-full h-12 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-center ${
                                isAvailable
                                  ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                                  : 'bg-muted/30 border-muted hover:border-muted-foreground/30'
                              }`}
                              onClick={() => toggleAvailability(day.value, slot.id)}
                            >
                              <Checkbox
                                checked={isAvailable}
                                onCheckedChange={() => toggleAvailability(day.value, slot.id)}
                                className={isAvailable ? 'text-emerald-600 border-emerald-600' : ''}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedFaculty && !isFacultyUser && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Faculty Selected</p>
            <p className="text-sm">Select a faculty member to manage their availability</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
