import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  MoreHorizontal,
  Edit,
  Trash2,
  CreditCard,
  GraduationCap,
  Users,
  Shield,
  Filter,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { batchService } from '@/services/batchService';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/types/database';

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin': return Shield;
    case 'faculty': return Users;
    case 'student': return GraduationCap;
    default: return Users;
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'faculty': return 'bg-primary/10 text-primary border-primary/20';
    case 'student': return 'bg-accent/10 text-accent border-accent/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

type Profile = Tables<'profiles'>;
type Batch = Tables<'batches'>;

export default function UsersPage() {
  const { user, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isBatchesLoading, setIsBatchesLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Form states for adding user
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'student',
    batchId: '',
    password: '',
  });

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: 'student',
    batchId: '',
    isActive: true,
  });

  // Fetch users on component mount and when organization ID changes
  useEffect(() => {
    const initializePage = async () => {
      // If no organization ID, try to refresh user data first
      if (!user?.organizationId) {
        console.log('⚠️ No organization ID found, attempting to refresh user data...');
        try {
          await refreshUserData();
        } catch (error) {
          console.error('Failed to refresh user data:', error);
        }
      }

      // Now fetch users if we have organization ID
      if (user?.organizationId) {
        await Promise.all([fetchUsers(), fetchBatches()]);
      }
    };

    initializePage();
  }, [user?.organizationId]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      console.log('User organization ID:', user?.organizationId);
      
      if (!user?.organizationId) {
        console.warn('No organization ID available');
        throw new Error('No organization ID');
      }
      
      const data = await userService.getUsers(user.organizationId);
      console.log('Fetched users:', data);
      
      if (!data || data.length === 0) {
        console.log('No users returned from service');
        setUsers([]);
        return;
      }
      
      // Filter out inactive users
      const activeUsers = data.filter(u => u.is_active) || [];
      console.log('Active users:', activeUsers);
      setUsers(activeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch users',
        variant: 'destructive',
      });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      if (!user?.organizationId) {
        return;
      }

      setIsBatchesLoading(true);
      const data = await batchService.getBatches(user.organizationId);
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch batches',
        variant: 'destructive',
      });
      setBatches([]);
    } finally {
      setIsBatchesLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!formData.fullName || !formData.email || !formData.password) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }

      if (formData.role === 'student' && !formData.batchId) {
        toast({
          title: 'Error',
          description: 'Please select a batch for the student',
          variant: 'destructive',
        });
        return;
      }

      setIsCreating(true);
      if (!user?.organizationId) {
        throw new Error('No organization ID available. Please login again.');
      }

      console.log('Creating user with:', {
        organizationId: user.organizationId,
        email: formData.email,
        fullName: formData.fullName,
        role: formData.role,
      });

      await userService.createUser(
        user.organizationId,
        formData.email,
        formData.fullName,
        formData.role as 'faculty' | 'student',
        formData.password,
        formData.role === 'student' ? formData.batchId : undefined
      );

      toast({
        title: 'Success',
        description: `User ${formData.fullName} created successfully. They can now login.`,
      });

      // Reset form
      setFormData({
        fullName: '',
        email: '',
        role: 'student',
        batchId: '',
        password: '',
      });
      setIsAddDialogOpen(false);

      // Refresh user list
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      await userService.deactivateUser(userId);
      toast({
        title: 'Success',
        description: `${userName} has been deactivated`,
      });
      await fetchUsers();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate user',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    faculty: users.filter(u => u.role === 'faculty').length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  const normalizeBatchValue = (rawValue: unknown) => {
    if (rawValue === null || rawValue === undefined) return undefined;

    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      const value = String(rawValue).trim();
      return value.length > 0 ? value : undefined;
    }

    if (typeof rawValue === 'object') {
      const candidate = rawValue as any;
      const nestedValue = candidate.id ?? candidate.batch_id ?? candidate.name ?? candidate.batch;
      if (nestedValue === null || nestedValue === undefined) return undefined;
      const value = String(nestedValue).trim();
      return value.length > 0 ? value : undefined;
    }

    return undefined;
  };

  const parseMetadataObject = (metadata: Profile['metadata']) => {
    if (metadata === null || metadata === undefined) return undefined;

    if (typeof metadata === 'string') {
      const trimmed = metadata.trim();
      if (!trimmed) return undefined;
      if (!trimmed.startsWith('{')) return undefined;
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? parsed
          : undefined;
      } catch (error) {
        console.warn('Failed to parse metadata JSON string:', error);
        return undefined;
      }
    }

    if (typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }

    return undefined;
  };

  const getBatchIdFromMetadata = (metadata: Profile['metadata']) => {
    if (metadata === null || metadata === undefined) {
      return undefined;
    }

    if (typeof metadata === 'string' || typeof metadata === 'number') {
      const parsedObject = parseMetadataObject(metadata);
      if (parsedObject) {
        const rawValue = (parsedObject as any).batch_id ?? (parsedObject as any).batch ?? (parsedObject as any).batchId;
        return normalizeBatchValue(rawValue);
      }

      return normalizeBatchValue(metadata);
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const rawValue = (metadata as any).batch_id ?? (metadata as any).batch ?? (metadata as any).batchId;
    return normalizeBatchValue(rawValue);
  };

  const resolveBatchName = (metadata: Profile['metadata']) => {
    const batchValue = getBatchIdFromMetadata(metadata);
    if (!batchValue) return '-';

    const directMatch = batches.find((batch) => batch.id === batchValue);
    if (directMatch) return directMatch.name;

    const normalizedValue = batchValue.toLowerCase();
    const nameMatch = batches.find(
      (batch) => batch.name.trim().toLowerCase() === normalizedValue
    );
    return nameMatch?.name || batchValue;
  };

  const openEditDialog = (profile: Profile) => {
    setSelectedUser(profile);
    setEditFormData({
      fullName: profile.full_name || '',
      role: profile.role || 'student',
      batchId: getBatchIdFromMetadata(profile.metadata) || '',
      isActive: Boolean(profile.is_active),
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    if (!editFormData.fullName.trim()) {
      toast({
        title: 'Error',
        description: 'Full name is required',
        variant: 'destructive',
      });
      return;
    }

    if (editFormData.role === 'student' && !editFormData.batchId) {
      toast({
        title: 'Error',
        description: 'Please select a batch for the student',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUpdating(true);
      const existingMetadata = parseMetadataObject(selectedUser.metadata) || {};
      const nextMetadata = { ...existingMetadata } as Record<string, unknown>;

      if (editFormData.role === 'student') {
        nextMetadata.batch_id = editFormData.batchId;
      } else if ('batch_id' in nextMetadata) {
        delete nextMetadata.batch_id;
      }

      const updated = await userService.updateUser(selectedUser.id, {
        full_name: editFormData.fullName.trim(),
        role: editFormData.role as 'admin' | 'faculty' | 'student',
        is_active: editFormData.isActive,
        metadata: nextMetadata,
      });

      setUsers((current) =>
        current.map((userItem) => (userItem.id === selectedUser.id ? updated : userItem))
      );
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Debug Panel - Remove in production */}
      {!user?.organizationId && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
          <p className="font-semibold">⚠️ Debug Info:</p>
          <p className="text-sm mt-2">User ID: {user?.id || 'Not found'}</p>
          <p className="text-sm">Organization ID: {user?.organizationId || 'NULL - This is the issue!'}</p>
          <p className="text-sm mt-2">Solution: Make sure you login with a user that has an organization assigned in the profiles table.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage students, faculty, and administrators
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account. They can change password after first login.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Enter temporary password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((current) => ({
                      ...current,
                      role: value,
                      batchId: value === 'student' ? current.batchId : '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role === 'student' && (
                <div className="space-y-2">
                  <Label>Batch (for students)</Label>
                  <Select
                    value={formData.batchId}
                    onValueChange={(value) => setFormData({ ...formData, batchId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {isBatchesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading batches...
                        </SelectItem>
                      ) : batches.length === 0 ? (
                        <SelectItem value="no-batches" disabled>
                          No batches found
                        </SelectItem>
                      ) : (
                        batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={handleCreateUser}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setSelectedUser(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user details and batch assignment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Enter full name"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value) =>
                    setEditFormData((current) => ({
                      ...current,
                      role: value,
                      batchId: value === 'student' ? current.batchId : '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editFormData.role === 'student' && (
                <div className="space-y-2">
                  <Label>Batch</Label>
                  <Select
                    value={editFormData.batchId}
                    onValueChange={(value) => setEditFormData({ ...editFormData, batchId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {isBatchesLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading batches...
                        </SelectItem>
                      ) : batches.length === 0 ? (
                        <SelectItem value="no-batches" disabled>
                          No batches found
                        </SelectItem>
                      ) : (
                        batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editFormData.isActive ? 'active' : 'inactive'}
                  onValueChange={(value) =>
                    setEditFormData((current) => ({
                      ...current,
                      isActive: value === 'active',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={handleUpdateUser}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'bg-primary/10 text-primary' },
          { label: 'Students', value: stats.students, icon: GraduationCap, color: 'bg-accent/10 text-accent' },
          { label: 'Faculty', value: stats.faculty, icon: Users, color: 'bg-success/10 text-success' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'bg-warning/10 text-warning' },
        ].map((stat) => (
          <Card key={stat.label} className="border shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Table */}
      <Card className="border shadow-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Batch</TableHead>
                  <TableHead className="hidden lg:table-cell">NFC ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userItem, index) => {
                    const RoleIcon = getRoleIcon(userItem.role);
                    return (
                      <TableRow
                        key={userItem.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {userItem.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">{userItem.full_name}</p>
                              <p className="text-sm text-muted-foreground">{userItem.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getRoleBadgeColor(userItem.role)}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {resolveBatchName(userItem.metadata)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{userItem.nfc_id || '-'}</code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              userItem.is_active
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-muted text-muted-foreground'
                            }
                          >
                            {userItem.is_active ? 'active' : 'inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(userItem)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Generate ID Card
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteUser(userItem.id, userItem.full_name || 'User')}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
