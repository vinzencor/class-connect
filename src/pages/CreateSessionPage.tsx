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
import { batchService } from '@/services/batchService';
import { classService } from '@/services/classService';
import { Tables } from '@/types/database';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
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

interface ClassItem {
    id: string;
    name: string;
}

interface ModuleItem {
    id: string;
    title: string;
}

interface FacultyItem {
    id: string;
    full_name: string;
}

type Batch = Tables<'batches'>;

interface SessionEntry {
    id: string;
    sessionName: string;
    classId: string;
    newClassName: string;
    batchIds: string[];
    moduleIds: string[];
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
    facultyId: '',
    startTime: '09:00',
    endTime: '10:00',
});

export default function CreateSessionPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [modules, setModules] = useState<ModuleItem[]>([]);
    const [faculties, setFaculties] = useState<FacultyItem[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [classBatchMap, setClassBatchMap] = useState<Record<string, string[]>>({});
    const [existingSessions, setExistingSessions] = useState<ExistingSession[]>([]);

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
                    .select('class_id, start_time, end_time')
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

            const { data: modulesData } = await supabase
                .from('modules')
                .select('id, title')
                .eq('organization_id', user?.organizationId);
            setModules(modulesData || []);

            const { data: facultyData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('organization_id', user?.organizationId)
                .eq('role', 'faculty');
            setFaculties(facultyData || []);

            const batchesData = await batchService.getBatches(user?.organizationId || '');
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
                        toast.error(`Class batch assignment conflicts on ${format(ds.date, 'MMM dd')}`);
                        return;
                    }
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
                            session.batchIds || []
                        );

                        classId = newClass.id;
                    }

                    if (classId && session.batchIds?.length) {
                        await classService.updateClass(classId, {}, session.batchIds);
                    }

                    // Create session
                    const startDateTime = new Date(`${dateStr}T${session.startTime}`);
                    const endDateTime = new Date(`${dateStr}T${session.endTime}`);
                    const meetLink = generateMeetLink();

                    const sessionTitle = (session.sessionName || '').trim() ||
                        classes.find(c => c.id === classId)?.name ||
                        session.newClassName ||
                        'Class Session';

                    const { data: createdSession, error: sessionError } = await supabase
                        .from('sessions')
                        .insert({
                            organization_id: organizationId,
                            class_id: classId,
                            title: sessionTitle,
                            start_time: startDateTime.toISOString(),
                            end_time: endDateTime.toISOString(),
                            faculty_id: session.facultyId,
                            meet_link: meetLink
                        })
                        .select()
                        .single();

                    if (sessionError) throw sessionError;

                    // Link modules
                    if (session.moduleIds.length > 0) {
                        const sessionModules = session.moduleIds.map(moduleId => ({
                            session_id: createdSession.id,
                            module_id: moduleId
                        }));

                        const { error: modulesError } = await supabase
                            .from('session_modules')
                            .insert(sessionModules);

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
                                                                    {faculties.map(f => (
                                                                        <SelectItem key={f.id} value={f.id}>
                                                                            {f.full_name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
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

                                                    {/* Modules */}
                                                    <div className="space-y-2">
                                                        <Label>Modules (Optional)</Label>
                                                        <div className="border rounded-lg max-h-[150px] overflow-y-auto">
                                                            {modules.length === 0 ? (
                                                                <div className="p-3 text-sm text-muted-foreground text-center">
                                                                    No modules available
                                                                </div>
                                                            ) : (
                                                                <div className="divide-y">
                                                                    {modules.map(module => (
                                                                        <div
                                                                            key={module.id}
                                                                            className="flex items-center space-x-3 p-3 hover:bg-muted/50 transition-colors"
                                                                        >
                                                                            <Checkbox
                                                                                id={`${session.id}-${module.id}`}
                                                                                checked={session.moduleIds.includes(module.id)}
                                                                                onCheckedChange={(checked) => {
                                                                                    const newModuleIds = checked
                                                                                        ? [...session.moduleIds, module.id]
                                                                                        : session.moduleIds.filter(id => id !== module.id);
                                                                                    updateSession(ds.date, session.id, {
                                                                                        moduleIds: newModuleIds
                                                                                    });
                                                                                }}
                                                                            />
                                                                            <Label
                                                                                htmlFor={`${session.id}-${module.id}`}
                                                                                className="flex-1 cursor-pointer font-normal flex items-center gap-2"
                                                                            >
                                                                                <BookOpen className="w-4 h-4 text-primary" />
                                                                                {module.title}
                                                                            </Label>
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
