import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { batchService } from '@/services/batchService';
import { classService } from '@/services/classService';
import { Tables } from '@/types/database';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getUnavailableFacultyByTime } from '@/services/facultyAvailabilityService';
import {
    ArrowLeft,
    Video,
    Calendar as CalendarIcon,
    Clock,
    BookOpen,
    Users,
    Plus,
    X,
    Trash2,
    ChevronRight
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { createGoogleMeetLink } from '@/services/googleCalendarService';

interface ClassItem {
    id: string;
    name: string;
}

interface ModuleGroup {
    id: string;
    name: string;
    sort_order: number;
}

interface SubjectWithGroups {
    id: string;
    name: string;
    groups: ModuleGroup[];
}

interface FacultyItem {
    id: string;
    full_name: string;
    email: string;
}

type Batch = Tables<'batches'>;

interface SessionEntry {
    id: string;
    sessionName: string;
    classId: string;
    newClassName: string;
    batchIds: string[];
    moduleIds: string[];
    moduleGroupIds: string[];
    facultyId: string;
    startTime: string;
    endTime: string;
}

interface DateSessions {
    date: Date;
    sessions: SessionEntry[];
}

interface ExistingSession {
    classId: string;
    dateStr: string;
    startMinutes: number;
    endMinutes: number;
}

interface PlannedSession {
    sessionId: string;
    classId: string;
    dateStr: string;
    startMinutes: number;
    endMinutes: number;
    batchIds: string[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const createEmptySession = (): SessionEntry => ({
    id: generateId(),
    sessionName: '',
    classId: '',
    newClassName: '',
    batchIds: [],
    moduleIds: [],
    moduleGroupIds: [],
    facultyId: '',
    startTime: '10:30',
    endTime: '12:30',
});

export default function CreateSessionPage() {
    const { user, profile } = useAuth();
    const { currentBranchId } = useBranch();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectWithGroups[]>([]);
    const [faculties, setFaculties] = useState<FacultyItem[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [classBatchMap, setClassBatchMap] = useState<Record<string, string[]>>({});
    const [existingSessions, setExistingSessions] = useState<ExistingSession[]>([]);
    const [existingFacultySessions, setExistingFacultySessions] = useState<{facultyId: string; dateStr: string; startMinutes: number; endMinutes: number}[]>([]);
    const [facultySubjectMap, setFacultySubjectMap] = useState<Record<string, string[]>>({});
    const [moduleCompletions, setModuleCompletions] = useState<Record<string, boolean>>({});

    // Faculty availability — maps "facultyId" → Set of dateStr where they're unavailable
    const [unavailableFacultyMap, setUnavailableFacultyMap] = useState<Record<string, Set<string>>>({});

    // Multi-date session state
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [dateSessions, setDateSessions] = useState<DateSessions[]>([]);
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Get organization ID from user or profile
    const organizationId = user?.organizationId || profile?.organization_id;

    useEffect(() => {
        if (user?.organizationId) {
            fetchData();
        }
    }, [user?.organizationId]);

    // Fetch faculty availability for selected dates and session times
    useEffect(() => {
        if (!organizationId || selectedDates.length === 0 || dateSessions.length === 0) {
            setUnavailableFacultyMap({});
            return;
        }

        const fetchAvailability = async () => {
            try {
                const map: Record<string, Set<string>> = {};
                // For each date+session combo, fetch unavailable faculty
                for (const ds of dateSessions) {
                    const dayOfWeek = ds.date.getDay();
                    const dateStr = format(ds.date, 'yyyy-MM-dd');
                    for (const session of ds.sessions) {
                        if (!session.startTime || !session.endTime) continue;
                        const unavailable = await getUnavailableFacultyByTime(
                            organizationId!,
                            dayOfWeek,
                            session.startTime,
                            session.endTime,
                            currentBranchId
                        );
                        for (const fId of unavailable) {
                            if (!map[fId]) map[fId] = new Set();
                            map[fId].add(dateStr);
                        }
                    }
                }
                setUnavailableFacultyMap(map);
            } catch (err) {
                console.error('Error fetching faculty availability:', err);
            }
        };
        fetchAvailability();
    }, [organizationId, currentBranchId, selectedDates, dateSessions]);

    // Fetch module completions whenever batch selections change across any session
    useEffect(() => {
        const allBatchIds = new Set<string>();
        for (const ds of dateSessions) {
            for (const session of ds.sessions) {
                for (const bId of (session.batchIds || [])) {
                    allBatchIds.add(bId);
                }
            }
        }
        if (allBatchIds.size === 0 || !organizationId) {
            setModuleCompletions({});
            return;
        }

        const fetchCompletions = async () => {
            try {
                const { data, error } = await supabase
                    .from('module_completion')
                    .select('module_group_id, batch_id')
                    .eq('organization_id', organizationId)
                    .in('batch_id', Array.from(allBatchIds));
                if (error) throw error;
                const map: Record<string, boolean> = {};
                (data || []).forEach((row: any) => {
                    map[row.module_group_id] = true;
                });
                setModuleCompletions(map);
            } catch (err) {
                console.error('Error fetching module completions:', err);
            }
        };
        fetchCompletions();
    }, [organizationId, dateSessions]);

    useEffect(() => {
        if (!organizationId || selectedDates.length === 0) {
            setExistingSessions([]);
            return;
        }

        const minDate = new Date(Math.min(...selectedDates.map(date => date.getTime())));
        const maxDate = new Date(Math.max(...selectedDates.map(date => date.getTime())));
        minDate.setHours(0, 0, 0, 0);
        maxDate.setHours(23, 59, 59, 999);

        const fetchExistingSessions = async () => {
            try {
                const { data, error } = await supabase
                    .from('sessions')
                    .select('class_id, faculty_id, start_time, end_time')
                    .eq('organization_id', organizationId)
                    .gte('start_time', minDate.toISOString())
                    .lte('start_time', maxDate.toISOString());

                if (error) throw error;

                const mapped = (data || [])
                    .filter((session: any) => session.class_id)
                    .map((session: any) => {
                        const startDate = new Date(session.start_time);
                        const endDate = new Date(session.end_time);
                        return {
                            classId: session.class_id,
                            dateStr: format(startDate, 'yyyy-MM-dd'),
                            startMinutes: startDate.getHours() * 60 + startDate.getMinutes(),
                            endMinutes: endDate.getHours() * 60 + endDate.getMinutes(),
                        };
                    });

                setExistingSessions(mapped);

                // Also build faculty session map for conflict detection
                const facultyMapped = (data || [])
                    .filter((session: any) => session.faculty_id)
                    .map((session: any) => {
                        const startDate = new Date(session.start_time);
                        const endDate = new Date(session.end_time);
                        return {
                            facultyId: session.faculty_id,
                            dateStr: format(startDate, 'yyyy-MM-dd'),
                            startMinutes: startDate.getHours() * 60 + startDate.getMinutes(),
                            endMinutes: endDate.getHours() * 60 + endDate.getMinutes(),
                        };
                    });
                setExistingFacultySessions(facultyMapped);
            } catch (error) {
                console.error('Error fetching existing sessions:', error);
                toast.error('Failed to load existing sessions');
            }
        };

        fetchExistingSessions();
    }, [organizationId, selectedDates]);

    const fetchData = async () => {
        try {
            const { data: classesData } = await supabase
                .from('classes')
                .select('id, name')
                .eq('organization_id', user?.organizationId);
            setClasses(classesData || []);

            if (classesData && classesData.length > 0) {
                const classIds = classesData.map(cls => cls.id);
                const { data: classBatchData, error: classBatchError } = await supabase
                    .from('class_batches')
                    .select('class_id, batch_id')
                    .in('class_id', classIds);

                if (classBatchError) throw classBatchError;

                const batchMap = (classBatchData || []).reduce((acc: Record<string, string[]>, row: any) => {
                    if (!acc[row.class_id]) {
                        acc[row.class_id] = [];
                    }
                    acc[row.class_id].push(row.batch_id);
                    return acc;
                }, {} as Record<string, string[]>);

                setClassBatchMap(batchMap);
            } else {
                setClassBatchMap({});
            }

            // Fetch hierarchical module subjects with groups
            const { data: subjectsData } = await supabase
                .from('module_subjects')
                .select('id, name')
                .eq('organization_id', user?.organizationId)
                .order('sort_order', { ascending: true });
            if (subjectsData && subjectsData.length > 0) {
                const subjectIds = subjectsData.map(s => s.id);
                const { data: groupsData } = await supabase
                    .from('module_groups')
                    .select('id, name, subject_id, sort_order')
                    .in('subject_id', subjectIds)
                    .order('sort_order', { ascending: true });
                const subjectsWithGroups: SubjectWithGroups[] = subjectsData.map(s => ({
                    id: s.id,
                    name: s.name,
                    groups: (groupsData || [])
                        .filter(g => g.subject_id === s.id)
                        .map(g => ({ id: g.id, name: g.name, sort_order: g.sort_order })),
                }));
                setSubjects(subjectsWithGroups);
            } else {
                setSubjects([]);
            }

            const { data: facultyData } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('organization_id', user?.organizationId)
                .eq('role', 'faculty');
            setFaculties(facultyData || []);

            // Fetch faculty → subject mapping
            const { data: fsMappings } = await supabase
                .from('faculty_subjects')
                .select('faculty_id, subject_id')
                .eq('organization_id', user?.organizationId);
            if (fsMappings) {
                const map: Record<string, string[]> = {};
                fsMappings.forEach((row: any) => {
                    if (!map[row.faculty_id]) map[row.faculty_id] = [];
                    map[row.faculty_id].push(row.subject_id);
                });
                setFacultySubjectMap(map);
            }

            const batchesData = await batchService.getBatches(user?.organizationId || '', currentBranchId);
            setBatches(batchesData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load form data');
        }
    };

    // Handle date selection from calendar
    const handleDateSelect = (dates: Date[] | undefined) => {
        if (!dates) {
            setSelectedDates([]);
            setDateSessions([]);
            return;
        }

        setSelectedDates(dates);

        // Update dateSessions to match selected dates
        setDateSessions(prev => {
            const updated: DateSessions[] = [];
            dates.forEach(date => {
                const existing = prev.find(ds => isSameDay(ds.date, date));
                if (existing) {
                    updated.push(existing);
                } else {
                    updated.push({
                        date,
                        sessions: [createEmptySession()]
                    });
                }
            });
            // Sort by date
            return updated.sort((a, b) => a.date.getTime() - b.date.getTime());
        });
    };

    const removeDate = (dateToRemove: Date) => {
        setSelectedDates(prev => prev.filter(d => !isSameDay(d, dateToRemove)));
        setDateSessions(prev => prev.filter(ds => !isSameDay(ds.date, dateToRemove)));
    };

    const addSessionToDate = (date: Date) => {
        setDateSessions(prev => prev.map(ds =>
            isSameDay(ds.date, date)
                ? { ...ds, sessions: [...ds.sessions, createEmptySession()] }
                : ds
        ));
    };

    const removeSession = (date: Date, sessionId: string) => {
        setDateSessions(prev => prev.map(ds => {
            if (!isSameDay(ds.date, date)) return ds;
            const newSessions = ds.sessions.filter(s => s.id !== sessionId);
            // Keep at least one session
            return {
                ...ds,
                sessions: newSessions.length > 0 ? newSessions : [createEmptySession()]
            };
        }));
    };

    const updateSession = (date: Date, sessionId: string, updates: Partial<SessionEntry>) => {
        setDateSessions(prev => prev.map(ds => {
            if (!isSameDay(ds.date, date)) return ds;
            return {
                ...ds,
                sessions: ds.sessions.map(s =>
                    s.id === sessionId ? { ...s, ...updates } : s
                )
            };
        }));
    };

    const generateMeetLink = () => {
        return `https://meet.google.com/${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7)}`;
    };

    // Gather attendee emails for a session (faculty + enrolled students)
    const getAttendeeEmails = async (classId: string | undefined, facultyId: string): Promise<{ email: string }[]> => {
        const attendees: { email: string }[] = [];

        // Add faculty email
        const faculty = faculties.find(f => f.id === facultyId);
        if (faculty?.email) {
            attendees.push({ email: faculty.email });
        }

        // Add enrolled student emails if class exists
        if (classId && classId !== 'new') {
            try {
                const { data: enrolledStudents } = await supabase
                    .from('class_enrollments')
                    .select('profiles!inner(email)')
                    .eq('class_id', classId);

                if (enrolledStudents) {
                    for (const enrollment of enrolledStudents) {
                        const profile = enrollment.profiles as unknown as { email: string };
                        if (profile?.email) {
                            attendees.push({ email: profile.email });
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch enrolled students:', err);
            }
        }

        return attendees;
    };

    const parseTimeToMinutes = (time: string) => {
        if (!time) return Number.NaN;
        const trimmed = time.trim();

        if (trimmed.includes('AM') || trimmed.includes('PM')) {
            const [timePart, meridiemPart] = trimmed.split(' ');
            const [hoursStr, minutesStr] = timePart.split(':');
            let hours = Number(hoursStr);
            const minutes = Number(minutesStr);
            const meridiem = meridiemPart?.toUpperCase();

            if (Number.isNaN(hours) || Number.isNaN(minutes) || !meridiem) return Number.NaN;
            if (meridiem === 'PM' && hours < 12) hours += 12;
            if (meridiem === 'AM' && hours === 12) hours = 0;

            return hours * 60 + minutes;
        }

        const [hoursStr, minutesStr] = trimmed.split(':');
        const hours = Number(hoursStr);
        const minutes = Number(minutesStr);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.NaN;

        return hours * 60 + minutes;
    };

    const formatMinutes = (minutes: number) => {
        const date = new Date(2000, 0, 1, 0, 0, 0, 0);
        date.setMinutes(minutes);
        return format(date, 'hh:mm a');
    };

    const normalizeBatchIds = (batchIds: string[]) => {
        return Array.from(new Set(batchIds)).sort();
    };

    const sameBatches = (first: string[], second: string[]) => {
        const normalizedFirst = normalizeBatchIds(first);
        const normalizedSecond = normalizeBatchIds(second);
        if (normalizedFirst.length !== normalizedSecond.length) return false;
        return normalizedFirst.every((value, index) => value === normalizedSecond[index]);
    };

    const getPlannedSessions = (): PlannedSession[] => {
        return dateSessions.flatMap(ds => {
            const dateStr = format(ds.date, 'yyyy-MM-dd');
            return ds.sessions
                .filter(session => session.classId && session.classId !== 'new')
                .map(session => ({
                    sessionId: session.id,
                    classId: session.classId,
                    dateStr,
                    startMinutes: parseTimeToMinutes(session.startTime),
                    endMinutes: parseTimeToMinutes(session.endTime),
                    batchIds: session.batchIds || [],
                }));
        });
    };

    const hasOverlap = (startA: number, endA: number, startB: number, endB: number) => {
        return startA < endB && startB < endA;
    };

    const getClassConflict = (
        classId: string,
        date: Date,
        session: SessionEntry,
        sessionId?: string
    ) => {
        const startMinutes = parseTimeToMinutes(session.startTime);
        const endMinutes = parseTimeToMinutes(session.endTime);

        if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || endMinutes <= startMinutes) {
            return null;
        }

        const dateStr = format(date, 'yyyy-MM-dd');
        const plannedSessions = getPlannedSessions();

        const daySessions = [...existingSessions, ...plannedSessions]
            .filter(item => item.classId === classId && item.dateStr === dateStr)
            .filter(item => !('sessionId' in item) || item.sessionId !== sessionId)
            .filter(item => !Number.isNaN(item.startMinutes) && !Number.isNaN(item.endMinutes));

        const overlaps = daySessions.filter(item =>
            hasOverlap(startMinutes, endMinutes, item.startMinutes, item.endMinutes)
        );

        if (overlaps.length > 0) {
            const nextFreeMinutes = Math.max(...daySessions.map(item => item.endMinutes));
            return { type: 'time', nextFreeMinutes } as const;
        }

        const selectedBatchIds = session.batchIds || [];
        if (selectedBatchIds.length === 0) return null;

        const classBatches = classBatchMap[classId] || [];
        const hasDaySessions = daySessions.length > 0;

        const plannedBatchMismatch = plannedSessions.some(item =>
            item.classId === classId &&
            item.dateStr === dateStr &&
            item.sessionId !== sessionId &&
            item.batchIds.length > 0 &&
            !sameBatches(item.batchIds, selectedBatchIds)
        );

        const classBatchMismatch = classBatches.length > 0 &&
            !sameBatches(classBatches, selectedBatchIds) &&
            hasDaySessions;

        if (plannedBatchMismatch || classBatchMismatch) {
            return { type: 'batch' } as const;
        }

        return null;
    };

    const getTotalSessionCount = () => {
        return dateSessions.reduce((acc, ds) => acc + ds.sessions.length, 0);
    };

    // Check if a faculty member has a conflict at the given date/time
    const getFacultyConflict = (facultyId: string, date: Date, startTime: string, endTime: string, excludeSessionId?: string): boolean => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const startMin = parseTimeToMinutes(startTime);
        const endMin = parseTimeToMinutes(endTime);
        if (isNaN(startMin) || isNaN(endMin)) return false;

        // Check existing sessions
        const hasExistingConflict = existingFacultySessions.some(s =>
            s.facultyId === facultyId &&
            s.dateStr === dateStr &&
            hasOverlap(startMin, endMin, s.startMinutes, s.endMinutes)
        );
        if (hasExistingConflict) return true;

        // Check planned sessions in other slots
        for (const ds of dateSessions) {
            if (format(ds.date, 'yyyy-MM-dd') !== dateStr) continue;
            for (const s of ds.sessions) {
                if (s.id === excludeSessionId) continue;
                if (s.facultyId !== facultyId) continue;
                const sStart = parseTimeToMinutes(s.startTime);
                const sEnd = parseTimeToMinutes(s.endTime);
                if (!isNaN(sStart) && !isNaN(sEnd) && hasOverlap(startMin, endMin, sStart, sEnd)) {
                    return true;
                }
            }
        }
        return false;
    };

    const handleSubmit = async () => {
        if (!organizationId) {
            toast.error('Organization not found. Please refresh the page and try again.');
            return;
        }

        if (dateSessions.length === 0) {
            toast.error('Please select at least one date');
            return;
        }

        // Validate all sessions
        for (const ds of dateSessions) {
            for (const session of ds.sessions) {
                if (!session.classId && !session.newClassName) {
                    toast.error(`Please select or create a class for ${format(ds.date, 'MMM dd')}`);
                    return;
                }
                if (!session.facultyId) {
                    toast.error(`Please select a faculty for ${format(ds.date, 'MMM dd')}`);
                    return;
                }
                if (!session.startTime || !session.endTime) {
                    toast.error(`Please set start and end times for ${format(ds.date, 'MMM dd')}`);
                    return;
                }

                if (session.classId && session.classId !== 'new') {
                    const conflict = getClassConflict(session.classId, ds.date, session, session.id);
                    if (conflict?.type === 'time') {
                        toast.error(`Class is not available at that time on ${format(ds.date, 'MMM dd')}`);
                        return;
                    }
                    if (conflict?.type === 'batch') {
                        // Show warning but don't block
                        toast.warning(`Batch mismatch warning for ${format(ds.date, 'MMM dd')} — proceeding anyway`);
                    }
                }

                // Faculty conflict check
                if (session.facultyId && getFacultyConflict(session.facultyId, ds.date, session.startTime, session.endTime, session.id)) {
                    const faculty = faculties.find(f => f.id === session.facultyId);
                    toast.error(`${faculty?.full_name || 'Faculty'} already has a session at this time on ${format(ds.date, 'MMM dd')}`);
                    return;
                }
            }
        }

        setLoading(true);
        let createdCount = 0;
        const totalSessions = getTotalSessionCount();

        try {
            for (const ds of dateSessions) {
                const dateStr = format(ds.date, 'yyyy-MM-dd');

                for (const session of ds.sessions) {
                    let classId = session.classId;

                    // Create new class if needed
                    if (session.classId === 'new' && session.newClassName) {
                        const newClass = await classService.createClass(
                            organizationId,
                            {
                                name: session.newClassName,
                                subject: 'General',
                                faculty_id: session.facultyId
                            },
                            session.batchIds || [],
                            currentBranchId
                        );

                        classId = newClass.id;
                    }

                    if (classId && session.batchIds?.length) {
                        await classService.updateClass(classId, {}, session.batchIds);
                    }

                    // Create session
                    const startDateTime = new Date(`${dateStr}T${session.startTime}`);
                    const endDateTime = new Date(`${dateStr}T${session.endTime}`);

                    const sessionTitle = (session.sessionName || '').trim() ||
                        classes.find(c => c.id === classId)?.name ||
                        session.newClassName ||
                        'Class Session';

                    // Insert the session first (without meet link)
                    const { data: createdSession, error: sessionError } = await supabase
                        .from('sessions')
                        .insert({
                            organization_id: organizationId,
                            class_id: classId,
                            title: sessionTitle,
                            start_time: startDateTime.toISOString(),
                            end_time: endDateTime.toISOString(),
                            faculty_id: session.facultyId,
                            meet_link: null
                        })
                        .select()
                        .single();

                    if (sessionError) throw sessionError;

                    // Generate real Google Meet link via Calendar API
                    try {
                        const attendees = await getAttendeeEmails(classId, session.facultyId);
                        const meetResult = await createGoogleMeetLink({
                            title: sessionTitle,
                            description: `Class session: ${sessionTitle}`,
                            start_time: startDateTime.toISOString(),
                            end_time: endDateTime.toISOString(),
                            time_zone: 'Asia/Kolkata',
                            attendees,
                            session_id: createdSession.id,
                        });

                        if (meetResult?.meet_link) {
                            // The edge function already updates the session,
                            // but let's also update via client for immediate UI consistency
                            await supabase
                                .from('sessions')
                                .update({
                                    meet_link: meetResult.meet_link,
                                    google_calendar_event_id: meetResult.event_id,
                                })
                                .eq('id', createdSession.id);
                        } else {
                            // Fallback: use a placeholder link and warn
                            const fallbackLink = generateMeetLink();
                            await supabase
                                .from('sessions')
                                .update({ meet_link: fallbackLink })
                                .eq('id', createdSession.id);
                            toast.warning('Google Calendar not connected — using placeholder Meet link. Connect in Settings for real links.');
                        }
                    } catch (meetError) {
                        console.error('Google Meet link creation failed:', meetError);
                        const fallbackLink = generateMeetLink();
                        await supabase
                            .from('sessions')
                            .update({ meet_link: fallbackLink })
                            .eq('id', createdSession.id);
                        toast.warning('Could not generate Google Meet link — using placeholder.');
                    }

                    // Link module groups (hierarchical)
                    if (session.moduleGroupIds.length > 0) {
                        const sessionModuleGroups = session.moduleGroupIds.map(groupId => ({
                            session_id: createdSession.id,
                            module_group_id: groupId
                        }));

                        const { error: modulesError } = await supabase
                            .from('session_module_groups')
                            .insert(sessionModuleGroups);

                        if (modulesError) throw modulesError;
                    }

                    createdCount++;
                    toast.success(`Created session ${createdCount}/${totalSessions}`);
                }
            }

            toast.success(`Successfully created ${createdCount} sessions!`);
            navigate('/dashboard/classes');

        } catch (error: any) {
            console.error('Error creating sessions:', error);
            toast.error(error.message || 'Failed to create sessions');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">
                        Schedule Sessions
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create multiple class sessions across different dates
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Date Selection & Sessions */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Date Selection Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-primary" />
                                Select Dates
                            </CardTitle>
                            <CardDescription>
                                Choose multiple dates for your sessions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal h-12"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDates.length === 0
                                            ? "Click to select dates..."
                                            : `${selectedDates.length} date(s) selected`
                                        }
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="multiple"
                                        selected={selectedDates}
                                        onSelect={handleDateSelect}
                                        numberOfMonths={2}
                                        disabled={{ before: new Date() }}
                                        className="rounded-md border"
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* Selected dates badges */}
                            {selectedDates.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedDates
                                        .sort((a, b) => a.getTime() - b.getTime())
                                        .map(date => (
                                            <Badge
                                                key={date.toISOString()}
                                                variant="secondary"
                                                className="px-3 py-1 gap-1"
                                            >
                                                {format(date, 'EEE, MMM dd')}
                                                <X
                                                    className="w-3 h-3 cursor-pointer hover:text-destructive"
                                                    onClick={() => removeDate(date)}
                                                />
                                            </Badge>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sessions per Date */}
                    {dateSessions.length > 0 ? (
                        <ScrollArea className="h-[600px] pr-4">
                            <div className="space-y-4">
                                {dateSessions.map((ds) => (
                                    <Card key={ds.date.toISOString()} className="border-l-4 border-l-primary">
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    {format(ds.date, 'EEEE, MMMM dd, yyyy')}
                                                </CardTitle>
                                                <Badge variant="outline">
                                                    {ds.sessions.length} session(s)
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {ds.sessions.map((session, idx) => (
                                                <div
                                                    key={session.id}
                                                    className="relative border rounded-lg p-4 bg-muted/30 space-y-4"
                                                >
                                                    {ds.sessions.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                                                            onClick={() => removeSession(ds.date, session.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}

                                                    <div className="text-sm font-medium text-muted-foreground">
                                                        {(session.sessionName || '').trim() || `Session ${idx + 1}`}
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Session Name (optional)</Label>
                                                        <Input
                                                            placeholder="e.g., Algebra Review"
                                                            value={session.sessionName || ''}
                                                            onChange={(e) => updateSession(ds.date, session.id, {
                                                                sessionName: e.target.value
                                                            })}
                                                        />
                                                    </div>

                                                    {/* Class Selection */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            {(() => {
                                                                const availableClasses = classes.filter(cls => !getClassConflict(cls.id, ds.date, session, session.id));
                                                                const selectedClass = classes.find(cls => cls.id === session.classId);
                                                                const showSelectedUnavailable = selectedClass && !availableClasses.some(cls => cls.id === selectedClass.id);
                                                                const selectedConflict = session.classId && session.classId !== 'new'
                                                                    ? getClassConflict(session.classId, ds.date, session, session.id)
                                                                    : null;

                                                                return (
                                                                    <>
                                                            <Label>Class / Course</Label>
                                                            <Select
                                                                value={session.classId}
                                                                onValueChange={(val) => {
                                                                    updateSession(ds.date, session.id, {
                                                                        classId: val,
                                                                        newClassName: val === 'new' ? '' : session.newClassName
                                                                    });
                                                                }}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select class" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {availableClasses.map(cls => (
                                                                        <SelectItem key={cls.id} value={cls.id}>
                                                                            {cls.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                    {showSelectedUnavailable && selectedClass && (
                                                                        <SelectItem value={selectedClass.id} disabled>
                                                                            {selectedClass.name} (unavailable)
                                                                        </SelectItem>
                                                                    )}
                                                                    <SelectItem value="new">
                                                                        + Create New Class
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            {selectedConflict?.type === 'time' && (
                                                                <p className="text-xs text-destructive">
                                                                    Not available at this time. Next free time: {formatMinutes(selectedConflict.nextFreeMinutes)}
                                                                </p>
                                                            )}
                                                            {selectedConflict?.type === 'batch' && (
                                                                <p className="text-xs text-destructive">
                                                                    This class is already assigned to a different batch on this date.
                                                                </p>
                                                            )}
                                                            {session.classId === 'new' && (
                                                                <Input
                                                                    placeholder="New class name"
                                                                    value={session.newClassName}
                                                                    onChange={(e) => updateSession(ds.date, session.id, {
                                                                        newClassName: e.target.value
                                                                    })}
                                                                />
                                                            )}
                                                                    </>
                                                                );
                                                            })()}
                                                            <div className="space-y-2 mt-2">
                                                                <Label>Assign to Batches (optional)</Label>
                                                                <Select
                                                                    value={session.batchIds?.[0] || ''}
                                                                    onValueChange={(val) => {
                                                                        const currentBatches = session.batchIds || [];
                                                                        if (currentBatches.includes(val)) {
                                                                            updateSession(ds.date, session.id, {
                                                                                batchIds: currentBatches.filter(id => id !== val)
                                                                            });
                                                                        } else {
                                                                            updateSession(ds.date, session.id, {
                                                                                batchIds: [...currentBatches, val]
                                                                            });
                                                                        }
                                                                    }}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select batches" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {batches.map(batch => (
                                                                            <SelectItem key={batch.id} value={batch.id}>
                                                                                {batch.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(session.batchIds || []).map(batchId => {
                                                                        const batch = batches.find(b => b.id === batchId);
                                                                        return batch ? (
                                                                            <Badge key={batchId} variant="secondary" className="text-xs">
                                                                                {batch.name}
                                                                                <X
                                                                                    className="w-3 h-3 ml-1 cursor-pointer"
                                                                                    onClick={() => updateSession(ds.date, session.id, {
                                                                                        batchIds: (session.batchIds || []).filter(id => id !== batchId)
                                                                                    })}
                                                                                />
                                                                            </Badge>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>Faculty</Label>
                                                            {(() => {
                                                                // Determine which subjects are selected via moduleGroupIds
                                                                const selectedSubjectIds = new Set<string>();
                                                                for (const subject of subjects) {
                                                                    for (const group of subject.groups) {
                                                                        if (session.moduleGroupIds.includes(group.id)) {
                                                                            selectedSubjectIds.add(subject.id);
                                                                        }
                                                                    }
                                                                }
                                                                // Filter faculty by subjects if modules are selected
                                                                const filteredFaculty = selectedSubjectIds.size > 0
                                                                    ? faculties.filter(f => {
                                                                        const fSubjects = facultySubjectMap[f.id] || [];
                                                                        return fSubjects.some(sid => selectedSubjectIds.has(sid));
                                                                    })
                                                                    : faculties;
                                                                return (
                                                                    <>
                                                            <Select
                                                                value={session.facultyId}
                                                                onValueChange={(val) => updateSession(ds.date, session.id, {
                                                                    facultyId: val
                                                                })}
                                                            >
                                                                <SelectTrigger>
                                                                    <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                                                                    <SelectValue placeholder="Select faculty" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {filteredFaculty.length === 0 ? (
                                                                        <SelectItem value="none" disabled>
                                                                            No matching faculty for selected subjects
                                                                        </SelectItem>
                                                                    ) : (
                                                                        filteredFaculty.map(f => {
                                                                            const isBusy = getFacultyConflict(f.id, ds.date, session.startTime, session.endTime, session.id);
                                                                            const dateStr = format(ds.date, 'yyyy-MM-dd');
                                                                            const isUnavailable = unavailableFacultyMap[f.id]?.has(dateStr) || false;
                                                                            const disabled = isBusy || isUnavailable;
                                                                            const label = isBusy ? '(Busy)' : isUnavailable ? '(Unavailable)' : '';
                                                                            return (
                                                                                <SelectItem key={f.id} value={f.id} disabled={disabled}>
                                                                                    {f.full_name} {label}
                                                                                </SelectItem>
                                                                            );
                                                                        })
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                            {session.facultyId && getFacultyConflict(session.facultyId, ds.date, session.startTime, session.endTime, session.id) && (
                                                                <p className="text-[10px] text-destructive mt-1">
                                                                    ⚠ This faculty has a conflicting session at this time
                                                                </p>
                                                            )}
                                                            {selectedSubjectIds.size > 0 && filteredFaculty.length < faculties.length && (
                                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                                    Filtered by selected subjects ({filteredFaculty.length}/{faculties.length})
                                                                </p>
                                                            )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Time Selection */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Start Time</Label>
                                                            <TimePicker
                                                                value={session.startTime}
                                                                onChange={(val) => updateSession(ds.date, session.id, {
                                                                    startTime: val
                                                                })}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>End Time</Label>
                                                            <TimePicker
                                                                value={session.endTime}
                                                                onChange={(val) => updateSession(ds.date, session.id, {
                                                                    endTime: val
                                                                })}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Modules - Hierarchical */}
                                                    <div className="space-y-2">
                                                        <Label>Modules (Optional)</Label>
                                                        <div className="border rounded-lg max-h-[250px] overflow-y-auto">
                                                            {subjects.length === 0 ? (
                                                                <div className="p-3 text-sm text-muted-foreground text-center">
                                                                    No subjects/modules available
                                                                </div>
                                                            ) : (
                                                                <div className="divide-y">
                                                                    {subjects.map(subject => (
                                                                        <div key={subject.id}>
                                                                            <div className="px-3 py-2 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                                                                <BookOpen className="w-3 h-3" />
                                                                                {subject.name}
                                                                            </div>
                                                                            {subject.groups.length === 0 ? (
                                                                                <div className="px-6 py-2 text-xs text-muted-foreground italic">No modules in this subject</div>
                                                                            ) : (
                                                                                subject.groups.map((group, groupIndex) => {
                                                                                    const isCompleted = moduleCompletions[group.id] || false;
                                                                                    // Sequential lock: only unlock if previous module in same subject is completed
                                                                                    const prevGroup = groupIndex > 0 ? subject.groups[groupIndex - 1] : null;
                                                                                    const isLocked = prevGroup ? !moduleCompletions[prevGroup.id] && !isCompleted : false;
                                                                                    return (
                                                                                        <div
                                                                                            key={group.id}
                                                                                            className={`flex items-center space-x-3 px-6 py-2 transition-colors ${isCompleted ? 'opacity-50 bg-muted/20' : isLocked ? 'opacity-40 bg-muted/10' : 'hover:bg-muted/50'}`}
                                                                                        >
                                                                                            <Checkbox
                                                                                                id={`${session.id}-grp-${group.id}`}
                                                                                                checked={session.moduleGroupIds.includes(group.id)}
                                                                                                disabled={isCompleted || isLocked}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    const newIds = checked
                                                                                                        ? [...session.moduleGroupIds, group.id]
                                                                                                        : session.moduleGroupIds.filter(id => id !== group.id);
                                                                                                    updateSession(ds.date, session.id, { moduleGroupIds: newIds });
                                                                                                }}
                                                                                            />
                                                                                            <Label
                                                                                                htmlFor={`${session.id}-grp-${group.id}`}
                                                                                                className={`flex-1 cursor-pointer font-normal text-sm flex items-center gap-2${isCompleted ? ' line-through text-muted-foreground' : ''}${isLocked ? ' text-muted-foreground' : ''}`}
                                                                                            >
                                                                                                {group.name}
                                                                                                {isCompleted && (
                                                                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Completed</Badge>
                                                                                                )}
                                                                                                {isLocked && (
                                                                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Locked</Badge>
                                                                                                )}
                                                                                            </Label>
                                                                                        </div>
                                                                                    );
                                                                                })
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add Session Button */}
                                            <Button
                                                variant="outline"
                                                className="w-full border-dashed"
                                                onClick={() => addSessionToDate(ds.date)}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add Another Session
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <CalendarIcon className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-lg font-medium">No dates selected</p>
                                <p className="text-sm">Select dates from the calendar above to add sessions</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column - Summary */}
                <div className="space-y-6">
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 sticky top-4">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ChevronRight className="w-4 h-4" />
                                Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4" />
                                        Dates
                                    </span>
                                    <span className="font-medium">{selectedDates.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Total Sessions
                                    </span>
                                    <span className="font-medium">{getTotalSessionCount()}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Video className="w-4 h-4" />
                                        Meet Links
                                    </span>
                                    <span className="text-muted-foreground text-xs">Auto-generated</span>
                                </div>
                            </div>

                            {/* Date breakdown */}
                            {dateSessions.length > 0 && (
                                <div className="border-t pt-4 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Sessions by Date
                                    </p>
                                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                        {dateSessions.map(ds => (
                                            <div
                                                key={ds.date.toISOString()}
                                                className="flex items-center justify-between text-sm py-1"
                                            >
                                                <span>{format(ds.date, 'MMM dd')}</span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {ds.sessions.length}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button
                                className="w-full mt-4"
                                size="lg"
                                onClick={handleSubmit}
                                disabled={loading || dateSessions.length === 0}
                            >
                                {loading ? (
                                    <>Creating Sessions...</>
                                ) : (
                                    <>
                                        Create {getTotalSessionCount()} Session{getTotalSessionCount() !== 1 ? 's' : ''}
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
