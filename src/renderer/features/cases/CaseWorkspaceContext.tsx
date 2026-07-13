import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type {
  CaseActivity,
  CaseActivityCreateInput,
  CaseCreateInput,
  CasePrimaryTargetInput,
  CaseStatus,
  CaseSummary,
  CaseTargetCreateInput,
  CaseTargetRemoveInput,
  CaseUpdateInput,
  InvestigationCase,
} from '../../../shared/cases/cases.types';

type CaseWorkspaceContextValue = {
  summaries: CaseSummary[];
  activeCase: InvestigationCase | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;

  refresh(): Promise<void>;

  createCase(
    input: CaseCreateInput,
  ): Promise<InvestigationCase>;

  selectCase(
    caseId: string | null,
  ): Promise<InvestigationCase | null>;

  addActivity(
    input: CaseActivityCreateInput,
  ): Promise<CaseActivity>;

  updateCase(
    input: CaseUpdateInput,
  ): Promise<InvestigationCase>;

  addTarget(
    input: CaseTargetCreateInput,
  ): Promise<InvestigationCase>;

  removeTarget(
    input: CaseTargetRemoveInput,
  ): Promise<InvestigationCase>;

  setPrimaryTarget(
    input: CasePrimaryTargetInput,
  ): Promise<InvestigationCase>;

  updateStatus(
    caseId: string,
    status: CaseStatus,
  ): Promise<InvestigationCase>;
};

const CaseWorkspaceContext =
  createContext<
    CaseWorkspaceContextValue | null
  >(null);

function normalizeError(
  unknownError: unknown,
): Error {
  if (
    unknownError instanceof Error
  ) {
    return unknownError;
  }

  return new Error(
    'Ocorreu um erro desconhecido no sistema de perfis.',
  );
}

export function CaseWorkspaceProvider({
  children,
}: PropsWithChildren) {
  const [
    summaries,
    setSummaries,
  ] = useState<CaseSummary[]>([]);

  const [
    activeCase,
    setActiveCase,
  ] =
    useState<
      InvestigationCase | null
    >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    mutating,
    setMutating,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const loadSnapshot =
    useCallback(
      async (): Promise<void> => {
        const [
          nextSummaries,
          nextActiveCase,
        ] =
          await Promise.all([
            window.zeroHub.cases.list(),
            window.zeroHub.cases
              .getActive(),
          ]);

        setSummaries(
          nextSummaries,
        );

        setActiveCase(
          nextActiveCase,
        );
      },
      [],
    );

  const refresh =
    useCallback(
      async (): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
          await loadSnapshot();
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );
        } finally {
          setLoading(false);
        }
      },
      [loadSnapshot],
    );

  const createCase =
    useCallback(
      async (
        input: CaseCreateInput,
      ): Promise<InvestigationCase> => {
        setMutating(true);
        setError(null);

        try {
          const created =
            await window.zeroHub
              .cases
              .create(input);

          await loadSnapshot();

          return created;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const selectCase =
    useCallback(
      async (
        caseId: string | null,
      ): Promise<
        InvestigationCase | null
      > => {
        setMutating(true);
        setError(null);

        try {
          const selected =
            await window.zeroHub
              .cases
              .setActive(caseId);

          await loadSnapshot();

          return selected;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const addActivity =
    useCallback(
      async (
        input:
          CaseActivityCreateInput,
      ): Promise<CaseActivity> => {
        setMutating(true);
        setError(null);

        try {
          const activity =
            await window.zeroHub
              .cases
              .addActivity(input);

          await loadSnapshot();

          return activity;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const updateCase =
    useCallback(
      async (
        input: CaseUpdateInput,
      ): Promise<InvestigationCase> => {
        setMutating(true);
        setError(null);

        try {
          const updated =
            await window.zeroHub
              .cases
              .update(input);

          await loadSnapshot();

          return updated;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const addTarget =
    useCallback(
      async (
        input:
          CaseTargetCreateInput,
      ): Promise<InvestigationCase> => {
        setMutating(true);
        setError(null);

        try {
          const updated =
            await window.zeroHub
              .cases
              .addTarget(input);

          await loadSnapshot();

          return updated;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const removeTarget =
    useCallback(
      async (
        input:
          CaseTargetRemoveInput,
      ): Promise<InvestigationCase> => {
        setMutating(true);
        setError(null);

        try {
          const updated =
            await window.zeroHub
              .cases
              .removeTarget(input);

          await loadSnapshot();

          return updated;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const setPrimaryTarget =
    useCallback(
      async (
        input:
          CasePrimaryTargetInput,
      ): Promise<InvestigationCase> => {
        setMutating(true);
        setError(null);

        try {
          const updated =
            await window.zeroHub
              .cases
              .setPrimaryTarget(
                input,
              );

          await loadSnapshot();

          return updated;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  const updateStatus =
    useCallback(
      async (
        caseId: string,
        status: CaseStatus,
      ): Promise<InvestigationCase> => {
        setMutating(true);
        setError(null);

        try {
          const updated =
            await window.zeroHub
              .cases
              .updateStatus(
                caseId,
                status,
              );

          await loadSnapshot();

          return updated;
        } catch (unknownError) {
          const normalized =
            normalizeError(
              unknownError,
            );

          setError(
            normalized.message,
          );

          throw normalized;
        } finally {
          setMutating(false);
        }
      },
      [loadSnapshot],
    );

  useEffect(() => {
    refresh().catch(
      (unknownError) => {
        console.error(
          'Falha ao iniciar o contexto de perfis.',
          unknownError,
        );
      },
    );
  }, [refresh]);

  const value =
    useMemo<
      CaseWorkspaceContextValue
    >(
      () => ({
        summaries,
        activeCase,
        loading,
        mutating,
        error,
        refresh,
        createCase,
        selectCase,
        addActivity,
        updateCase,
        addTarget,
        removeTarget,
        setPrimaryTarget,
        updateStatus,
      }),
      [
        activeCase,
        addActivity,
        addTarget,
        createCase,
        error,
        loading,
        mutating,
        refresh,
        removeTarget,
        selectCase,
        setPrimaryTarget,
        summaries,
        updateCase,
        updateStatus,
      ],
    );

  return (
    <CaseWorkspaceContext.Provider
      value={value}
    >
      {children}
    </CaseWorkspaceContext.Provider>
  );
}

export function useCaseWorkspace():
  CaseWorkspaceContextValue {
  const context =
    useContext(
      CaseWorkspaceContext,
    );

  if (!context) {
    throw new Error(
      'useCaseWorkspace precisa estar dentro de CaseWorkspaceProvider.',
    );
  }

  return context;
}
