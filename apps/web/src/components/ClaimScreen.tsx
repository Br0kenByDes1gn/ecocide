import React from 'react';
import type { OraclePayload } from '@ecocide/types';
import { VAULT_CLAIM_FEE, getFaction } from '@ecocide/types';
import { Trophy } from 'lucide-react';
import { AssetVaultPayment } from './AssetVaultPayment';

interface ClaimScreenProps {
  payload: OraclePayload;
  onClaimed: () => void;
}

/**
 * Claim screen (/claim/:id): certify your household's designation by unlocking
 * your Asset Vault (email OTP) and paying the (simulated) token fee from it,
 * then proceed to the static citizen dossier.
 */
export const ClaimScreen: React.FC<ClaimScreenProps> = ({ payload, onClaimed }) => {
  const { user_profile } = payload;
  const factionName = getFaction(user_profile.caste).name;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-mono text-lg font-bold text-lime-300 tracking-widest uppercase flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          CLAIM YOUR DESIGNATION
        </h2>
        <p className="font-mono text-xs text-gray-400">
          Official certification of your{' '}
          <span className="text-lime-300 font-bold">{factionName}</span> status —{' '}
          <span className="text-gray-200">{user_profile.honorific_title}</span> — requires unlocking
          your Asset Vault.
        </p>
      </div>

      <AssetVaultPayment
        feeLabel="VERDICT CERTIFICATION FEE"
        amount={VAULT_CLAIM_FEE}
        reason="claim_fee"
        bindDossierId={payload.id}
        onPaid={onClaimed}
      />

      <p className="text-center text-[10px] font-mono text-gray-500">
        UPON PAYMENT, YOUR DESIGNATION IS PERMANENTLY ATTACHED TO YOUR PERMANENT RECORD. RIGHTS SUBJECT
        TO REVOCATION.
      </p>
    </div>
  );
};
