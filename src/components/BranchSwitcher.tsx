import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BranchSwitcherProps {
  onBranchChange?: (branchId: string | null) => void;
}

export default function BranchSwitcher({ onBranchChange }: BranchSwitcherProps) {
  const { user } = useAuth();
  const { currentBranchId, currentBranch, branches, isLoading, switchBranch } = useBranch();

  // Only admin users can switch branches
  if (user?.role !== 'admin') {
    return null;
  }

  const handleBranchSwitch = async (branchId: string | null) => {
    try {
      await switchBranch(branchId);

      const branchName = branchId
        ? branches.find(b => b.id === branchId)?.name
        : 'All Branches';

      toast.success(`Switched to ${branchName}`);

      if (onBranchChange) {
        onBranchChange(branchId);
      }

      // Force full page reload so ALL pages re-fetch data with updated RLS context
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to switch branch: ' + error.message);
    }
  };

  if (isLoading || branches.length === 0) {
    return null;
  }

  const mainBranch = branches.find(b => b.is_main_branch);
  const isMainBranchUser = user?.role === 'admin' && mainBranch;

  // Display name: show branch name with (Main) suffix if main branch, or "All Branches" if viewing all
  const displayName = currentBranch
    ? `${currentBranch.name}${currentBranch.is_main_branch ? ' (Main)' : ''}`
    : 'All Branches';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="w-4 h-4" />
          <span className="hidden sm:inline">
            {displayName}
          </span>
          {currentBranch?.is_main_branch && (
            <Badge variant="secondary" className="ml-1 hidden md:inline-flex">Main</Badge>
          )}
          {!currentBranchId && isMainBranchUser && (
            <Badge variant="default" className="ml-1 hidden md:inline-flex">All</Badge>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* All Branches option (only for main branch admins) */}
        {isMainBranchUser && (
          <>
            <DropdownMenuItem
              onClick={() => handleBranchSwitch(null)}
              className={cn(
                'cursor-pointer',
                !currentBranchId && 'bg-accent'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span>All Branches</span>
                    <span className="text-xs text-muted-foreground">View consolidated data</span>
                  </div>
                </div>
                {!currentBranchId && <Check className="w-4 h-4" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Individual branches */}
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => handleBranchSwitch(branch.id)}
            className={cn(
              'cursor-pointer',
              currentBranchId === branch.id && 'bg-accent'
            )}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <div className="flex flex-col">
                  <span>{branch.name}{branch.is_main_branch ? ' (Main)' : ''}</span>
                  <span className="text-xs text-muted-foreground">{branch.code}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentBranchId === branch.id && <Check className="w-4 h-4" />}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

