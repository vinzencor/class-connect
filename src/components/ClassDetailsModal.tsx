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
    Video,
    FileText
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
    };
}

interface ClassDetailsModalProps {
    session: ClassSession | null;
    isOpen: boolean;
    onClose: () => void;
    onSessionUpdated?: (session: ClassSession) => void;
}

export function ClassDetailsModal({ session, isOpen, onClose, onSessionUpdated }: ClassDetailsModalProps) {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [meetLink, setMeetLink] = useState('');
    const [className, setClassName] = useState('');
    const [subject, setSubject] = useState('');
    const [roomNumber, setRoomNumber] = useState('');

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

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs font-normal">
                            {session.classes.name}
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
                            <Label>Subject</Label>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Title</Label>
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
                                <p className="text-sm text-muted-foreground">{session.profiles.full_name}</p>
                            </div>
                        </div>

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
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="flex-1 sm:flex-none bg-primary text-primary-foreground"
                                    onClick={handleSave}
                                    disabled={isSaving || !canSave}
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
                                    >
                                        Edit Class
                                    </Button>
                                )}
                                {session.meet_link && (
                                    <Button
                                        className="flex-1 sm:flex-none bg-primary text-primary-foreground"
                                        onClick={() => window.open(session.meet_link, '_blank')}
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
