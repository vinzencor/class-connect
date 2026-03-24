import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { CalendarDays, Clock, Users, Save, Loader2, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, Lock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

/** Get Monday of the week containing a given date */
function getMonday(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Get all week-start Mondays for a given month */
function getWeeksInMonth(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  const firstDay = new Date(year, month, 1);
  let monday = getMonday(firstDay);
  // If Monday is in previous month but the week overlaps, include it
  while (monday.getMonth() <= month && monday.getFullYear() <= year || monday < firstDay) {
    weeks.push(new Date(monday));
    monday.setDate(monday.getDate() + 7);
    // Stop if we've passed the month entirely
    if (monday.getMonth() > month && monday.getFullYear() >= year) {
      // Include last week if it contains any days of the month
      const lastDayOfMonth = new Date(year, month + 1, 0);
      if (weeks[weeks.length - 1] <= lastDayOfMonth) {
        // already included
      }
      break;
    }
    if (monday.getFullYear() > year) break;
  }
  return weeks;
}

function formatWeekStartDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultWeekIndex(weeks: Date[], referenceDate: Date): number {
  if (!weeks.length) return 0;
  const referenceMonday = getMonday(referenceDate);
  const referenceKey = formatWeekStartDate(referenceMonday);
  const idx = weeks.findIndex(week => formatWeekStartDate(week) === referenceKey);
  return idx >= 0 ? idx : 0;
}

function formatCompactDate(date: Date): string {
  const shortYear = String(date.getFullYear()).slice(-2);
  return `${date.getDate()}/${date.getMonth() + 1}/${shortYear}`;
}

function getDatesInMonth(year: number, month: number): Date[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

function getDatesInRange(startDateStr: string, endDateStr: string): Date[] {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getWeekStartsInRange(startDateStr: string, endDateStr: string): string[] {
  const datesInRange = getDatesInRange(startDateStr, endDateStr);
  const weekStarts = new Set<string>();
  datesInRange.forEach(date => {
    weekStarts.add(formatWeekStartDate(getMonday(date)));
  });
  return Array.from(weekStarts);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getAvailabilityLabel(slots: TimeSlot[]): string {
  if (!slots || slots.length === 0) return '';
  
  let hasFN = false;
  let hasAN = false;
  
  slots.forEach(slot => {
    const startTime = slot.start_time;
    if (startTime < '12:30') {
      hasFN = true;
    } else {
      hasAN = true;
    }
  });

  if (hasFN && hasAN) return 'FN/AN';
  if (hasFN) return 'FN';
  if (hasAN) return 'AN';
  return '';
}

interface FacultyItem {
  id: string;
  full_name: string;
  short_name?: string | null;
  email: string;
}

interface FacultyDailyAvailability {
  availableSlots: number;
  totalSlots: number;
  slots: TimeSlot[];
}

interface FacultyMonthlyAvailability {
  faculty: FacultyItem;
  byDate: Record<string, FacultyDailyAvailability>;
  availableSlots: number;
  totalSlots: number;
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
  const [isWeekSubmitted, setIsWeekSubmitted] = useState(false);
  const [totalAvailabilityOpen, setTotalAvailabilityOpen] = useState(false);
  const [totalAvailabilityLoading, setTotalAvailabilityLoading] = useState(false);
  const [monthlyMatrix, setMonthlyMatrix] = useState<FacultyMonthlyAvailability[]>([]);

  // Month navigation state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [reportStartDate, setReportStartDate] = useState(() => formatWeekStartDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [reportEndDate, setReportEndDate] = useState(() => formatWeekStartDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [generatedStartDate, setGeneratedStartDate] = useState(() => formatWeekStartDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [generatedEndDate, setGeneratedEndDate] = useState(() => formatWeekStartDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [reportDates, setReportDates] = useState<Date[]>(() => getDatesInMonth(now.getFullYear(), now.getMonth()));
  const weeksInMonth = getWeeksInMonth(selectedYear, selectedMonth);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(() => {
    const currentMonthWeeks = getWeeksInMonth(now.getFullYear(), now.getMonth());
    return getDefaultWeekIndex(currentMonthWeeks, now);
  });

  const isFacultyUser = user?.role === 'faculty';
  const isAdmin = user?.role === 'admin';
  const isScheduleCoordinator = user?.role === 'schedule_coordinator';

  // Get the selected week's Monday
  const selectedWeekMonday = weeksInMonth[selectedWeekIdx] || weeksInMonth[0];
  const weekStartDateStr = selectedWeekMonday ? formatWeekStartDate(selectedWeekMonday) : null;

  // Restrict faculty from editing past weeks OR already-submitted weeks (admin can always edit)
  const isPastWeek = (() => {
    if (!selectedWeekMonday || isAdmin) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(selectedWeekMonday);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return weekEnd < today;
  })();

  // A week is read-only for faculty if it's past OR already submitted
  const isReadOnly = isPastWeek || (isFacultyUser && isWeekSubmitted);

  // Get dates for each day column
  const weekDates = DAYS_OF_WEEK.map(day => {
    if (!selectedWeekMonday) return null;
    const d = new Date(selectedWeekMonday);
    // day.value: Mon=1, Tue=2, ..., Sat=6, Sun=0
    const offset = day.value === 0 ? 6 : day.value - 1;
    d.setDate(d.getDate() + offset);
    return d;
  });
  const monthDates = getDatesInMonth(selectedYear, selectedMonth);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
    setSelectedWeekIdx(0);
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
    setSelectedWeekIdx(0);
  };

  useEffect(() => {
    // Keep current month pinned to the current week; other months default to first week.
    const today = new Date();
    if (selectedMonth === today.getMonth() && selectedYear === today.getFullYear()) {
      setSelectedWeekIdx(getDefaultWeekIndex(weeksInMonth, today));
      return;
    }
    if (selectedWeekIdx >= weeksInMonth.length) {
      setSelectedWeekIdx(0);
    }
  }, [selectedMonth, selectedYear, weeksInMonth, selectedWeekIdx]);

  useEffect(() => {
    if (user?.organizationId) {
      loadInitialData();
    }
  }, [user?.organizationId, currentBranchId]);

  useEffect(() => {
    if (selectedFaculty && user?.organizationId) {
      loadAvailability(selectedFaculty);
    }
  }, [selectedFaculty, weekStartDateStr]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Ensure default time slots exist
      const slots = await ensureDefaultTimeSlots(user!.organizationId!);
      setTimeSlots(slots);

      if (isAdmin || isScheduleCoordinator) {
        // Admin/Schedule Coordinator sees all faculty (filtered by branch)
        let q = supabase
          .from('profiles')
          .select('id, full_name, short_name, email')
          .eq('organization_id', user!.organizationId!)
          .eq('role', 'faculty')
          .order('full_name', { ascending: true });
        if (currentBranchId) q = q.eq('branch_id', currentBranchId);
        const { data } = await q;
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
        facultyId,
        weekStartDateStr
      );
      const map: Record<string, boolean> = {};
      data.forEach(a => {
        map[`${a.day_of_week}-${a.time_slot_id}`] = a.is_available;
      });
      setAvailability(map);
      // Mark as submitted if there are any saved records for this week
      setIsWeekSubmitted(data.length > 0);
      setDirty(false);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const loadMonthlyMatrix = async (startDateStr: string, endDateStr: string) => {
    if (!user?.organizationId || (!isAdmin && !isScheduleCoordinator)) return;

    setTotalAvailabilityLoading(true);
    try {
      const targetFaculties = faculties;
      const datesForReport = getDatesInRange(startDateStr, endDateStr);
      const dateKeysForReport = datesForReport.map(date => formatWeekStartDate(date));
      const reportDateKeySet = new Set(dateKeysForReport);
      const weekStartsForReport = getWeekStartsInRange(startDateStr, endDateStr);

      setReportDates(datesForReport);

      const matrixRows = await Promise.all(
        targetFaculties.map(async (faculty): Promise<FacultyMonthlyAvailability> => {
          const availableByDate = new Map<string, Set<string>>();
          dateKeysForReport.forEach(dateKey => availableByDate.set(dateKey, new Set<string>()));

          await Promise.all(
            weekStartsForReport.map(async (weekStartDate) => {
              const records = await getFacultyAvailability(
                user.organizationId,
                currentBranchId,
                faculty.id,
                weekStartDate
              );

              records.forEach(record => {
                if (!record.is_available) return;

                const monday = new Date(`${weekStartDate}T00:00:00`);
                const offset = record.day_of_week === 0 ? 6 : record.day_of_week - 1;
                monday.setDate(monday.getDate() + offset);

                const dateKey = formatWeekStartDate(monday);
                if (!reportDateKeySet.has(dateKey)) return;

                availableByDate.get(dateKey)?.add(record.time_slot_id);
              });
            })
          );

          const byDate: Record<string, FacultyDailyAvailability> = {};
          let availableSlots = 0;
          dateKeysForReport.forEach(dateKey => {
            const daySlotIds = Array.from(availableByDate.get(dateKey) || []);
            const daySlots = daySlotIds
              .map(id => timeSlots.find(s => s.id === id))
              .filter(Boolean) as TimeSlot[];
            const dayAvailableSlots = daySlots.length;
            byDate[dateKey] = {
              availableSlots: dayAvailableSlots,
              totalSlots: timeSlots.length,
              slots: daySlots,
            };
            availableSlots += dayAvailableSlots;
          });

          return {
            faculty,
            byDate,
            availableSlots,
            totalSlots: dateKeysForReport.length * timeSlots.length,
          };
        })
      );

      // Filter out faculties who haven't taken any classes
      const filteredMatrixRows = matrixRows.filter(row => row.availableSlots > 0);
      setMonthlyMatrix(filteredMatrixRows);
    } catch (error) {
      console.error('Error loading monthly faculty availability matrix:', error);
      toast.error('Failed to load total availability view');
      setMonthlyMatrix([]);
    } finally {
      setTotalAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    if (!totalAvailabilityOpen || (!isAdmin && !isScheduleCoordinator)) return;

    const monthStart = formatWeekStartDate(new Date(selectedYear, selectedMonth, 1));
    const monthEnd = formatWeekStartDate(new Date(selectedYear, selectedMonth + 1, 0));
    setReportStartDate(monthStart);
    setReportEndDate(monthEnd);
    setGeneratedStartDate(monthStart);
    setGeneratedEndDate(monthEnd);
    setReportDates(getDatesInMonth(selectedYear, selectedMonth));
    setMonthlyMatrix([]);
  }, [totalAvailabilityOpen, selectedMonth, selectedYear, isAdmin]);

  const handleGenerateTotalAvailability = async () => {
    if (!reportStartDate || !reportEndDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (reportStartDate > reportEndDate) {
      toast.error('Start date cannot be after end date');
      return;
    }

    if (!faculties.length || !timeSlots.length) {
      toast.error('No faculty or time slot data found');
      return;
    }

    await loadMonthlyMatrix(reportStartDate, reportEndDate);
    setGeneratedStartDate(reportStartDate);
    setGeneratedEndDate(reportEndDate);
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
            currentBranchId,
            weekStartDateStr
          );
        }
      }
      toast.success('Availability saved successfully');
      setIsWeekSubmitted(true);
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

  const exportTotalAvailabilityCsv = () => {
    if (!monthlyMatrix.length) {
      toast.error('No availability data to export');
      return;
    }

    const header = [
      'Faculty Name',
      ...reportDates.map(date => formatWeekStartDate(date)),
      'Total Available Slots',
      'Total Slots',
      'Availability %',
    ];

    const rows = monthlyMatrix.map(row => {
      const dailyCells = reportDates.map(date => {
        const dateKey = formatWeekStartDate(date);
        const dayData = row.byDate[dateKey];
        return dayData ? getAvailabilityLabel(dayData.slots) : '';
      });

      const availabilityPercent = row.totalSlots > 0
        ? ((row.availableSlots / row.totalSlots) * 100).toFixed(1)
        : '0.0';

      return [
        row.faculty.short_name || row.faculty.full_name,
        ...dailyCells,
        row.availableSlots.toString(),
        row.totalSlots.toString(),
        `${availabilityPercent}%`,
      ];
    });

    const csv = [header, ...rows]
      .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `faculty-total-availability-${generatedStartDate}-to-${generatedEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Total availability report exported');
  };

  const exportTotalAvailabilityPdf = () => {
    if (!monthlyMatrix.length) {
      toast.error('No availability data to export');
      return;
    }

    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text(`Faculty Availability Report (${generatedStartDate} to ${generatedEndDate})`, 14, 15);
    
    const header = [
      'Faculty Name',
      ...reportDates.map(date => `${date.getDate()} ${DAYS_OF_WEEK.find(day => day.value === date.getDay())?.short}`),
      'Total',
      '%'
    ];
    
    const rows = monthlyMatrix.map(row => {
      const dailyCells = reportDates.map(date => {
        const dateKey = formatWeekStartDate(date);
        const dayData = row.byDate[dateKey];
        return dayData ? getAvailabilityLabel(dayData.slots) : '';
      });

      const availabilityPercent = row.totalSlots > 0
        ? ((row.availableSlots / row.totalSlots) * 100).toFixed(1)
        : '0.0';

      return [
        row.faculty.short_name || row.faculty.full_name,
        ...dailyCells,
        `${row.availableSlots}/${row.totalSlots}`,
        `${availabilityPercent}%`,
      ];
    });

    autoTable(doc, {
      head: [header],
      body: rows,
      startY: 25,
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [66, 66, 66] },
    });

    doc.save(`faculty-total-availability-${generatedStartDate}-to-${generatedEndDate}.pdf`);
    toast.success('Total availability PDF exported');
  };

  const exportIndividualPdf = (row: FacultyMonthlyAvailability) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`Faculty Availability Report`, 14, 15);
    
    doc.setFontSize(12);
    doc.text(`Name: ${row.faculty.short_name || row.faculty.full_name}`, 14, 25);
    doc.text(`Period: ${generatedStartDate} to ${generatedEndDate}`, 14, 32);
    
    const availabilityPercent = row.totalSlots > 0
      ? ((row.availableSlots / row.totalSlots) * 100).toFixed(1)
      : '0.0';
    doc.text(`Total Availability: ${row.availableSlots}/${row.totalSlots} (${availabilityPercent}%)`, 14, 39);

    const header = ['Date', 'Day', 'Availability'];
    
    const bodyRows = reportDates.map(date => {
      const dateKey = formatWeekStartDate(date);
      const dayData = row.byDate[dateKey];
      const dayName = DAYS_OF_WEEK.find(day => day.value === date.getDay())?.label || '';
      const label = dayData ? getAvailabilityLabel(dayData.slots) : '';
      return [
        formatCompactDate(date),
        dayName,
        label || '-'
      ];
    });

    autoTable(doc, {
      head: [header],
      body: bodyRows,
      startY: 45,
    });

    doc.save(`faculty-availability-${row.faculty.id}.pdf`);
    toast.success(`Exported PDF for ${row.faculty.short_name || row.faculty.full_name}`);
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
            Set monthly availability for class scheduling
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(isAdmin || isScheduleCoordinator) && (
            <Button
              variant="outline"
              onClick={() => setTotalAvailabilityOpen(true)}
              disabled={!faculties.length || !timeSlots.length}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              See Total Availability
            </Button>
          )}
          {dirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Unsaved changes
            </Badge>
          )}
          {isReadOnly && !isAdmin && (
            <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
              <Lock className="w-3 h-3 mr-1" />
              {isPastWeek ? 'Past week — read only' : 'Already submitted — read only'}
            </Badge>
          )}
          {!isReadOnly && (
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Availability</>
              )}
            </Button>
          )}
          {isAdmin && (
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Save Availability</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Faculty Selector (Admin / Schedule Coordinator) */}
      {(isAdmin || isScheduleCoordinator) && (
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
                      {f.short_name || f.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month & Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[180px] text-center">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {weeksInMonth.map((monday, idx) => {
                const sunday = new Date(monday);
                sunday.setDate(sunday.getDate() + 6);
                const label = `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()].slice(0,3)} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()].slice(0,3)}`;
                return (
                  <Button
                    key={idx}
                    variant={selectedWeekIdx === idx ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setSelectedWeekIdx(idx); }}
                  >
                    Week {idx + 1}
                    <span className="hidden sm:inline ml-1 text-xs opacity-70">({label})</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

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
              {selectedWeekMonday ? `Week ${selectedWeekIdx + 1} — ${selectedWeekMonday.getDate()} ${MONTH_NAMES[selectedWeekMonday.getMonth()].slice(0,3)} ${selectedWeekMonday.getFullYear()}` : 'Availability'}
            </CardTitle>
            <CardDescription>
              Check the boxes for time slots when the faculty member is available for this week
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
                    {DAYS_OF_WEEK.map((day, idx) => {
                      const dateObj = weekDates[idx];
                      const dateLabel = dateObj ? formatCompactDate(dateObj) : '';
                      return (
                      <th key={day.value} className="p-3 text-center border-b min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-medium">{day.short}</span>
                          {dateLabel && <span className="text-[10px] text-muted-foreground">{dateLabel}</span>}
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
                      );
                    })}
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
                            disabled={isReadOnly}
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
                              className={`w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center ${
                                isReadOnly
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'cursor-pointer'
                              } ${
                                isAvailable
                                  ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                                  : 'bg-muted/30 border-muted hover:border-muted-foreground/30'
                              }`}
                              onClick={() => !isReadOnly && toggleAvailability(day.value, slot.id)}
                            >
                              <Checkbox
                                checked={isAvailable}
                                disabled={isReadOnly}
                                onCheckedChange={() => !isReadOnly && toggleAvailability(day.value, slot.id)}
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

      <Dialog open={totalAvailabilityOpen} onOpenChange={setTotalAvailabilityOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Total Faculty Availability Report
            </DialogTitle>
            <DialogDescription>
              Select a date range, generate the report, and then download it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
              <div className="space-y-1">
                <Label htmlFor="report-start-date">From</Label>
                <input
                  id="report-start-date"
                  type="date"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={reportStartDate}
                  onChange={(event) => setReportStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-end-date">To</Label>
                <input
                  id="report-end-date"
                  type="date"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={reportEndDate}
                  onChange={(event) => setReportEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleGenerateTotalAvailability} disabled={totalAvailabilityLoading}>
                {totalAvailabilityLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  'Generate Report'
                )}
              </Button>
            <Button
              variant="outline"
              onClick={exportTotalAvailabilityCsv}
              disabled={totalAvailabilityLoading || monthlyMatrix.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              onClick={exportTotalAvailabilityPdf}
              disabled={totalAvailabilityLoading || monthlyMatrix.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            {totalAvailabilityLoading ? (
              <div className="h-56 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-background z-10">
                  <tr>
                    <th className="p-2 text-left border-b min-w-[180px]">Faculty</th>
                    {reportDates.map(date => (
                      <th key={date.toISOString()} className="p-2 text-center border-b min-w-[56px]">
                        <div className="flex flex-col items-center">
                          <span className="font-medium">{date.getDate()}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {DAYS_OF_WEEK.find(day => day.value === date.getDay())?.short}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="p-2 text-center border-b min-w-[90px]">Total</th>
                    <th className="p-2 text-center border-b min-w-[90px]">%</th>
                    <th className="p-2 text-center border-b min-w-[60px]">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyMatrix.map(row => {
                    const percentage = row.totalSlots > 0
                      ? Math.round((row.availableSlots / row.totalSlots) * 100)
                      : 0;

                    return (
                      <tr key={row.faculty.id} className="border-b last:border-b-0">
                        <td className="p-2 font-medium sticky left-0 bg-background">
                          {row.faculty.short_name || row.faculty.full_name}
                        </td>
                        {reportDates.map(date => {
                          const dateKey = formatWeekStartDate(date);
                          const dayData = row.byDate[dateKey] || {
                            availableSlots: 0,
                            totalSlots: timeSlots.length,
                            slots: [],
                          };
                          const label = getAvailabilityLabel(dayData.slots);
                          return (
                            <td key={dateKey} className="p-2 text-center">
                              <span className={label ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
                                {label || '-'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-medium">
                          {row.availableSlots}/{row.totalSlots}
                        </td>
                        <td className="p-2 text-center font-medium">
                          {percentage}%
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => exportIndividualPdf(row)}
                            title="Download Individual PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {!monthlyMatrix.length && (
                    <tr>
                      <td colSpan={reportDates.length + 4} className="p-8 text-center text-muted-foreground">
                        Generate a report to view faculty availability for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
