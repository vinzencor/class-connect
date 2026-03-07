import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Users,
    Video,
    FileText,
    BookOpen,
    ClipboardCheck,
    Download,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { classService } from "@/services/classService";
import { Tables } from "@/types/database";

interface ClassSession {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    meet_link: string;
    description?: string;
    classes: {
        id: string;
        name: string; // Batch/Class Name
        subject: string; // Module Name / Subject
        room_number?: string;
    };
    profiles: {
        full_name: string;
        short_name?: string | null;
    };
}

interface ModuleGroup {
    id: string;
    name: string;
    sort_order: number;
    subject_id: string;
}

interface SubjectWithGroups {
    id: string;
    name: string;
    groups: ModuleGroup[];
}

interface ModuleSubGroup {
    id: string;
    group_id: string;
    name: string;
    sort_order: number;
}

type Batch = Tables<'batches'>;

interface ClassDetailsModalProps {
    session: ClassSession | null;
    isOpen: boolean;
    onClose: () => void;
    onSessionUpdated?: (session: ClassSession) => void;
    onSessionDeleted?: (sessionId: string) => void;
}

export function ClassDetailsModal({ session, isOpen, onClose, onSessionUpdated, onSessionDeleted }: ClassDetailsModalProps) {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [meetLink, setMeetLink] = useState('');
    const [className, setClassName] = useState('');
    const [subject, setSubject] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [classBatches, setClassBatches] = useState<Batch[]>([]);
    const [moduleGroups, setModuleGroups] = useState<any[]>([]);
    const [moduleCompletions, setModuleCompletions] = useState<Record<string, boolean>>({});
    const [moduleFiles, setModuleFiles] = useState<Record<string, any[]>>({});
    const [moduleSubGroups, setModuleSubGroups] = useState<Record<string, any[]>>({});
    const [subGroupFiles, setSubGroupFiles] = useState<Record<string, any[]>>({});
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});
    const [subjects, setSubjects] = useState<SubjectWithGroups[]>([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [selectedModuleGroupIds, setSelectedModuleGroupIds] = useState<string[]>([]);
    const [selectedModuleSubGroupIds, setSelectedModuleSubGroupIds] = useState<string[]>([]);
    const [availableSubGroupsByGroup, setAvailableSubGroupsByGroup] = useState<Record<string, ModuleSubGroup[]>>({});

    const isAdmin = user?.role === 'admin';

    const toInputDate = (dateStr: string) => {
        const dateObj = new Date(dateStr);
        return new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
            .toISOString()
            .split('T')[0];
    };

    const toInputTime = (dateStr: string) => {
        const dateObj = new Date(dateStr);
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    useEffect(() => {
        if (!session) return;
        setTitle(session.title || '');
        setDate(toInputDate(session.start_time));
        setStartTime(toInputTime(session.start_time));
        setEndTime(toInputTime(session.end_time));
        setMeetLink(session.meet_link || '');
        setClassName(session.classes?.name || '');
        setSubject(session.classes?.subject || '');
        setRoomNumber(session.classes?.room_number || '');
        setSelectedSubjectId('');
        setSelectedModuleGroupIds([]);
        setSelectedModuleSubGroupIds([]);
        setAvailableSubGroupsByGroup({});
        setIsEditing(false);
    }, [session]);

    useEffect(() => {
        const fetchSubjects = async () => {
            const organizationId = user?.organizationId;
            if (!organizationId) {
                setSubjects([]);
                return;
            }

            try {
                const { data: subjectsData, error: subjectsError } = await supabase
                    .from('module_subjects')
                    .select('id, name')
                    .eq('organization_id', organizationId)
                    .order('name', { ascending: true });

                if (subjectsError) throw subjectsError;

                const subjectIds = (subjectsData || []).map((subject: any) => subject.id);
                if (subjectIds.length === 0) {
                    setSubjects([]);
                    return;
                }

                const { data: groupsData, error: groupsError } = await supabase
                    .from('module_groups')
                    .select('id, name, sort_order, subject_id')
                    .in('subject_id', subjectIds)
                    .order('sort_order', { ascending: true });

                if (groupsError) throw groupsError;

                const mappedSubjects: SubjectWithGroups[] = (subjectsData || []).map((subject: any) => ({
                    id: subject.id,
                    name: subject.name,
                    groups: (groupsData || [])
                        .filter((group: any) => group.subject_id === subject.id)
                        .map((group: any) => ({
                            id: group.id,
                            name: group.name,
                            sort_order: group.sort_order,
                            subject_id: group.subject_id,
                        })),
                }));

                setSubjects(mappedSubjects);
            } catch (error) {
                console.error('Error fetching module subjects/groups:', error);
                setSubjects([]);
            }
        };

        fetchSubjects();
    }, [user?.organizationId]);

    useEffect(() => {
        const fetchClassBatches = async () => {
            if (!session?.classes?.id) {
                setClassBatches([]);
                return;
            }

            try {
                const batches = await classService.getClassBatches(session.classes.id);
                setClassBatches(batches);
            } catch (error) {
                console.error('Error fetching class batches:', error);
                toast.error('Failed to load class batches');
            }
        };

        fetchClassBatches();
    }, [session?.classes?.id]);

    useEffect(() => {
        const fetchModuleGroups = async () => {
            if (!session?.id) {
                setModuleGroups([]);
                setModuleCompletions({});
                setModuleFiles({});
                setModuleSubGroups({});
                setSubGroupFiles({});
                setExpandedGroups({});
                setExpandedSubGroups({});
                return;
            }

            try {
                // Fetch module groups linked to this session
                const { data: smgData, error: smgError } = await supabase
                    .from('session_module_groups')
                    .select(`
                        module_group_id,
                        module_groups (
                            id,
                            name,
                            sort_order,
                            subject_id,
                            module_subjects (
                                id,
                                name
                            )
                        )
                    `)
                    .eq('session_id', session.id);
                if (smgError) throw smgError;

                const groups = smgData?.map((item: any) => ({
                    id: item.module_groups?.id,
                    name: item.module_groups?.name,
                    sort_order: item.module_groups?.sort_order,
                    subjectName: item.module_groups?.module_subjects?.name || 'Unknown',
                    subjectId: item.module_groups?.subject_id,
                })).filter(Boolean) || [];
                setModuleGroups(groups);

                // Fetch sub-groups assigned to this session
                const { data: ssgData } = await supabase
                    .from('session_module_sub_groups')
                    .select(`
                        module_sub_group_id,
                        module_sub_groups (
                            id,
                            group_id,
                            name,
                            description,
                            sort_order
                        )
                    `)
                    .eq('session_id', session.id);

                const subGroupsMap: Record<string, any[]> = {};
                const allSubGroupIds: string[] = [];
                (ssgData || []).forEach((item: any) => {
                    const sg = item.module_sub_groups;
                    if (!sg) return;
                    if (!subGroupsMap[sg.group_id]) subGroupsMap[sg.group_id] = [];
                    subGroupsMap[sg.group_id].push(sg);
                    allSubGroupIds.push(sg.id);
                });
                setModuleSubGroups(subGroupsMap);

                // Fetch files for groups (direct) and sub-groups
                const groupIds = groups.map((g: any) => g.id).filter(Boolean);
                const filesMap: Record<string, any[]> = {};
                const sgFilesMap: Record<string, any[]> = {};

                if (groupIds.length > 0) {
                    const { data: filesData } = await supabase
                        .from('module_files')
                        .select('*')
                        .in('group_id', groupIds)
                        .is('sub_group_id', null)
                        .order('sort_order', { ascending: true });

                    (filesData || []).forEach((f: any) => {
                        if (!filesMap[f.group_id]) filesMap[f.group_id] = [];
                        filesMap[f.group_id].push(f);
                    });
                }
                setModuleFiles(filesMap);

                if (allSubGroupIds.length > 0) {
                    const { data: sgFilesData } = await supabase
                        .from('module_files')
                        .select('*')
                        .in('sub_group_id', allSubGroupIds)
                        .order('sort_order', { ascending: true });

                    (sgFilesData || []).forEach((f: any) => {
                        if (!sgFilesMap[f.sub_group_id]) sgFilesMap[f.sub_group_id] = [];
                        sgFilesMap[f.sub_group_id].push(f);
                    });
                }
                setSubGroupFiles(sgFilesMap);

                // Fetch batch IDs
                if (session.classes?.id) {
                    const { data: cbData } = await supabase
                        .from('class_batches')
                        .select('batch_id')
                        .eq('class_id', session.classes.id);
                    const batchIds = (cbData || []).map((r: any) => r.batch_id);

                    // Fetch completions for these batches
                    if (batchIds.length > 0) {
                        const { data: completionData } = await supabase
                            .from('module_completion')
                            .select('module_group_id')
                            .in('batch_id', batchIds);
                        const completionMap: Record<string, boolean> = {};
                        (completionData || []).forEach((r: any) => {
                            completionMap[r.module_group_id] = true;
                        });
                        setModuleCompletions(completionMap);
                    }
                }
            } catch (error) {
                console.error('Error fetching module groups:', error);
            }
        };

        fetchModuleGroups();
    }, [session?.id, session?.classes?.id]);

    useEffect(() => {
        if (!moduleGroups.length) return;
        setSelectedModuleGroupIds(moduleGroups.map((group: any) => group.id).filter(Boolean));
        const selectedSubGroups = Object.values(moduleSubGroups)
            .flat()
            .map((subGroup: any) => subGroup.id)
            .filter(Boolean);
        setSelectedModuleSubGroupIds(selectedSubGroups);

        const firstSubjectId = moduleGroups.find((group: any) => group.subjectId)?.subjectId;
        if (firstSubjectId) {
            setSelectedSubjectId(firstSubjectId);
        }
    }, [moduleGroups, moduleSubGroups]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatTime = (startStr: string, endStr: string) => {
        const start = new Date(startStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
        const end = new Date(endStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
        return `${start} - ${end}`;
    };

    const getDuration = (startStr: string, endStr: string) => {
        const start = new Date(startStr).getTime();
        const end = new Date(endStr).getTime();
        const diffMinutes = Math.round((end - start) / 60000);
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        if (hours > 0) {
            return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
        }
        return `${minutes} mins`;
    };

    const batchModuleSubjectIds = new Set(
        classBatches
            .map((batch) => (batch as any)?.module_subject_id)
            .filter(Boolean) as string[]
    );

    const filteredSubjects = batchModuleSubjectIds.size > 0
        ? subjects.filter((subject) => batchModuleSubjectIds.has(subject.id))
        : subjects;

    const selectedSubject = filteredSubjects.find((subject) => subject.id === selectedSubjectId);

    useEffect(() => {
        if (!isEditing) return;
        if (filteredSubjects.length === 1 && selectedSubjectId !== filteredSubjects[0].id) {
            setSelectedSubjectId(filteredSubjects[0].id);
        }
    }, [isEditing, filteredSubjects, selectedSubjectId]);

    useEffect(() => {
        const loadAvailableSubGroups = async () => {
            if (!selectedSubjectId) {
                setAvailableSubGroupsByGroup({});
                return;
            }

            const selectedSubjectGroups = subjects.find((subject) => subject.id === selectedSubjectId)?.groups || [];
            const groupIds = selectedSubjectGroups.map((group) => group.id);
            if (groupIds.length === 0) {
                setAvailableSubGroupsByGroup({});
                return;
            }

            const { data, error } = await supabase
                .from('module_sub_groups')
                .select('id, group_id, name, sort_order')
                .in('group_id', groupIds)
                .order('sort_order', { ascending: true });

            if (error) {
                console.error('Error loading module sub-groups:', error);
                setAvailableSubGroupsByGroup({});
                return;
            }

            const map: Record<string, ModuleSubGroup[]> = {};
            (data || []).forEach((subGroup: any) => {
                if (!map[subGroup.group_id]) {
                    map[subGroup.group_id] = [];
                }
                map[subGroup.group_id].push({
                    id: subGroup.id,
                    group_id: subGroup.group_id,
                    name: subGroup.name,
                    sort_order: subGroup.sort_order,
                });
            });

            setAvailableSubGroupsByGroup(map);
        };

        loadAvailableSubGroups();
    }, [selectedSubjectId, subjects]);

    const canSave = useMemo(() => {
        return title.trim() && date && startTime && endTime && className.trim() && selectedSubjectId && selectedModuleGroupIds.length > 0;
    }, [title, date, startTime, endTime, className, selectedSubjectId, selectedModuleGroupIds]);

    if (!session) return null;

    const handleSave = async () => {
        if (!session) return;
        if (!canSave) {
            toast.error('Please fill in all required fields');
            return;
        }

        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);

        if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
            toast.error('Invalid date or time');
            return;
        }

        if (endDateTime <= startDateTime) {
            toast.error('End time must be after start time');
            return;
        }

        setIsSaving(true);
        try {
            const selectedSubjectName = filteredSubjects.find((item) => item.id === selectedSubjectId)?.name || subject || 'General';

            const { error: sessionError } = await supabase
                .from('sessions')
                .update({
                    title: title.trim(),
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    meet_link: meetLink.trim() || null,
                })
                .eq('id', session.id);

            if (sessionError) throw sessionError;

            const { error: deleteSessionModulesError } = await supabase
                .from('session_module_groups')
                .delete()
                .eq('session_id', session.id);

            if (deleteSessionModulesError) throw deleteSessionModulesError;

            const { error: deleteSessionSubGroupsError } = await supabase
                .from('session_module_sub_groups')
                .delete()
                .eq('session_id', session.id);

            if (deleteSessionSubGroupsError) throw deleteSessionSubGroupsError;

            if (selectedModuleGroupIds.length > 0) {
                const { error: insertSessionModulesError } = await supabase
                    .from('session_module_groups')
                    .insert(
                        selectedModuleGroupIds.map((moduleGroupId) => ({
                            session_id: session.id,
                            module_group_id: moduleGroupId,
                        }))
                    );

                if (insertSessionModulesError) throw insertSessionModulesError;
            }

            if (selectedModuleSubGroupIds.length > 0) {
                const { error: insertSessionSubGroupsError } = await supabase
                    .from('session_module_sub_groups')
                    .insert(
                        selectedModuleSubGroupIds.map((moduleSubGroupId) => ({
                            session_id: session.id,
                            module_sub_group_id: moduleSubGroupId,
                        }))
                    );

                if (insertSessionSubGroupsError) throw insertSessionSubGroupsError;
            }

            if (session.classes?.id) {
                const { error: classError } = await supabase
                    .from('classes')
                    .update({
                        name: className.trim(),
                        subject: selectedSubjectName,
                        room_number: roomNumber.trim() || null,
                    })
                    .eq('id', session.classes.id);

                if (classError) throw classError;
            }

            const updatedSession: ClassSession = {
                ...session,
                title: title.trim(),
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                meet_link: meetLink.trim(),
                module_main_name: selectedSubjectName,
                module_group_name: selectedSubject?.groups.find((group) => group.id === selectedModuleGroupIds[0])?.name || null,
                classes: {
                    ...session.classes,
                    name: className.trim(),
                    subject: selectedSubjectName,
                    room_number: roomNumber.trim() || undefined,
                },
            };

            onSessionUpdated?.(updatedSession);
            setIsEditing(false);
            toast.success('Class updated successfully');
        } catch (error: any) {
            console.error('Error updating class:', error);
            toast.error(error.message || 'Failed to update class');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!session) return;
        const confirmed = window.confirm('Delete this scheduled class? This cannot be undone.');
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            // Delete from session_module_groups (new hierarchical system)
            const { error: deleteModulesError } = await supabase
                .from('session_module_groups')
                .delete()
                .eq('session_id', session.id);

            if (deleteModulesError) throw deleteModulesError;

            const { error: deleteSessionError } = await supabase
                .from('sessions')
                .delete()
                .eq('id', session.id);

            if (deleteSessionError) throw deleteSessionError;

            toast.success('Scheduled class deleted');
            onSessionDeleted?.(session.id);
            onClose();
        } catch (error: any) {
            console.error('Error deleting session:', error);
            toast.error(error.message || 'Failed to delete scheduled class');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-normal">
                            {session.title}
                        </Badge>
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs">
                            {session.classes.subject}
                        </Badge>
                    </div>
                    <DialogTitle className="text-xl font-bold">{session.title}</DialogTitle>
                </DialogHeader>

                {isEditing ? (
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Class Name</Label>
                            <Input value={className} onChange={(e) => setClassName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Course</Label>
                            <Select
                                value={selectedSubjectId}
                                onValueChange={(value) => {
                                    setSelectedSubjectId(value);
                                    setSelectedModuleGroupIds([]);
                                    setSelectedModuleSubGroupIds([]);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select course" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredSubjects.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                    {filteredSubjects.length === 0 && (
                                        <SelectItem value="none" disabled>
                                            No courses mapped to selected class batches
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Modules</Label>
                            <div className="border rounded-md p-3 max-h-44 overflow-y-auto space-y-2">
                                {!selectedSubject ? (
                                    <p className="text-sm text-muted-foreground">Select a course first</p>
                                ) : selectedSubject.groups.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No modules in this course</p>
                                ) : (
                                    selectedSubject.groups.map((group) => (
                                        <div key={group.id} className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`edit-module-${group.id}`}
                                                    checked={selectedModuleGroupIds.includes(group.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedModuleGroupIds((prev) =>
                                                            checked
                                                                ? [...prev, group.id]
                                                                : prev.filter((id) => id !== group.id)
                                                        );

                                                        if (!checked) {
                                                            const subGroupIds = (availableSubGroupsByGroup[group.id] || []).map((subGroup) => subGroup.id);
                                                            setSelectedModuleSubGroupIds((prev) => prev.filter((id) => !subGroupIds.includes(id)));
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor={`edit-module-${group.id}`} className="cursor-pointer text-sm font-medium">
                                                    {group.name}
                                                </Label>
                                            </div>

                                            {selectedModuleGroupIds.includes(group.id) && (availableSubGroupsByGroup[group.id] || []).length > 0 && (
                                                <div className="ml-6 space-y-1">
                                                    {(availableSubGroupsByGroup[group.id] || []).map((subGroup) => (
                                                        <div key={subGroup.id} className="flex items-center gap-2">
                                                            <Checkbox
                                                                id={`edit-submodule-${subGroup.id}`}
                                                                checked={selectedModuleSubGroupIds.includes(subGroup.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedModuleSubGroupIds((prev) =>
                                                                        checked
                                                                            ? [...prev, subGroup.id]
                                                                            : prev.filter((id) => id !== subGroup.id)
                                                                    );
                                                                }}
                                                            />
                                                            <Label htmlFor={`edit-submodule-${subGroup.id}`} className="cursor-pointer text-xs font-normal text-muted-foreground">
                                                                {subGroup.name}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Session Name</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Room Number</Label>
                                <Input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Meet Link</Label>
                            <Input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} />
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                            <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium text-sm">Date</p>
                                <p className="text-sm text-muted-foreground">{formatDate(session.start_time)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                            <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium text-sm">Time & Duration</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatTime(session.start_time, session.end_time)} • {getDuration(session.start_time, session.end_time)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                            <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium text-sm">Instructor</p>
                                <p className="text-sm text-muted-foreground">{session.profiles.short_name || session.profiles.full_name}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                            <Users className="w-5 h-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium text-sm">Batches</p>
                                {classBatches.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {classBatches.map((batch) => (
                                            <Badge key={batch.id} variant="secondary" className="text-xs">
                                                {batch.name}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No batches assigned</p>
                                )}
                            </div>
                        </div>

                        {moduleGroups.length > 0 && (
                            <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                                <BookOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-medium text-sm">Module Groups ({moduleGroups.length})</p>
                                    <div className="space-y-2 mt-1">
                                        {moduleGroups.map((group: any) => {
                                            const isCompleted = moduleCompletions[group.id] || false;
                                            const directFiles = moduleFiles[group.id] || [];
                                            const subGroups = moduleSubGroups[group.id] || [];
                                            const totalFiles = directFiles.length + subGroups.reduce((sum: number, sg: any) => sum + (subGroupFiles[sg.id]?.length || 0), 0);
                                            const hasContent = totalFiles > 0 || subGroups.length > 0;
                                            const isExpanded = expandedGroups[group.id] || false;
                                            return (
                                                <div
                                                    key={group.id}
                                                    className={`rounded border text-xs ${isCompleted ? 'bg-muted/30 border-green-200' : ''}`}
                                                >
                                                    <div
                                                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50 rounded-t"
                                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {hasContent ? (
                                                                isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                                            ) : null}
                                                            <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                                                {group.name}
                                                            </span>
                                                            <span className="text-muted-foreground">({group.subjectName})</span>
                                                            {totalFiles > 0 && (
                                                                <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                                                                    {totalFiles} file{totalFiles !== 1 ? 's' : ''}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {isCompleted && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                                                                <ClipboardCheck className="w-2.5 h-2.5 mr-0.5" />Completed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {isExpanded && hasContent && (
                                                        <div className="px-2 pb-2 space-y-2 border-t pt-2">
                                                            {/* Direct group files */}
                                                            {directFiles.map((file: any) => (
                                                                <div key={file.id} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-medium truncate">{file.title}</p>
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                {file.file_type?.toUpperCase()}
                                                                                {file.file_size ? ` • ${(file.file_size / 1024).toFixed(1)} KB` : ''}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()}>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                            <Download className="w-3.5 h-3.5" />
                                                                        </Button>
                                                                    </a>
                                                                </div>
                                                            ))}
                                                            {/* Sub-groups with their files */}
                                                            {subGroups.map((sg: any) => {
                                                                const sgFiles = subGroupFiles[sg.id] || [];
                                                                const isSgExpanded = expandedSubGroups[sg.id] || false;
                                                                return (
                                                                    <div key={sg.id} className="rounded border bg-muted/20">
                                                                        <div
                                                                            className="flex items-center justify-between p-1.5 cursor-pointer hover:bg-muted/40 rounded"
                                                                            onClick={(e) => { e.stopPropagation(); setExpandedSubGroups(prev => ({ ...prev, [sg.id]: !prev[sg.id] })); }}
                                                                        >
                                                                            <div className="flex items-center gap-1">
                                                                                {sgFiles.length > 0 ? (
                                                                                    isSgExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                                                                ) : null}
                                                                                <BookOpen className="w-3 h-3 text-primary" />
                                                                                <span className="font-medium">{sg.name}</span>
                                                                                {sgFiles.length > 0 && (
                                                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                                                                                        {sgFiles.length} file{sgFiles.length !== 1 ? 's' : ''}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {isSgExpanded && sgFiles.length > 0 && (
                                                                            <div className="px-2 pb-1.5 space-y-1 border-t">
                                                                                {sgFiles.map((file: any) => (
                                                                                    <div key={file.id} className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50">
                                                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                                                            <div className="min-w-0">
                                                                                                <p className="text-xs font-medium truncate">{file.title}</p>
                                                                                                <p className="text-[10px] text-muted-foreground">
                                                                                                    {file.file_type?.toUpperCase()}
                                                                                                    {file.file_size ? ` • ${(file.file_size / 1024).toFixed(1)} KB` : ''}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()}>
                                                                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                                                <Download className="w-3.5 h-3.5" />
                                                                                            </Button>
                                                                                        </a>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {session.classes.room_number ? (
                            <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                                <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-medium text-sm">Location</p>
                                    <p className="text-sm text-muted-foreground">Room: {session.classes.room_number}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                                <Video className="w-5 h-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-medium text-sm">Online Session</p>
                                    <p className="text-sm text-muted-foreground">Join via link below</p>
                                </div>
                            </div>
                        )}

                        {session.description && (
                            <div className="grid grid-cols-[20px_1fr] gap-3 items-start">
                                <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="font-medium text-sm">Details</p>
                                    <p className="text-sm text-muted-foreground">{session.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="sm:justify-between sm:space-x-2">
                    <div className="hidden sm:block"></div> {/* Spacer */}
                    <div className="flex gap-2 w-full sm:w-auto">
                        {isEditing ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 sm:flex-none"
                                    disabled={isSaving || isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 sm:flex-none bg-primary text-primary-foreground"
                                    onClick={handleSave}
                                    disabled={isSaving || isDeleting || !canSave}
                                >
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                                    Close
                                </Button>
                                {isAdmin && (
                                    <Button
                                        variant="outline"
                                        className="flex-1 sm:flex-none"
                                        onClick={() => setIsEditing(true)}
                                        disabled={isDeleting}
                                    >
                                        Edit Class
                                    </Button>
                                )}
                                {isAdmin && (
                                    <Button
                                        variant="destructive"
                                        className="flex-1 sm:flex-none"
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete Class'}
                                    </Button>
                                )}
                                {session.meet_link && (
                                    <Button
                                        className="flex-1 sm:flex-none bg-primary text-primary-foreground"
                                        onClick={() => window.open(session.meet_link, '_blank')}
                                        disabled={isDeleting}
                                    >
                                        <Video className="w-4 h-4 mr-2" />
                                        Join Class
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
