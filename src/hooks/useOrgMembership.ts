/**
 * Thin wrapper kept for backward-compatibility.
 * Now delegates to useOrgPermissions which has richer data.
 */
import { useOrgPermissions } from './useOrgPermissions';

export function useOrgMembership() {
  const { isOrgMember, loading } = useOrgPermissions();
  return { isOrgMember, loading };
}
