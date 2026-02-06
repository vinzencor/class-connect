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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Video, Calendar, Clock, BookOpen, Users } from 'lucide-react';

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

export default function CreateSessionPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [modules, setModules] = useState<ModuleItem[]>([]);
    const [faculties, setFaculties] = useState<FacultyItem[]>([]);

    // Form State
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [newClassName, setNewClassName] = useState('');
    const [isNewClass, setIsNewClass] = useState(false);

    const [sessionTitle, setSessionTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [selectedFacultyId, setSelectedFacultyId] = useState('');
    const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);

    useEffect(() => {
        if (user?.organizationId) {
            fetchData();
        }
    }, [user?.organizationId]);

    const fetchData = async () => {
        try {
            // Fetch Classes
            const { data: classesData } = await supabase
                .from('classes')
                .select('id, name')
                .eq('organization_id', user?.organizationId);
            setClasses(classesData || []);

            // Fetch Modules
            const { data: modulesData } = await supabase
                .from('modules')
                .select('id, title')
                .eq('organization_id', user?.organizationId);
            setModules(modulesData || []);

            // Fetch Faculty
            const { data: facultyData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('organization_id', user?.organizationId)
                .eq('role', 'faculty');
            setFaculties(facultyData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load form data');
        }
    };

    const generateMeetLink = () => {
        // Placeholder logic as per requirements
        return `https://meet.google.com/${Math.random().toString(36).substring(7)}-${Math.random().toString(36).substring(7)}`;
    };

    const handleSubmit = async () => {
        if (!sessionTitle || !date || !startTime || !endTime || !selectedFacultyId) {
            toast.error('Please fill in all required fields');
            return;
        }

        if (!isNewClass && !selectedClassId) {
            toast.error('Please select a class');
            return;
        }

        if (isNewClass && !newClassName) {
            toast.error('Please enter a new class name');
            return;
        }

        setLoading(true);
        try {
            let classId = selectedClassId;

            // 1. Create new class if needed
            if (isNewClass) {
                const { data: newClass, error: classError } = await supabase
                    .from('classes')
                    .insert({
                        organization_id: user?.organizationId,
                        name: newClassName,
                        subject: 'General', // Default
                        faculty_id: selectedFacultyId
                    })
                    .select()
                    .single();

                if (classError) throw classError;
                classId = newClass.id;
            }

            // 2. Create Session
            const startDateTime = new Date(`${date}T${startTime}`);
            const endDateTime = new Date(`${date}T${endTime}`);
            const meetLink = generateMeetLink();

            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .insert({
                    organization_id: user?.organizationId,
                    class_id: classId,
                    title: sessionTitle,
                    start_time: startDateTime.toISOString(),
                    end_time: endDateTime.toISOString(),
                    faculty_id: selectedFacultyId,
                    meet_link: meetLink
                })
                .select()
                .single();

            if (sessionError) throw sessionError;

            // 3. Link Modules
            if (selectedModuleIds.length > 0) {
                const sessionModules = selectedModuleIds.map(moduleId => ({
                    session_id: session.id,
                    module_id: moduleId
                }));

                const { error: modulesError } = await supabase
                    .from('session_modules')
                    .insert(sessionModules);

                if (modulesError) throw modulesError;
            }

            toast.success('Session created successfully!');
            navigate('/dashboard/classes');

        } catch (error: any) {
            console.error('Error creating session:', error);
            toast.error(error.message || 'Failed to create session');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">
                        Schedule New Session
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create a class session, assign faculty and modules
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Session Details</CardTitle>
                            <CardDescription>Basic information about the session</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Class Selection */}
                            <div className="space-y-2">
                                <Label>Class / Course</Label>
                                <Select
                                    value={isNewClass ? 'new' : selectedClassId}
                                    onValueChange={(val) => {
                                        if (val === 'new') {
                                            setIsNewClass(true);
                                            setSelectedClassId('');
                                        } else {
                                            setIsNewClass(false);
                                            setSelectedClassId(val);
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {classes.map(cls => (
                                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                                        ))}
                                        <SelectItem value="new">+ Create New Class</SelectItem>
                                    </SelectContent>
                                </Select>
                                {isNewClass && (
                                    <Input
                                        placeholder="Enter new class name"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.target.value)}
                                        className="mt-2"
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Session Title</Label>
                                <Input
                                    placeholder="e.g. Calculus Chapter 1 Introduction"
                                    value={sessionTitle}
                                    onChange={(e) => setSessionTitle(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="date"
                                            className="pl-10"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {/* Placeholder for Batch - omitted for MVP simplicity */}
                                    <Label>Faculty</Label>
                                    <Select value={selectedFacultyId} onValueChange={setSelectedFacultyId}>
                                        <SelectTrigger>
                                            <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                                            <SelectValue placeholder="Select Faculty" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {faculties.map(f => (
                                                <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="time"
                                            className="pl-10"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            type="time"
                                            className="pl-10"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Resources</CardTitle>
                            <CardDescription>Select modules to attach to this session</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                                    {modules.length === 0 ? (
                                        <div className="p-4 text-center text-muted-foreground text-sm">No modules available. Upload modules first.</div>
                                    ) : modules.map(module => (
                                        <div key={module.id} className="flex items-center space-x-3 p-4 hover:bg-muted/50 transition-colors">
                                            <Checkbox
                                                id={module.id}
                                                checked={selectedModuleIds.includes(module.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedModuleIds([...selectedModuleIds, module.id]);
                                                    } else {
                                                        setSelectedModuleIds(selectedModuleIds.filter(id => id !== module.id));
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={module.id} className="flex-1 cursor-pointer font-normal flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-primary" />
                                                {module.title}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Selected: {selectedModuleIds.length} modules
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-base">Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span>{date || 'No date selected'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-primary" />
                                <span>{startTime && endTime ? `${startTime} - ${endTime}` : 'No time selected'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-primary" />
                                <span>{faculties.find(f => f.id === selectedFacultyId)?.full_name || 'No faculty selected'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <Video className="w-4 h-4 text-primary" />
                                <span className="text-muted-foreground">Link will be generated</span>
                            </div>

                            <Button className="w-full mt-4" onClick={handleSubmit} disabled={loading}>
                                {loading ? 'Creating...' : 'Create Session'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
