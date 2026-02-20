import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { branchService, Branch, CreateBranchData } from '@/services/branchService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';

export default function BranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<CreateBranchData>({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    is_main_branch: false,
  });

  useEffect(() => {
    if (user?.organizationId) {
      loadBranches();
    }
  }, [user?.organizationId]);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await branchService.getBranches(user!.organizationId!);
      setBranches(data);
    } catch (error: any) {
      toast.error('Failed to load branches: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await branchService.updateBranch(editingBranch.id, formData);
        toast.success('Branch updated successfully');
      } else {
        await branchService.createBranch(user!.organizationId!, formData);
        toast.success('Branch created successfully');
      }
      setDialogOpen(false);
      resetForm();
      loadBranches();
    } catch (error: any) {
      toast.error('Failed to save branch: ' + error.message);
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      is_main_branch: branch.is_main_branch,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    try {
      await branchService.deleteBranch(branchId);
      toast.success('Branch deleted successfully');
      loadBranches();
    } catch (error: any) {
      toast.error('Failed to delete branch: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      is_main_branch: false,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Only administrators can manage branches.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branch Management</h1>
          <p className="text-muted-foreground mt-1">Manage your academy branches and locations</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Branches</CardTitle>
          <CardDescription>
            {branches.length} branch{branches.length !== 1 ? 'es' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading branches...</p>
          ) : branches.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No branches yet. Click "Add Branch" to create your first branch.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{branch.code}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 mt-0.5" />
                        <span>{branch.city || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {branch.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{branch.phone}</span>
                          </div>
                        )}
                        {branch.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span>{branch.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {branch.is_main_branch && (
                        <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500">Main Branch</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(branch)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(branch.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Create New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update branch information' : 'Add a new branch to your organization'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Branch Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Downtown Branch"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Branch Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., A-1, MAIN"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="Pincode"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Contact number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="branch@example.com"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_main_branch"
                  checked={formData.is_main_branch}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_main_branch: checked as boolean })}
                />
                <Label htmlFor="is_main_branch" className="cursor-pointer">
                  Set as Main Branch (can view consolidated reports from all branches)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Building2 className="w-4 h-4 mr-2" />
                {editingBranch ? 'Update Branch' : 'Create Branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

