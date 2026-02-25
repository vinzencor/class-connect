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
    Calendar,
    Clock,
    MapPin,
    User,
    Users,
    Video,
    FileText,
    BookOpen,
    ClipboardCheck
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
        setIsEditing(false);
    }, [session]);

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

    const canSave = useMemo(() => {
        return title.trim() && date && startTime && endTime && className.trim() && subject.trim();
    }, [title, date, startTime, endTime, className, subject]);

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

            if (session.classes?.id) {
                const { error: classError } = await supabase
                    .from('classes')
                    .update({
                        name: className.trim(),
                        subject: subject.trim(),
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
                classes: {
                    ...session.classes,
                    name: className.trim(),
                    subject: subject.trim(),
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
            <DialogContent className="sm:max-w-[500px]">
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
                            <Label>Subject</Label>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
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
                                    <div className="space-y-1 mt-1">
                                        {moduleGroups.map((group: any) => {
                                            const isCompleted = moduleCompletions[group.id] || false;
                                            return (
                                                <div
                                                    key={group.id}
                                                    className={`flex items-center justify-between p-2 rounded border text-xs ${isCompleted ? 'bg-muted/30 border-green-200' : ''}`}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span className={isCompleted ? 'line-through text-muted-foreground' : ''}>
                                                            {group.name}
                                                        </span>
                                                        <span className="text-muted-foreground">({group.subjectName})</span>
                                                    </div>
                                                    {isCompleted && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                                                            <ClipboardCheck className="w-2.5 h-2.5 mr-0.5" />Completed
                                                        </Badge>
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
