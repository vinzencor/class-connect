import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  FileText,
  Download,
  Eye,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  FolderOpen,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as moduleService from '@/services/moduleService';
import type {
  ModuleSubject,
  ModuleGroup,
  ModuleFile,
} from '@/services/moduleService';

// Sortable File Component
function SortableFile({
  file,
  isAdmin,
  onDelete,
}: {
  file: ModuleFile;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      {isAdmin && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <FileText className="w-5 h-5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{file.title}</p>
        <p className="text-xs text-muted-foreground">
          {file.file_type?.toUpperCase()} •{' '}
          {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => window.open(file.file_url, '_blank')}
          title="View"
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            const link = document.createElement('a');
            link.href = file.file_url;
            link.download = file.title;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          title="Download"
        >
          <Download className="w-4 h-4" />
        </Button>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Sortable Module Group Component
function SortableGroup({
  group,
  isAdmin,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onUploadFile,
  onDeleteFile,
}: {
  group: ModuleGroup;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUploadFile: (files: FileList) => void;
  onDeleteFile: (fileId: string, fileUrl: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const files = group.files || [];

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg">
      <div className="flex items-center gap-3 p-4 bg-card">
        {isAdmin && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
        <FolderOpen className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <h3 className="font-semibold">{group.name}</h3>
          {group.description && (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          )}
        </div>
        <Badge variant="outline">{files.length} files</Badge>
        {isAdmin && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {isExpanded && (
        <div className="p-4 pt-0 space-y-3">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No files yet. {isAdmin && 'Upload files to get started.'}
            </p>
          ) : (
            <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {files.map((file) => (
                <SortableFile
                  key={file.id}
                  file={file}
                  isAdmin={isAdmin}
                  onDelete={() => onDeleteFile(file.id, file.file_url)}
                />
              ))}
            </SortableContext>
          )}

          {isAdmin && (
            <div className="pt-2">
              <input
                type="file"
                id={`file-upload-${group.id}`}
                className="hidden"
                onChange={(e) => e.target.files && onUploadFile(e.target.files)}
                multiple
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => document.getElementById(`file-upload-${group.id}`)?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModulesPage() {
  const { user } = useAuth();
  const { currentBranchId, branchVersion } = useBranch();
  const [subjects, setSubjects] = useState<ModuleSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Dialog states
  const [subjectDialog, setSubjectDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    subjectId?: string;
    name: string;
    description: string;
  }>({ open: false, mode: 'create', name: '', description: '' });

  const [groupDialog, setGroupDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    subjectId?: string;
    groupId?: string;
    name: string;
    description: string;
  }>({ open: false, mode: 'create', name: '', description: '' });

  // Check if user has admin permissions
  const isAdmin = user?.permissions?.includes('users') || user?.role === 'admin';

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user?.organizationId) {
      loadSubjects();
    }
  }, [user?.organizationId, branchVersion]);

  const loadSubjects = async () => {
    if (!user?.organizationId) return;
    try {
      const data = await moduleService.fetchSubjects(user.organizationId, currentBranchId);
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!user?.organizationId || !subjectDialog.name.trim()) return;
    try {
      await moduleService.createSubject(
        user.organizationId,
        subjectDialog.name.trim(),
        subjectDialog.description.trim() || null,
        user.id,
        currentBranchId
      );
      toast.success('Subject created');
      setSubjectDialog({ open: false, mode: 'create', name: '', description: '' });
      loadSubjects();
    } catch (error: any) {
      console.error('Error creating subject:', error);
      toast.error(error.message || 'Failed to create subject');
    }
  };

  const handleUpdateSubject = async () => {
    if (!subjectDialog.subjectId || !subjectDialog.name.trim()) return;
    try {
      await moduleService.updateSubject(
        subjectDialog.subjectId,
        subjectDialog.name.trim(),
        subjectDialog.description.trim() || null
      );
      toast.success('Subject updated');
      setSubjectDialog({ open: false, mode: 'create', name: '', description: '' });
      loadSubjects();
    } catch (error: any) {
      console.error('Error updating subject:', error);
      toast.error(error.message || 'Failed to update subject');
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Are you sure? This will delete all modules and files in this subject.')) return;
    try {
      await moduleService.deleteSubject(id);
      toast.success('Subject deleted');
      loadSubjects();
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      toast.error(error.message || 'Failed to delete subject');
    }
  };

  const handleCreateGroup = async () => {
    if (!user?.organizationId || !groupDialog.subjectId || !groupDialog.name.trim()) return;
    try {
      await moduleService.createGroup(
        groupDialog.subjectId,
        user.organizationId,
        groupDialog.name.trim(),
        groupDialog.description.trim() || null,
        currentBranchId
      );
      toast.success('Module created');
      setGroupDialog({ open: false, mode: 'create', name: '', description: '' });
      loadSubjects();
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast.error(error.message || 'Failed to create module');
    }
  };

  const handleUpdateGroup = async () => {
    if (!groupDialog.groupId || !groupDialog.name.trim()) return;
    try {
      await moduleService.updateGroup(
        groupDialog.groupId,
        groupDialog.name.trim(),
        groupDialog.description.trim() || null
      );
      toast.success('Module updated');
      setGroupDialog({ open: false, mode: 'create', name: '', description: '' });
      loadSubjects();
    } catch (error: any) {
      console.error('Error updating group:', error);
      toast.error(error.message || 'Failed to update module');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Are you sure? This will delete all files in this module.')) return;
    try {
      await moduleService.deleteGroup(id);
      toast.success('Module deleted');
      loadSubjects();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error(error.message || 'Failed to delete module');
    }
  };

  const handleUploadFiles = async (groupId: string, files: FileList) => {
    if (!user?.organizationId) return;
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        await moduleService.uploadFile(groupId, user.organizationId, file, user.id);
      } catch (error: any) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
    
    toast.success(`${fileArray.length} file(s) uploaded`);
    loadSubjects();
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await moduleService.deleteFile(fileId, fileUrl);
      toast.success('File deleted');
      loadSubjects();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.message || 'Failed to delete file');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find if we're dragging groups or files
    const subject = subjects.find((s) =>
      s.groups?.some((g) => g.id === active.id || g.id === over.id)
    );

    if (subject) {
      // Reordering groups within a subject
      const groups = subject.groups || [];
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedGroups = arrayMove(groups, oldIndex, newIndex);
        const orderedIds = reorderedGroups.map((g) => g.id);

        // Optimistic update
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === subject.id ? { ...s, groups: reorderedGroups } : s
          )
        );

        try {
          await moduleService.reorderGroups(subject.id, orderedIds);
        } catch (error) {
          console.error('Error reordering groups:', error);
          toast.error('Failed to reorder modules');
          loadSubjects(); // Reload on error
        }
      }
    } else {
      // Reordering files within a group
      const group = subjects
        .flatMap((s) => s.groups || [])
        .find((g) => g.files?.some((f) => f.id === active.id || f.id === over.id));

      if (group) {
        const files = group.files || [];
        const oldIndex = files.findIndex((f) => f.id === active.id);
        const newIndex = files.findIndex((f) => f.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedFiles = arrayMove(files, oldIndex, newIndex);
          const orderedIds = reorderedFiles.map((f) => f.id);

          // Optimistic update
          setSubjects((prev) =>
            prev.map((s) => ({
              ...s,
              groups: s.groups?.map((g) =>
                g.id === group.id ? { ...g, files: reorderedFiles } : g
              ),
            }))
          );

          try {
            await moduleService.reorderFiles(group.id, orderedIds);
          } catch (error) {
            console.error('Error reordering files:', error);
            toast.error('Failed to reorder files');
            loadSubjects(); // Reload on error
          }
        }
      }
    }
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredSubjects = subjects.filter((subject) =>
    searchQuery
      ? subject.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subject.groups?.some(
          (g) =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.files?.some((f) =>
              f.title.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
      : true
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Study Modules
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize and share course materials with students
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() =>
              setSubjectDialog({ open: true, mode: 'create', name: '', description: '' })
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search subjects, modules, or files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subjects List */}
      {loading ? (
        <div className="text-center py-10">Loading modules...</div>
      ) : filteredSubjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No subjects found.</p>
            {isAdmin && (
              <Button
                onClick={() =>
                  setSubjectDialog({ open: true, mode: 'create', name: '', description: '' })
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Subject
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSubjects.map((subject) => (
            <Card key={subject.id}>
              <CardContent className="p-4">
                {/* Subject Header */}
                <div className="flex items-center gap-3 mb-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleSubject(subject.id)}
                  >
                    {expandedSubjects.has(subject.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </Button>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">{subject.name}</h2>
                    {subject.description && (
                      <p className="text-sm text-muted-foreground">{subject.description}</p>
                    )}
                  </div>
                  <Badge variant="outline">
                    {subject.groups?.length || 0} module{subject.groups?.length !== 1 && 's'}
                  </Badge>
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSubjectDialog({
                            open: true,
                            mode: 'edit',
                            subjectId: subject.id,
                            name: subject.name,
                            description: subject.description || '',
                          })
                        }
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => handleDeleteSubject(subject.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setGroupDialog({
                            open: true,
                            mode: 'create',
                            subjectId: subject.id,
                            name: '',
                            description: '',
                          })
                        }
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Module
                      </Button>
                    </>
                  )}
                </div>

                {/* Module Groups */}
                {expandedSubjects.has(subject.id) && (
                  <div className="pl-11 space-y-3">
                    {subject.groups && subject.groups.length > 0 ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={subject.groups.map((g) => g.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {subject.groups.map((group) => (
                            <SortableGroup
                              key={group.id}
                              group={group}
                              isAdmin={isAdmin}
                              isExpanded={expandedGroups.has(group.id)}
                              onToggle={() => toggleGroup(group.id)}
                              onEdit={() =>
                                setGroupDialog({
                                  open: true,
                                  mode: 'edit',
                                  groupId: group.id,
                                  subjectId: group.subject_id,
                                  name: group.name,
                                  description: group.description || '',
                                })
                              }
                              onDelete={() => handleDeleteGroup(group.id)}
                              onUploadFile={(files) => handleUploadFiles(group.id, files)}
                              onDeleteFile={handleDeleteFile}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No modules yet. {isAdmin && 'Click "Add Module" to create one.'}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Subject Dialog */}
      <Dialog open={subjectDialog.open} onOpenChange={(open) => !open && setSubjectDialog({ ...subjectDialog, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subjectDialog.mode === 'create' ? 'Create Subject' : 'Edit Subject'}
            </DialogTitle>
            <DialogDescription>
              {subjectDialog.mode === 'create'
                ? 'Create a new subject to organize your modules.'
                : 'Update the subject details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="subject-name">Name *</Label>
              <Input
                id="subject-name"
                value={subjectDialog.name}
                onChange={(e) => setSubjectDialog({ ...subjectDialog, name: e.target.value })}
                placeholder="e.g., Bank General"
              />
            </div>
            <div>
              <Label htmlFor="subject-description">Description</Label>
              <Textarea
                id="subject-description"
                value={subjectDialog.description}
                onChange={(e) =>
                  setSubjectDialog({ ...subjectDialog, description: e.target.value })
                }
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubjectDialog({ ...subjectDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={
                subjectDialog.mode === 'create' ? handleCreateSubject : handleUpdateSubject
              }
              disabled={!subjectDialog.name.trim()}
            >
              {subjectDialog.mode === 'create' ? 'Create' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialog.open} onOpenChange={(open) => !open && setGroupDialog({ ...groupDialog, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {groupDialog.mode === 'create' ? 'Create Module' : 'Edit Module'}
            </DialogTitle>
            <DialogDescription>
              {groupDialog.mode === 'create'
                ? 'Create a new module within the subject.'
                : 'Update the module details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Name *</Label>
              <Input
                id="group-name"
                value={groupDialog.name}
                onChange={(e) => setGroupDialog({ ...groupDialog, name: e.target.value })}
                placeholder="e.g., Module 1"
              />
            </div>
            <div>
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={groupDialog.description}
                onChange={(e) =>
                  setGroupDialog({ ...groupDialog, description: e.target.value })
                }
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGroupDialog({ ...groupDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={groupDialog.mode === 'create' ? handleCreateGroup : handleUpdateGroup}
              disabled={!groupDialog.name.trim()}
            >
              {groupDialog.mode === 'create' ? 'Create' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
