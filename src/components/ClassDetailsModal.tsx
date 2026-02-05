import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Calendar,
    Clock,
    MapPin,
    User,
    Video,
    FileText
} from "lucide-react";

interface ClassSession {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    meet_link: string;
    description?: string;
    classes: {
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
}

export function ClassDetailsModal({ session, isOpen, onClose }: ClassDetailsModalProps) {
    if (!session) return null;

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

                <DialogFooter className="sm:justify-between sm:space-x-2">
                    <div className="hidden sm:block"></div> {/* Spacer */}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                            Close
                        </Button>
                        {session.meet_link && (
                            <Button
                                className="flex-1 sm:flex-none bg-primary text-primary-foreground"
                                onClick={() => window.open(session.meet_link, '_blank')}
                            >
                                <Video className="w-4 h-4 mr-2" />
                                Join Class
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
