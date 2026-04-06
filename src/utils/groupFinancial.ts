export interface GroupBillingConfig {
  defaultPrice: number | null;
  paymentType: string | null;
  packageId: string | null;
  financialEnabled: boolean;
}

export interface GroupMemberPaymentConfig {
  isPaying: boolean;
  value: number | null;
}

export type GroupBillingMap = Record<string, GroupBillingConfig>;
export type GroupMemberPaymentMap = Record<string, Record<string, GroupMemberPaymentConfig>>;

export interface GroupPackageConfig {
  id: string;
  price: number;
  sessionLimit?: number | null;
}

export const getGroupSessionValue = ({
  groupId,
  patientId,
  groupBillingMap,
  memberPaymentMap,
  packages = [],
}: {
  groupId?: string | null;
  patientId: string;
  groupBillingMap: GroupBillingMap;
  memberPaymentMap: GroupMemberPaymentMap;
  packages?: GroupPackageConfig[];
}) => {
  if (!groupId) return 0;

  const memberConfig = memberPaymentMap[groupId]?.[patientId];
  if (memberConfig && !memberConfig.isPaying) return 0;
  if (memberConfig?.value != null) return Number(memberConfig.value);

  const groupConfig = groupBillingMap[groupId];
  if (!groupConfig?.financialEnabled) return 0;

  if (groupConfig.paymentType === 'pacote' && groupConfig.packageId) {
    const pkg = packages.find((item) => item.id === groupConfig.packageId);
    if (pkg?.sessionLimit && pkg.sessionLimit > 0) {
      return Number(pkg.price ?? 0) / pkg.sessionLimit;
    }
  }

  return Number(groupConfig.defaultPrice ?? 0);
};