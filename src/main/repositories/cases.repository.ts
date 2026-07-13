import type {
  CaseStoreDocument,
} from '../../shared/cases/cases.types';

export interface CasesRepository {
  load(): Promise<CaseStoreDocument>;

  save(
    document: CaseStoreDocument,
  ): Promise<void>;
}
