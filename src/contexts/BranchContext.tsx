import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { branchService, Branch } from '@/services/branchService';

interface BranchContextType {
  /** The currently selected branch ID, or null for "All Branches" */
  currentBranchId: string | null;
  /** The currently selected branch object */
  currentBranch: Branch | null;
  /** All branches for the organization */
  branches: Branch[];
  /** Whether branches are still loading */
  isLoading: boolean;
  /** Switch to a different branch (or null for All Branches) */
  switchBranch: (branchId: string | null) => Promise<void>;
  /** Reload branches list */
  refreshBranches: () => Promise<void>;
  /** A counter that increments on every branch switch — use as a useEffect dependency to re-fetch data */
  branchVersion: number;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [branchVersion, setBranchVersion] = useState(0);

  // Load branches and current branch preference when user is available
  useEffect(() => {
    if (user?.organizationId && user?.id) {
      loadBranchData();
    } else {
      setIsLoading(false);
    }
  }, [user?.organizationId, user?.id]);

  const loadBranchData = async () => {
    if (!user?.organizationId || !user?.id) return;
    setIsLoading(true);
    try {
      const [branchList, savedBranchId] = await Promise.all([
        branchService.getBranches(user.organizationId),
        branchService.getUserCurrentBranch(user.id, user.organizationId),
      ]);
      setBranches(branchList);

      // Non-admin users: ALWAYS lock to their profile's branch_id
      if (user.role !== 'admin' && user.branchId) {
        setCurrentBranchId(user.branchId);
      } else if (user.role === 'admin') {
        // Admin users: use saved preference or default to null (All Branches)
        if (savedBranchId && branchList.some(b => b.id === savedBranchId)) {
          setCurrentBranchId(savedBranchId);
        } else {
          setCurrentBranchId(null);
        }
      } else {
        // Non-admin without a branch_id on profile: try saved preference
        if (savedBranchId && branchList.some(b => b.id === savedBranchId)) {
          setCurrentBranchId(savedBranchId);
        } else if (branchList.length === 1) {
          // If only one branch exists, auto-select it
          setCurrentBranchId(branchList[0].id);
        } else {
          setCurrentBranchId(null);
        }
      }
    } catch (error) {
      console.error('Failed to load branch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchBranch = useCallback(async (branchId: string | null) => {
    if (!user?.id || !user?.organizationId) return;
    try {
      await branchService.setUserCurrentBranch(user.id, user.organizationId, branchId);
      setCurrentBranchId(branchId);
      // Increment version to trigger re-fetches in all consuming components
      setBranchVersion(v => v + 1);
    } catch (error) {
      console.error('Failed to switch branch:', error);
      throw error;
    }
  }, [user?.id, user?.organizationId]);

  const refreshBranches = useCallback(async () => {
    await loadBranchData();
  }, [user?.organizationId, user?.id]);

  const currentBranch = currentBranchId
    ? branches.find(b => b.id === currentBranchId) || null
    : null;

  return (
    <BranchContext.Provider
      value={{
        currentBranchId,
        currentBranch,
        branches,
        isLoading,
        switchBranch,
        refreshBranches,
        branchVersion,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
