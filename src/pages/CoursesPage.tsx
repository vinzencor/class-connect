import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Search,
    Plus,
    Edit2,
    Trash2,
    GraduationCap,
    IndianRupee,
    BookOpen,
    Loader2,
    Tag,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import * as courseService from '@/services/courseService';
import type { Course } from '@/services/courseService';

export default function CoursesPage() {
    const { user } = useAuth();
    const { currentBranchId, branchVersion } = useBranch();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formTaxType, setFormTaxType] = useState('none');
    const [formTaxAmount, setFormTaxAmount] = useState('');
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.permissions?.includes('users') || user?.role === 'admin';

    useEffect(() => {
        if (user?.organizationId) loadCourses();
    }, [user?.organizationId, branchVersion]);

    const loadCourses = async () => {
        if (!user?.organizationId) return;
        try {
            const data = await courseService.getCourses(user.organizationId, currentBranchId);
            setCourses(data);
        } catch (err) {
            console.error('Error fetching courses:', err);
            toast.error('Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    const openCreateDialog = () => {
        setDialogMode('create');
        setEditingCourse(null);
        setFormName('');
        setFormDescription('');
        setFormPrice('');
        setFormDuration('');
        setFormTaxType('none');
        setFormTaxAmount('');
        setDialogOpen(true);
    };

    const openEditDialog = (course: Course) => {
        setDialogMode('edit');
        setEditingCourse(course);
        setFormName(course.name);
        setFormDescription(course.description || '');
        setFormPrice(course.price > 0 ? String(course.price) : '');
        setFormDuration(course.duration || '');
        setFormTaxType(course.tax_type || 'none');
        setFormTaxAmount(course.tax_amount > 0 ? String(course.tax_amount) : '');
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error('Course name is required');
            return;
        }
        setSaving(true);
        try {
            const price = parseFloat(formPrice) || 0;

            if (dialogMode === 'create') {
                if (!user?.organizationId) return;
                await courseService.createCourse(
                    user.organizationId,
                    formName.trim(),
                    formDescription.trim() || null,
                    price,
                    user.id,
                    currentBranchId,
                    formDuration.trim() || null,
                    formTaxType,
                    parseFloat(formTaxAmount) || 0
                );
                toast.success('Course created! It will also appear in Modules.');
            } else if (editingCourse) {
                await courseService.updateCourse(editingCourse.id, {
                    name: formName.trim(),
                    description: formDescription.trim() || null,
                    price,
                    duration: formDuration.trim() || null,
                    tax_type: formTaxType,
                    tax_amount: parseFloat(formTaxAmount) || 0,
                });
                toast.success('Course updated');
            }

            setDialogOpen(false);
            loadCourses();
        } catch (err: any) {
            console.error('Error saving course:', err);
            toast.error(err.message || 'Failed to save course');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (course: Course) => {
        if (!confirm(`Delete "${course.name}"? This will also remove it from Modules and all associated files.`)) return;
        try {
            await courseService.deleteCourse(course.id);
            toast.success('Course deleted');
            loadCourses();
        } catch (err: any) {
            console.error('Error deleting course:', err);
            toast.error(err.message || 'Failed to delete course');
        }
    };

    const filteredCourses = courses.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        total: courses.length,
        withPrice: courses.filter((c) => c.price > 0).length,
        avgPrice:
            courses.filter((c) => c.price > 0).length > 0
                ? courses.filter((c) => c.price > 0).reduce((sum, c) => sum + c.price, 0) /
                courses.filter((c) => c.price > 0).length
                : 0,
        totalRevenuePotential: courses.reduce((sum, c) => sum + c.price, 0),
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                        Courses
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage courses, set pricing, and track enrollment
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={openCreateDialog}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Course
                    </Button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border shadow-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                                <p className="text-xs text-muted-foreground">Total Courses</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border shadow-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <Tag className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.withPrice}</p>
                                <p className="text-xs text-muted-foreground">With Price</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border shadow-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <IndianRupee className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">
                                    {stats.avgPrice > 0 ? formatCurrency(stats.avgPrice) : '—'}
                                </p>
                                <p className="text-xs text-muted-foreground">Avg Price</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border shadow-card">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">
                                    {stats.totalRevenuePotential > 0 ? formatCurrency(stats.totalRevenuePotential) : '—'}
                                </p>
                                <p className="text-xs text-muted-foreground">Total Value</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Courses Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>Course Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Tax</TableHead>
                                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={isAdmin ? 4 : 3} className="h-32 text-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading courses...
                                    </TableCell>
                                </TableRow>
                            ) : filteredCourses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isAdmin ? 4 : 3} className="h-32 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <GraduationCap className="w-10 h-10 text-muted-foreground/30" />
                                            <p>{searchQuery ? 'No courses match your search' : 'No courses yet'}</p>
                                            {isAdmin && !searchQuery && (
                                                <Button variant="outline" size="sm" onClick={openCreateDialog}>
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Create First Course
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCourses.map((course, idx) => (
                                    <TableRow
                                        key={course.id}
                                        className="animate-fade-in hover:bg-muted/50 transition-colors"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <GraduationCap className="w-5 h-5 text-primary" />
                                                </div>
                                                <span className="font-medium text-foreground">{course.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-[300px] truncate">
                                            {course.description || '—'}
                                        </TableCell>
                                        <TableCell>
                                            {course.duration ? (
                                                <Badge variant="outline">{course.duration}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {course.price > 0 ? (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    {formatCurrency(course.price)}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground">
                                                    Not set
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {course.tax_type && course.tax_type !== 'none' ? (
                                                <div className="text-sm">
                                                    <Badge variant="outline" className="text-xs">{course.tax_type.toUpperCase()}</Badge>
                                                    {course.tax_amount > 0 && (
                                                        <span className="ml-1 text-muted-foreground">₹{course.tax_amount}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">No tax</span>
                                            )}
                                        </TableCell>
                                        {isAdmin && (
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => openEditDialog(course)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(course)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === 'create' ? 'Create Course' : 'Edit Course'}
                        </DialogTitle>
                        <DialogDescription>
                            {dialogMode === 'create'
                                ? 'Add a new course. It will also appear as a subject in the Modules page.'
                                : 'Update the course details and pricing.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="course-name">Name *</Label>
                            <Input
                                id="course-name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Full Stack Web Development"
                            />
                        </div>
                        <div>
                            <Label htmlFor="course-description">Description</Label>
                            <Textarea
                                id="course-description"
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Brief description of the course"
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label htmlFor="course-price">Price (₹)</Label>
                            <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="course-price"
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={formPrice}
                                    onChange={(e) => setFormPrice(e.target.value)}
                                    placeholder="0"
                                    className="pl-10"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Set to 0 or leave empty for free courses
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="course-duration">Duration</Label>
                            <Input
                                id="course-duration"
                                value={formDuration}
                                onChange={(e) => setFormDuration(e.target.value)}
                                placeholder="e.g., 3 months, 6 months, 1 year"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="course-tax-type">Tax Type</Label>
                                <Select value={formTaxType} onValueChange={(val) => {
                                    setFormTaxType(val);
                                    const price = parseFloat(formPrice) || 0;
                                    if (val === 'gst_5') setFormTaxAmount(String(Math.round(price * 0.05)));
                                    else if (val === 'gst_12') setFormTaxAmount(String(Math.round(price * 0.12)));
                                    else if (val === 'gst_18') setFormTaxAmount(String(Math.round(price * 0.18)));
                                    else if (val === 'none') setFormTaxAmount('0');
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select tax" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Tax</SelectItem>
                                        <SelectItem value="gst_5">GST 5%</SelectItem>
                                        <SelectItem value="gst_12">GST 12%</SelectItem>
                                        <SelectItem value="gst_18">GST 18%</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="course-tax-amount">Tax Amount (₹)</Label>
                                <Input
                                    id="course-tax-amount"
                                    type="number"
                                    min="0"
                                    value={formTaxAmount}
                                    onChange={(e) => setFormTaxAmount(e.target.value)}
                                    placeholder="0"
                                    disabled={formTaxType !== 'custom' && formTaxType !== 'none'}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!formName.trim() || saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : dialogMode === 'create' ? (
                                'Create Course'
                            ) : (
                                'Update Course'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
