import { useState, useEffect } from 'react';
import type { Template } from '../types';
import { ApiService } from '../services/api-service';

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [availableLayouts, setAvailableLayouts] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const apiService = new ApiService();

    async function fetchTemplates() {
      try {
        setLoading(true);
        const tpls = await apiService.getTemplates();
        if (isMounted) {
          setTemplates(tpls);
          const counts = Array.from(new Set(tpls.map(t => t.slots.length))).sort((a, b) => a - b);
          setAvailableLayouts(counts);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
          console.error('[useTemplates] Error fetching templates:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchTemplates();
    return () => { isMounted = false; };
  }, []);

  return { templates, availableLayouts, loading, error };
}
