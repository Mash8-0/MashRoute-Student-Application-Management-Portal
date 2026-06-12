import { useState, useCallback } from 'react';
import { toast } from '../components/ui/toast';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall, { onSuccess, onError, successMessage } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall();
      if (successMessage) toast.success(successMessage);
      if (onSuccess) onSuccess(response.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Something went wrong';
      setError(message);
      if (onError) {
        onError(err);
      } else {
        toast.error(message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
};
