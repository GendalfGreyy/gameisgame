import type { BoostPlan, BoostResponse } from '@game-is-game/shared';
import { useMutation } from '@tanstack/react-query';
import WebApp from '@twa-dev/sdk';

import { apiRequest } from '../../shared/api/client.js';
import { useAuthStore } from '../auth/store.js';

const boostsEnabled = import.meta.env.VITE_BOOSTS_ENABLED === 'true';

export function boostsFeatureEnabled(): boolean {
  return boostsEnabled;
}

export function useCreateBoost(eventId: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useMutation({
    mutationFn: (plan: BoostPlan) =>
      apiRequest<BoostResponse>(`/events/${eventId}/boost`, {
        method: 'POST',
        body: { plan },
        token,
      }),
    onSuccess: (data) => {
      WebApp.openInvoice(data.invoiceLink, (status) => {
        if (status === 'paid') {
          WebApp.showAlert('Boost активирован!');
        }
      });
    },
  });
}
