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
import { Switch } from '@/components/ui/switch';
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
import { getFacultyWithAvailabilityByTime } from '@/services/facultyAvailabilityService';
import { getOrgModuleGroupFaculty } from '@/services/moduleGroupFacultyService';
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
    ChevronRight,
    Search
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { createGoogleMeetLink, getGoogleConnectionStatus } from '@/services/googleCalendarService';

interface ClassItem {
    id: string;
    name: string;
}

interface SubModule {
    id: string;
    name: string;
    sort_order: number;
}

interface ModuleGroup {
    id: string;
    name: string;
    sort_order: number;
    sub_groups: SubModule[];
}

interface SubjectWithGroups {
    id: string;
    name: string;
    groups: ModuleGroup[];
}

interface FacultyItem {
    id: string;
    full_name: string;
    short_name?: string | null;
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
    moduleSubGroupIds: string[];
    facultyId: string;
    startTime: string;
    endTime: string;
    generateMeet: boolean;
    selectedSubjectId: string;
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

const createEmptySession = (generateMeet = false): SessionEntry => ({
    id: generateId(),
    sessionName: '',
    classId: '',
    newClassName: '',
    batchIds: [],
    moduleIds: [],
    moduleGroupIds: [],
    moduleSubGroupIds: [],
    facultyId: '',
    startTime: '10:30',
    endTime: '12:30',
    generateMeet,
    selectedSubjectId: '',
});

export default function CreateSessionPage() {
    const { user, profile } = useAuth();
    const { currentBranchId, currentBranch, branches, branchVersion, isLoading: branchLoading } = useBranch();
    const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
    const scopedBranchId = isAdminUser
        ? (currentBranchId || null)
        : (currentBranchId || profile?.branch_id || user?.branchId || null);
    // When in "All Branches" view, default to main branch (branches sorted main-first)
    const effectiveBranchId = branchLoading ? null : (scopedBranchId || branches[0]?.id || null);
    const effectiveBranchName =
        currentBranch?.id === effectiveBranchId
            ? currentBranch.name
            : branches.find(branch => branch.id === effectiveBranchId)?.name || 'Main branch';
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [googleMeetConnected, setGoogleMeetConnected] = useState(false);
    const [googleMeetEmail, setGoogleMeetEmail] = useState<string | null>(null);
    const [batchSearchQuery, setBatchSearchQuery] = useState('');
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [subjects, setSubjects] = useState<SubjectWithGroups[]>([]);
    const [faculties, setFaculties] = useState<FacultyItem[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [classBatchMap, setClassBatchMap] = useState<Record<string, string[]>>({});
    const [existingSessions, setExistingSessions] = useState<ExistingSession[]>([]);
    const [existingFacultySessions, setExistingFacultySessions] = useState<{ facultyId: string; dateStr: string; startMinutes: number; endMinutes: number }[]>([]);
    const [facultySubjectMap, setFacultySubjectMap] = useState<Record<string, string[]>>({});
    const [moduleGroupFacultyMap, setModuleGroupFacultyMap] = useState<Record<string, string[]>>({});
    const [moduleCompletions, setModuleCompletions] = useState<Record<string, boolean>>({});
    const [subGroupTaken, setSubGroupTaken] = useState<Record<string, boolean>>({});

    // Faculty availability — maps session id to faculty ids that explicitly submitted availability
    const [availableFacultyBySessionId, setAvailableFacultyBySessionId] = useState<Record<string, Set<string>>>({});

    // Multi-date session state
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [dateSessions, setDateSessions] = useState<DateSessions[]>([]);
    const [calendarOpen, setCalendarOpen] = useState(false);

    // Get organization ID from user or profile
    const organizationId = user?.organizationId || profile?.organization_id;

    useEffect(() => {
        if (user?.organizationId && !branchLoading && effectiveBranchId) {
            fetchData();
        }
    }, [user?.organizationId, branchVersion, scopedBranchId, branchLoading, effectiveBranchId]);

    useEffect(() => {
        const loadGoogleStatus = async () => {
            if (!organizationId || branchLoading || !effectiveBranchId) {
                setGoogleMeetConnected(false);
                setGoogleMeetEmail(null);
                return;
            }

            try {
                const status = await getGoogleConnectionStatus(organizationId, effectiveBranchId);
                setGoogleMeetConnected(status.connected);
                setGoogleMeetEmail(status.connected_email || null);
            } catch (error) {
                console.error('Failed to load Google Meet status:', error);
                setGoogleMeetConnected(false);
                setGoogleMeetEmail(null);
            }
        };

        loadGoogleStatus();
    }, [organizationId, effectiveBranchId, branchLoading, branchVersion]);

    useEffect(() => {
        if (googleMeetConnected) return;

        setDateSessions(prev => prev.map(ds => ({
            ...ds,
            sessions: ds.sessions.map(session => ({
                ...session,
                generateMeet: false,
            })),
        })));
    }, [googleMeetConnected]);

    // Fetch faculty availability for selected dates and session times
    useEffect(() => {
        if (!organizationId || selectedDates.length === 0 || dateSessions.length === 0) {
            setAvailableFacultyBySessionId({});
            return;
        }

        const fetchAvailability = async () => {
            try {
                const nextMap: Record<string, Set<string>> = {};
                for (const ds of dateSessions) {
                    const dayOfWeek = ds.date.getDay();
                    for (const session of ds.sessions) {
                        if (!session.startTime || !session.endTime) {
                            nextMap[session.id] = new Set<string>();
                            continue;
                        }

                        const availableFacultyIds = await getFacultyWithAvailabilityByTime(
                            organizationId!,
                            dayOfWeek,
                            session.startTime,
                            session.endTime,
                            scopedBranchId,
                            format(ds.date, 'yyyy-MM-dd')
                        );
                        nextMap[session.id] = new Set(availableFacultyIds);
                    }
                }
                setAvailableFacultyBySessionId(nextMap);
            } catch (err) {
                console.error('Error fetching faculty availability:', err);
            }
        };
        fetchAvailability();
    }, [organizationId, scopedBranchId, selectedDates, dateSessions]);

    useEffect(() => {
        if (!Object.keys(availableFacultyBySessionId).length) return;

        setDateSessions(prev => {
            let changed = false;

            const next = prev.map(ds => ({
                ...ds,
                sessions: ds.sessions.map(session => {
                    if (!session.facultyId) return session;

                    const availableFacultyIds = availableFacultyBySessionId[session.id];
                    if (!availableFacultyIds || availableFacultyIds.has(session.facultyId)) {
                        return session;
                    }

                    changed = true;
                    return {
                        ...session,
                        facultyId: '',
                    };
                }),
            }));

            return changed ? next : prev;
        });
    }, [availableFacultyBySessionId]);

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

    // Fetch which sub-groups are already assigned to the selected batches
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
            setSubGroupTaken({});
            return;
        }

        const fetchTakenSubGroups = async () => {
            try {
                // Find sessions that belong to classes with the selected batches
                const { data: classBatchRows } = await supabase
                    .from('class_batches')
                    .select('class_id')
                    .in('batch_id', Array.from(allBatchIds));
                const classIds = [...new Set((classBatchRows || []).map((r: any) => r.class_id))];
                if (classIds.length === 0) {
                    setSubGroupTaken({});
                    return;
                }

                const { data: sessionRows } = await supabase
                    .from('sessions')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .in('class_id', classIds);
                const sessionIds = (sessionRows || []).map((r: any) => r.id);
                if (sessionIds.length === 0) {
                    setSubGroupTaken({});
                    return;
                }

                const { data: takenRows } = await supabase
                    .from('session_module_sub_groups')
                    .select('module_sub_group_id')
                    .in('session_id', sessionIds);
                const map: Record<string, boolean> = {};
                (takenRows || []).forEach((row: any) => {
                    map[row.module_sub_group_id] = true;
                });
                setSubGroupTaken(map);
            } catch (err) {
                console.error('Error fetching taken sub-groups:', err);
            }
        };
        fetchTakenSubGroups();
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

                if (scopedBranchId) {
                    const scopedQuery = await supabase
                        .from('sessions')
                        .select('class_id, faculty_id, start_time, end_time')
                        .eq('organization_id', organizationId)
                        .eq('branch_id', scopedBranchId)
                        .gte('start_time', minDate.toISOString())
                        .lte('start_time', maxDate.toISOString());

                    if (scopedQuery.error) throw scopedQuery.error;

                    const scopedData = scopedQuery.data || [];

                    const mapped = scopedData
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

                    const facultyMapped = scopedData
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
                    return;
                }

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
    }, [organizationId, selectedDates, scopedBranchId]);

    const fetchData = async () => {
        try {
            const { data: classesData } = await supabase
                .from('classes')
                .select('id, name')
                .eq('organization_id', user?.organizationId)
                .eq('branch_id', effectiveBranchId);
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

                // Fetch sub-groups for all groups
                const groupIds = (groupsData || []).map(g => g.id);
                let subGroupsData: any[] = [];
                if (groupIds.length > 0) {
                    const { data: sgData } = await supabase
                        .from('module_sub_groups')
                        .select('id, name, group_id, sort_order')
                        .in('group_id', groupIds)
                        .order('sort_order', { ascending: true });
                    subGroupsData = sgData || [];
                }

                const subjectsWithGroups: SubjectWithGroups[] = subjectsData.map(s => ({
                    id: s.id,
                    name: s.name,
                    groups: (groupsData || [])
                        .filter(g => g.subject_id === s.id)
                        .map(g => ({
                            id: g.id,
                            name: g.name,
                            sort_order: g.sort_order,
                            sub_groups: subGroupsData
                                .filter(sg => sg.group_id === g.id)
                                .map(sg => ({ id: sg.id, name: sg.name, sort_order: sg.sort_order })),
                        })),
                }));
                setSubjects(subjectsWithGroups);
            } else {
                setSubjects([]);
            }

            let facultyQuery = supabase
                .from('profiles')
                .select('id, full_name, short_name, email')
                .eq('organization_id', user?.organizationId)
                .eq('role', 'faculty');
            if (scopedBranchId) {
                facultyQuery = facultyQuery.or(`branch_id.eq.${scopedBranchId},branch_id.is.null`);
            }
            const { data: facultyData } = await facultyQuery;
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

            // Fetch module group → faculty mapping
            try {
                const { groupFacultyMap } = await getOrgModuleGroupFaculty(user?.organizationId || '');
                setModuleGroupFacultyMap(groupFacultyMap);
            } catch (e) {
                console.error('Error fetching module group faculty:', e);
            }

            const batchesData = await batchService.getBatches(user?.organizationId || '', scopedBranchId);
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
                            sessions: [createEmptySession(googleMeetConnected)]
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
                ? { ...ds, sessions: [...ds.sessions, createEmptySession(googleMeetConnected)] }
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
                sessions: newSessions.length > 0 ? newSessions : [createEmptySession(googleMeetConnected)]
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

    const handleMeetToggle = (date: Date, sessionId: string, checked: boolean) => {
        if (!checked) {
            updateSession(date, sessionId, { generateMeet: false });
            return;
        }

        if (!effectiveBranchId) {
            toast.error('Select a branch before enabling Google Meet.');
            return;
        }

        if (!googleMeetConnected) {
            toast.error(`Connect your Google account for ${effectiveBranchName} in Settings to enable Google Meet.`);
            return;
        }

        updateSession(date, sessionId, { generateMeet: true });
    };

    const buildGoogleCalendarDescription = (params: {
        sessionTitle: string;
        classRoomName: string;
        batchNames: string[];
        moduleName?: string;
        moduleGroupNames?: string[];
        moduleSubGroupNames?: string[];
        facultyName?: string;
        sessionDate: Date;
        startTime: string;
        endTime: string;
    }) => {
        const lines = [
            `Session: ${params.sessionTitle}`,
            `Class room: ${params.classRoomName}`,
            params.batchNames.length > 0 ? `Batches: ${params.batchNames.join(', ')}` : null,
            params.moduleName ? `Module: ${params.moduleName}` : null,
            params.moduleGroupNames && params.moduleGroupNames.length > 0 ? `Sub module: ${params.moduleGroupNames.join(', ')}` : null,
            params.moduleSubGroupNames && params.moduleSubGroupNames.length > 0 ? `Sub sub module: ${params.moduleSubGroupNames.join(', ')}` : null,
            params.facultyName ? `Faculty: ${params.facultyName}` : null,
            `Branch: ${effectiveBranchName}`,
            `Date: ${format(params.sessionDate, 'EEEE, MMMM d, yyyy')}`,
            `Time: ${params.startTime} - ${params.endTime}`,
            'Google Meet: This event includes the Meet conference details inside Google Calendar.',
        ].filter(Boolean);

        return lines.join('\n');
    };

    const buildGoogleCalendarTitle = (params: {
        batchNames: string[];
        moduleName?: string;
        moduleGroupNames?: string[];
        moduleSubGroupNames?: string[];
        fallbackTitle: string;
    }) => {
        const batchLabel = params.batchNames
            .map(name => name.trim())
            .filter(Boolean)
            .join(', ');
        const moduleParts = [
            params.moduleName?.trim() || '',
            ...(params.moduleGroupNames || []).map(name => name.trim()).filter(Boolean),
            ...(params.moduleSubGroupNames || []).map(name => name.trim()).filter(Boolean),
        ].filter(Boolean);
        const moduleLabel = moduleParts.join(' / ');

        return [batchLabel || null, moduleLabel || null, (!batchLabel && !moduleLabel) ? params.fallbackTitle : null]
            .filter(Boolean)
            .join(' | ');
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

        return null;
    };

    // Check if a module group is already selected in another session that shares batches
    const isModuleGroupUsedInOtherSession = (moduleGroupId: string, currentSessionId: string, currentBatchIds: string[]): boolean => {
        if (currentBatchIds.length === 0) return false;
        for (const ds of dateSessions) {
            for (const s of ds.sessions) {
                if (s.id === currentSessionId) continue;
                // Check if sessions share any batch
                const sharedBatch = (s.batchIds || []).some(bId => currentBatchIds.includes(bId));
                if (sharedBatch && s.moduleGroupIds.includes(moduleGroupId)) {
                    return true;
                }
            }
        }
        return false;
    };

    // Check if a sub-group is already selected in another session that shares batches
    const isSubGroupUsedInOtherSession = (subGroupId: string, currentSessionId: string, currentBatchIds: string[]): boolean => {
        if (currentBatchIds.length === 0) return false;
        for (const ds of dateSessions) {
            for (const s of ds.sessions) {
                if (s.id === currentSessionId) continue;
                const sharedBatch = (s.batchIds || []).some(bId => currentBatchIds.includes(bId));
                if (sharedBatch && s.moduleSubGroupIds.includes(subGroupId)) {
                    return true;
                }
            }
        }
        return false;
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
                }

                // Faculty conflict check
                if (session.facultyId && getFacultyConflict(session.facultyId, ds.date, session.startTime, session.endTime, session.id)) {
                    const faculty = faculties.find(f => f.id === session.facultyId);
                    toast.error(`${faculty?.short_name || faculty?.full_name || 'Faculty'} already has a session at this time on ${format(ds.date, 'MMM dd')}`);
                    return;
                }
            }
        }

        if (dateSessions.some(ds => ds.sessions.some(session => session.generateMeet)) && !googleMeetConnected) {
            toast.error(`Connect your Google account for ${effectiveBranchName} in Settings before scheduling sessions with Google Meet.`);
            return;
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
                                faculty_id: session.facultyId || undefined
                            },
                            session.batchIds || [],
                            effectiveBranchId
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
                    const selectedClass = classes.find(c => c.id === classId);
                    const classRoomName = selectedClass?.name || session.newClassName.trim() || 'Not specified';
                    const batchNames = (session.batchIds || [])
                        .map(batchId => batches.find(batch => batch.id === batchId)?.name)
                        .filter((name): name is string => Boolean(name));
                    const selectedSubjectName = subjects.find(subject => subject.id === session.selectedSubjectId)?.name?.trim() || '';
                    const selectedModuleGroups = session.moduleGroupIds
                        .map(groupId => {
                            for (const subject of subjects) {
                                const group = subject.groups.find(item => item.id === groupId);
                                if (group) return group;
                            }
                            return null;
                        })
                        .filter((group): group is ModuleGroup => Boolean(group));
                    const selectedModuleGroupNames = selectedModuleGroups
                        .map(group => group.name?.trim())
                        .filter((name): name is string => Boolean(name));
                    const selectedModuleSubGroupNames = selectedModuleGroups
                        .flatMap(group => (group.sub_groups || []).filter(subGroup => session.moduleSubGroupIds.includes(subGroup.id)))
                        .map(subGroup => subGroup.name?.trim())
                        .filter((name): name is string => Boolean(name));
                    const selectedFaculty = faculties.find(faculty => faculty.id === session.facultyId);
                    const facultyName = selectedFaculty
                        ? (selectedFaculty.short_name || selectedFaculty.full_name)
                        : undefined;
                    const googleCalendarTitle = buildGoogleCalendarTitle({
                        batchNames,
                        moduleName: selectedSubjectName || undefined,
                        moduleGroupNames: selectedModuleGroupNames,
                        moduleSubGroupNames: selectedModuleSubGroupNames,
                        fallbackTitle: sessionTitle,
                    });
                    const googleDescription = buildGoogleCalendarDescription({
                        sessionTitle,
                        classRoomName,
                        batchNames,
                        moduleName: selectedSubjectName || undefined,
                        moduleGroupNames: selectedModuleGroupNames,
                        moduleSubGroupNames: selectedModuleSubGroupNames,
                        facultyName,
                        sessionDate: ds.date,
                        startTime: session.startTime,
                        endTime: session.endTime,
                    });

                    // Insert the session first (without meet link)
                    const { data: createdSession, error: sessionError } = await supabase
                        .from('sessions')
                        .insert({
                            organization_id: organizationId,
                            branch_id: effectiveBranchId,
                            class_id: classId,
                            title: sessionTitle,
                            start_time: startDateTime.toISOString(),
                            end_time: endDateTime.toISOString(),
                            faculty_id: session.facultyId || null,
                            meet_link: null
                        })
                        .select()
                        .single();

                    if (sessionError) throw sessionError;

                    // Generate Google Meet link only if toggle is ON
                    if (session.generateMeet) {
                        try {
                            const meetResult = await createGoogleMeetLink({
                                title: googleCalendarTitle,
                                description: googleDescription,
                                start_time: startDateTime.toISOString(),
                                end_time: endDateTime.toISOString(),
                                time_zone: 'Asia/Kolkata',
                                location: classRoomName,
                                session_id: createdSession.id,
                                branch_id: effectiveBranchId,
                            });

                            if (meetResult.success) {
                                await supabase
                                    .from('sessions')
                                    .update({
                                        meet_link: meetResult.meet_link,
                                        google_calendar_event_id: meetResult.event_id,
                                    })
                                    .eq('id', createdSession.id);
                            } else {
                                toast.error(('error' in meetResult && meetResult.error) || 'Google Meet link could not be created for this session.');
                            }
                        } catch (meetError) {
                            console.error('Google Meet link creation failed:', meetError);
                            toast.error('Could not generate Google Meet link for this session.');
                        }
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

                    // Link module sub-groups
                    if (session.moduleSubGroupIds.length > 0) {
                        const sessionModuleSubGroups = session.moduleSubGroupIds.map(subGroupId => ({
                            session_id: createdSession.id,
                            module_sub_group_id: subGroupId
                        }));

                        const { error: subGroupsError } = await supabase
                            .from('session_module_sub_groups')
                            .insert(sessionModuleSubGroups);

                        if (subGroupsError) throw subGroupsError;
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
        <div className="space-y-6 w-full animate-fade-in pb-10">
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left Column - Date Selection & Sessions */}
                <div className="lg:col-span-3 space-y-6">
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

                                                    {/* Batch Assignment - First */}
                                                    <div className="space-y-2">
                                                        <Label className="text-base font-semibold">Assign to Batches</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-[40px] py-2">
                                                                    <Users className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                                                                    {(session.batchIds || []).length === 0
                                                                        ? <span className="text-muted-foreground">Select batches...</span>
                                                                        : <span>{(session.batchIds || []).length} batch(es) selected</span>
                                                                    }
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-72 p-0" align="start">
                                                                <div className="p-2 border-b">
                                                                    <div className="relative">
                                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                                        <Input
                                                                            placeholder="Search batches..."
                                                                            className="pl-8 h-8 text-sm"
                                                                            value={batchSearchQuery}
                                                                            onChange={(e) => setBatchSearchQuery(e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="max-h-[200px] overflow-y-auto p-1">
                                                                    {batches.filter(b => b.name.toLowerCase().includes(batchSearchQuery.toLowerCase())).map(batch => (
                                                                        <div
                                                                            key={batch.id}
                                                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
                                                                            onClick={() => {
                                                                                const currentBatches = session.batchIds || [];
                                                                                if (currentBatches.includes(batch.id)) {
                                                                                    updateSession(ds.date, session.id, {
                                                                                        batchIds: currentBatches.filter(id => id !== batch.id)
                                                                                    });
                                                                                } else {
                                                                                    updateSession(ds.date, session.id, {
                                                                                        batchIds: [...currentBatches, batch.id]
                                                                                    });
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Checkbox
                                                                                checked={(session.batchIds || []).includes(batch.id)}
                                                                                className="pointer-events-none"
                                                                            />
                                                                            <span>{batch.name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
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

                                                    {/* Modules - Course → Module Cascading Dropdown */}
                                                    <div className="space-y-3">
                                                        <Label className="text-base font-semibold">Modules</Label>
                                                        {/* Step 1: Select Course/Subject - filtered by batch's module_subject_id */}
                                                        {(() => {
                                                            // Get module_subject_ids from selected batches
                                                            const selectedBatchObjs = (session.batchIds || []).map(bId => batches.find(b => b.id === bId)).filter(Boolean);
                                                            const batchModuleSubjectIds = new Set(
                                                                selectedBatchObjs
                                                                    .map(b => (b as any)?.module_subject_id)
                                                                    .filter(Boolean) as string[]
                                                            );
                                                            // Filter subjects: if batches have module_subject_ids, only show those; otherwise show all
                                                            const filteredSubjects = batchModuleSubjectIds.size > 0
                                                                ? subjects.filter(s => batchModuleSubjectIds.has(s.id))
                                                                : subjects;

                                                            // Auto-select if exactly one filtered subject and none selected yet
                                                            if (filteredSubjects.length === 1 && session.selectedSubjectId !== filteredSubjects[0].id) {
                                                                setTimeout(() => {
                                                                    updateSession(ds.date, session.id, {
                                                                        selectedSubjectId: filteredSubjects[0].id,
                                                                    });
                                                                }, 0);
                                                            }

                                                            return (
                                                                <Select
                                                                    value={session.selectedSubjectId || ''}
                                                                    onValueChange={(val) => {
                                                                        const selectedSubject = subjects.find(s => s.id === val);
                                                                        const hasCompletedModulesInCourse = !!selectedSubject?.groups.some(group => moduleCompletions[group.id]);
                                                                        if (hasCompletedModulesInCourse) {
                                                                            toast.warning('This course is already assigned/completed for selected batches.');
                                                                        }
                                                                        updateSession(ds.date, session.id, {
                                                                            selectedSubjectId: val,
                                                                        });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-11">
                                                                        <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                                                                        <SelectValue placeholder="Select a course/subject..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {filteredSubjects.map(subject => (
                                                                            <SelectItem key={subject.id} value={subject.id}>
                                                                                {subject.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                        {filteredSubjects.length === 0 && (
                                                                            <SelectItem value="none" disabled>
                                                                                No modules assigned to selected batches
                                                                            </SelectItem>
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            );
                                                        })()}

                                                        {/* Step 2: Show Modules for selected course */}
                                                        {session.selectedSubjectId && (() => {
                                                            const selectedSubject = subjects.find(s => s.id === session.selectedSubjectId);
                                                            if (!selectedSubject) return null;
                                                            const hasCompletedModulesInCourse = selectedSubject.groups.some(group => moduleCompletions[group.id]);
                                                            return (
                                                                <div className="space-y-2">
                                                                    {hasCompletedModulesInCourse && (
                                                                        <Alert>
                                                                            <AlertCircle className="h-4 w-4" />
                                                                            <AlertTitle>Course already assigned</AlertTitle>
                                                                            <AlertDescription>
                                                                                This course already has completed modules for the selected batches.
                                                                            </AlertDescription>
                                                                        </Alert>
                                                                    )}
                                                                    <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                                                                        {selectedSubject.groups.length === 0 ? (
                                                                            <div className="p-4 text-sm text-muted-foreground text-center">
                                                                                No modules in this course
                                                                            </div>
                                                                        ) : (
                                                                            <div className="divide-y">
                                                                                {selectedSubject.groups.map((group) => {
                                                                                    const isCompleted = moduleCompletions[group.id] || false;
                                                                                    const isUsedInOtherSession = isModuleGroupUsedInOtherSession(group.id, session.id, session.batchIds || []);
                                                                                    return (
                                                                                        <div key={group.id}>
                                                                                            <div
                                                                                                className={`flex items-center space-x-3 px-4 py-3 transition-colors ${isCompleted || isUsedInOtherSession ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/50'}`}
                                                                                            >
                                                                                                <Checkbox
                                                                                                    id={`${session.id}-grp-${group.id}`}
                                                                                                    checked={session.moduleGroupIds.includes(group.id)}
                                                                                                    onCheckedChange={(checked) => {
                                                                                                        if (checked && isCompleted) {
                                                                                                            toast.warning('This module is already completed for selected batches.');
                                                                                                            return;
                                                                                                        }
                                                                                                        if (checked && isUsedInOtherSession) {
                                                                                                            toast.warning('This module is already assigned to these batches in another session.');
                                                                                                            return;
                                                                                                        }
                                                                                                        const newIds = checked
                                                                                                            ? [...session.moduleGroupIds, group.id]
                                                                                                            : session.moduleGroupIds.filter(id => id !== group.id);
                                                                                                        updateSession(ds.date, session.id, { moduleGroupIds: newIds });
                                                                                                    }}
                                                                                                />
                                                                                                <Label
                                                                                                    htmlFor={`${session.id}-grp-${group.id}`}
                                                                                                    className={`flex-1 cursor-pointer font-medium text-sm flex items-center gap-2${isCompleted || isUsedInOtherSession ? ' line-through text-muted-foreground' : ''}`}
                                                                                                >
                                                                                                    {group.name}
                                                                                                    {isCompleted && (
                                                                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Completed</Badge>
                                                                                                    )}
                                                                                                    {!isCompleted && isUsedInOtherSession && (
                                                                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600">Assigned in another session</Badge>
                                                                                                    )}
                                                                                                </Label>
                                                                                            </div>
                                                                                            {/* Sub-groups (submodules / chapters) */}
                                                                                            {group.sub_groups && group.sub_groups.length > 0 && session.moduleGroupIds.includes(group.id) && (
                                                                                                <div className="pl-10 space-y-0.5 py-1 bg-muted/20">
                                                                                                    {group.sub_groups.map(sg => {
                                                                                                        const isTaken = subGroupTaken[sg.id] || false;
                                                                                                        const isSgUsedInOther = isSubGroupUsedInOtherSession(sg.id, session.id, session.batchIds || []);
                                                                                                        return (
                                                                                                            <div key={sg.id} className={`flex items-center space-x-2 px-2 py-1.5 rounded transition-colors ${isTaken || isSgUsedInOther ? 'bg-amber-500/10' : 'hover:bg-muted/40'}`}>
                                                                                                                <Checkbox
                                                                                                                    id={`${session.id}-sg-${sg.id}`}
                                                                                                                    checked={session.moduleSubGroupIds.includes(sg.id)}
                                                                                                                    onCheckedChange={(checked) => {
                                                                                                                        if (checked && isTaken) {
                                                                                                                            toast.warning('This chapter is already taken for selected batches.');
                                                                                                                            return;
                                                                                                                        }
                                                                                                                        if (checked && isSgUsedInOther) {
                                                                                                                            toast.warning('This chapter is already assigned to these batches in another session.');
                                                                                                                            return;
                                                                                                                        }
                                                                                                                        const newIds = checked
                                                                                                                            ? [...session.moduleSubGroupIds, sg.id]
                                                                                                                            : session.moduleSubGroupIds.filter(id => id !== sg.id);
                                                                                                                        updateSession(ds.date, session.id, { moduleSubGroupIds: newIds });
                                                                                                                    }}
                                                                                                                />
                                                                                                                <Label
                                                                                                                    htmlFor={`${session.id}-sg-${sg.id}`}
                                                                                                                    className="flex-1 cursor-pointer font-normal text-xs flex items-center gap-2"
                                                                                                                >
                                                                                                                    {sg.name}
                                                                                                                    {isTaken && (
                                                                                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600">Already Taken</Badge>
                                                                                                                    )}
                                                                                                                    {!isTaken && isSgUsedInOther && (
                                                                                                                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600">In another session</Badge>
                                                                                                                    )}
                                                                                                                </Label>
                                                                                                            </div>
                                                                                                        );
                                                                                                    })}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {(session.moduleGroupIds.length > 0 || session.moduleSubGroupIds.length > 0) && (() => {
                                                            // Build hierarchical display: Subject → Module → Chapter
                                                            const selectedGroups = session.moduleGroupIds
                                                                .map(gId => {
                                                                    for (const s of subjects) {
                                                                        const g = s.groups.find(gr => gr.id === gId);
                                                                        if (g) return { subject: s, group: g };
                                                                    }
                                                                    return null;
                                                                })
                                                                .filter(Boolean) as { subject: SubjectWithGroups; group: ModuleGroup }[];

                                                            // Group by subject
                                                            const bySubject = new Map<string, { subject: SubjectWithGroups; groups: { group: ModuleGroup; chapters: SubModule[] }[] }>();
                                                            for (const item of selectedGroups) {
                                                                if (!bySubject.has(item.subject.id)) {
                                                                    bySubject.set(item.subject.id, { subject: item.subject, groups: [] });
                                                                }
                                                                const chapters = (item.group.sub_groups || [])
                                                                    .filter(sg => session.moduleSubGroupIds.includes(sg.id));
                                                                bySubject.get(item.subject.id)!.groups.push({ group: item.group, chapters });
                                                            }

                                                            return (
                                                                <div className="rounded-md border p-2 bg-muted/20 space-y-2">
                                                                    <p className="text-[11px] font-medium text-muted-foreground">Selected modules</p>
                                                                    <div className="space-y-1.5">
                                                                        {Array.from(bySubject.values()).map(({ subject, groups }) => (
                                                                            <div key={subject.id} className="space-y-0.5">
                                                                                <p className="text-[10px] font-semibold text-primary">{subject.name}</p>
                                                                                {groups.map(({ group, chapters }) => (
                                                                                    <div key={group.id} className="pl-2">
                                                                                        <div className="flex items-center gap-1">
                                                                                            <Badge variant="secondary" className="text-[10px]">{group.name}</Badge>
                                                                                        </div>
                                                                                        {chapters.length > 0 && (
                                                                                            <div className="pl-3 flex flex-wrap gap-1 mt-0.5">
                                                                                                {chapters.map(ch => (
                                                                                                    <Badge key={ch.id} variant="outline" className="text-[9px]">{ch.name}</Badge>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Faculty */}
                                                    

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

                                                    {/* Class / Course */}
                                                    <div className="space-y-2">
                                                        <Label className="text-base font-semibold">Select Class Room </Label>
                                                        {(() => {
                                                            const availableClasses = classes.filter(cls => {
                                                                const conflict = getClassConflict(cls.id, ds.date, session, session.id);
                                                                return conflict?.type !== 'time';
                                                            });
                                                            const selectedClass = classes.find(cls => cls.id === session.classId);
                                                            const showSelectedUnavailable = selectedClass && !availableClasses.some(cls => cls.id === selectedClass.id);
                                                            const selectedConflict = session.classId && session.classId !== 'new'
                                                                ? getClassConflict(session.classId, ds.date, session, session.id)
                                                                : null;

                                                            return (
                                                                <>
                                                                    <Select
                                                                        value={session.classId}
                                                                        onValueChange={(val) => {
                                                                            updateSession(ds.date, session.id, {
                                                                                classId: val,
                                                                                newClassName: val === 'new' ? '' : session.newClassName
                                                                            });
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="h-11">
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
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-base font-semibold">Faculty (Optional)</Label>
                                                        {(() => {
                                                            // First, check if any selected module groups have direct faculty assignments
                                                            const selectedGroupIds = session.moduleGroupIds || [];
                                                            const moduleGroupAssignedFacultyIds = new Set<string>();
                                                            let hasModuleGroupFaculty = false;
                                                            for (const gId of selectedGroupIds) {
                                                                const assignedFaculty = moduleGroupFacultyMap[gId] || [];
                                                                if (assignedFaculty.length > 0) {
                                                                    hasModuleGroupFaculty = true;
                                                                    assignedFaculty.forEach(fId => moduleGroupAssignedFacultyIds.add(fId));
                                                                }
                                                            }

                                                            let filteredFaculty: FacultyItem[];
                                                            let filterLabel = '';

                                                            if (hasModuleGroupFaculty) {
                                                                filteredFaculty = faculties.filter(f => moduleGroupAssignedFacultyIds.has(f.id));
                                                                filterLabel = 'Filtered by module faculty';
                                                            } else {
                                                                const selectedSubjectIds = new Set<string>();
                                                                for (const subject of subjects) {
                                                                    for (const group of subject.groups) {
                                                                        if (selectedGroupIds.includes(group.id)) {
                                                                            selectedSubjectIds.add(subject.id);
                                                                        }
                                                                    }
                                                                }
                                                                if (selectedSubjectIds.size > 0) {
                                                                    filteredFaculty = faculties.filter(f => {
                                                                        const fSubjects = facultySubjectMap[f.id] || [];
                                                                        return fSubjects.some(sid => selectedSubjectIds.has(sid));
                                                                    });
                                                                    filterLabel = 'Filtered by selected subjects';
                                                                } else {
                                                                    filteredFaculty = faculties;
                                                                }
                                                            }
                                                            const availableFacultyIds = availableFacultyBySessionId[session.id];
                                                            const facultyWithAvailability = availableFacultyIds
                                                                ? filteredFaculty.filter(f => availableFacultyIds.has(f.id))
                                                                : [];
                                                            const selectedFaculty = session.facultyId
                                                                ? faculties.find(f => f.id === session.facultyId)
                                                                : null;
                                                            const showUnavailableSelectedFaculty = !!selectedFaculty && !facultyWithAvailability.some(f => f.id === selectedFaculty.id);

                                                            return (
                                                                <>
                                                                    <Select
                                                                        value={session.facultyId || 'none'}
                                                                        onValueChange={(val) => updateSession(ds.date, session.id, {
                                                                            facultyId: val === 'none' ? '' : val
                                                                        })}
                                                                    >
                                                                        <SelectTrigger className="h-11">
                                                                            <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                                                                            <SelectValue placeholder="Select faculty (optional)" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">No Faculty</SelectItem>
                                                                            {facultyWithAvailability.length === 0 ? (
                                                                                <SelectItem value="no-match" disabled>
                                                                                    No faculty availability submitted for this time
                                                                                </SelectItem>
                                                                            ) : (
                                                                                facultyWithAvailability.map(f => {
                                                                                    const isBusy = getFacultyConflict(f.id, ds.date, session.startTime, session.endTime, session.id);
                                                                                    const disabled = isBusy;
                                                                                    const label = isBusy ? '(Busy)' : '';
                                                                                    return (
                                                                                        <SelectItem key={f.id} value={f.id} disabled={disabled}>
                                                                                            {f.short_name || f.full_name} {label}
                                                                                        </SelectItem>
                                                                                    );
                                                                                })
                                                                            )}
                                                                            {showUnavailableSelectedFaculty && selectedFaculty && (
                                                                                <SelectItem value={selectedFaculty.id} disabled>
                                                                                    {(selectedFaculty.short_name || selectedFaculty.full_name)} (No availability submitted)
                                                                                </SelectItem>
                                                                            )}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    {session.facultyId && getFacultyConflict(session.facultyId, ds.date, session.startTime, session.endTime, session.id) && (
                                                                        <p className="text-[10px] text-destructive mt-1">
                                                                            ⚠ This faculty has a conflicting session at this time
                                                                        </p>
                                                                    )}
                                                                    {session.facultyId && showUnavailableSelectedFaculty && (
                                                                        <p className="text-[10px] text-destructive mt-1">
                                                                            Selected faculty was removed because no availability was submitted for this time.
                                                                        </p>
                                                                    )}
                                                                    {filterLabel && facultyWithAvailability.length < faculties.length && (
                                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                                            {filterLabel} with submitted availability ({facultyWithAvailability.length}/{faculties.length})
                                                                        </p>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>



                                                    {/* Google Meet Toggle */}
                                                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                                                        <div className="space-y-0.5">
                                                            <Label className="text-sm font-medium flex items-center gap-2">
                                                                <Video className="w-4 h-4 text-blue-500" />
                                                                Google Meet Link
                                                            </Label>
                                                            <p className="text-xs text-muted-foreground">Generate an online meeting link for this session</p>
                                                            {!googleMeetConnected && (
                                                                <p className="text-[10px] text-amber-600">
                                                                    Connect your Google account in Settings for {effectiveBranchName} to enable Meet.
                                                                </p>
                                                            )}
                                                            {googleMeetConnected && googleMeetEmail && (
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    Connected as {googleMeetEmail}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Switch
                                                            checked={session.generateMeet}
                                                            onCheckedChange={(checked) => handleMeetToggle(ds.date, session.id, checked)}
                                                            disabled={branchLoading || !effectiveBranchId}
                                                        />
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
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 sticky top-4 lg:w-[260px] lg:min-w-[220px] p-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ChevronRight className="w-4 h-4" />
                                Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 p-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4" />
                                        Dates
                                    </span>
                                    <span className="font-medium">{selectedDates.length}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Total Sessions
                                    </span>
                                    <span className="font-medium">{getTotalSessionCount()}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Video className="w-4 h-4" />
                                        Meet Links
                                    </span>
                                    <span className="text-muted-foreground text-[10px]">Auto-generated</span>
                                </div>
                            </div>

                            {/* Date breakdown */}
                            {dateSessions.length > 0 && (
                                <div className="border-t pt-2 space-y-1">
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                        Sessions by Date
                                    </p>
                                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                        {dateSessions.map(ds => (
                                            <div
                                                key={ds.date.toISOString()}
                                                className="flex items-center justify-between text-xs py-0.5"
                                            >
                                                <span>{format(ds.date, 'MMM dd')}</span>
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {ds.sessions.length}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button
                                className="w-full mt-2"
                                size="sm"
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
            </div >
        </div >
    );
}
