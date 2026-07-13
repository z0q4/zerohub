import {
  app,
} from 'electron';

import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

import {
  dirname,
  join,
} from 'node:path';

import type {
  CaseActivity,
  CaseActivityStatus,
  CaseStatus,
  CaseStoreDocument,
  CaseTarget,
  CaseTargetKind,
  InvestigationCase,
} from '../../shared/cases/cases.types';

import type {
  CasesRepository,
} from './cases.repository';

const CASE_STATUSES:
  readonly CaseStatus[] = [
    'active',
    'paused',
    'archived',
  ];

const TARGET_KINDS:
  readonly CaseTargetKind[] = [
    'domain',
    'ip',
    'email',
    'url',
    'hash',
    'file',
    'other',
  ];

const ACTIVITY_STATUSES:
  readonly CaseActivityStatus[] = [
    'success',
    'error',
    'cancelled',
    'info',
  ];

function emptyDocument():
  CaseStoreDocument {
  return {
    format: 'zerohub-cases',
    schemaVersion: 1,
    activeCaseId: null,
    cases: [],
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isStringArray(
  value: unknown,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string',
    )
  );
}

function isTarget(
  value: unknown,
): value is CaseTarget {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    TARGET_KINDS.includes(
      value.kind as CaseTargetKind,
    ) &&
    typeof value.value === 'string' &&
    typeof value.label === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isActivity(
  value: unknown,
): value is CaseActivity {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.caseId === 'string' &&
    typeof value.moduleId === 'string' &&
    typeof value.action === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    ACTIVITY_STATUSES.includes(
      value.status as CaseActivityStatus,
    ) &&
    typeof value.note === 'string' &&
    (
      value.durationMs === null ||
      typeof value.durationMs ===
        'number'
    ) &&
    typeof value.createdAt === 'string'
  );
}

function isInvestigationCase(
  value: unknown,
): value is InvestigationCase {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description ===
      'string' &&
    typeof value.status === 'string' &&
    CASE_STATUSES.includes(
      value.status as CaseStatus,
    ) &&
    isStringArray(value.tags) &&
    Array.isArray(value.targets) &&
    value.targets.every(isTarget) &&
    Array.isArray(value.activities) &&
    value.activities.every(isActivity) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function parseDocument(
  value: unknown,
): CaseStoreDocument {
  if (!isRecord(value)) {
    throw new Error(
      'O arquivo de perfis possui formato inválido.',
    );
  }

  if (
    value.format !== 'zerohub-cases' ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.cases) ||
    !value.cases.every(
      isInvestigationCase,
    )
  ) {
    throw new Error(
      'O arquivo de perfis não é compatível com esta versão do ZeroHub.',
    );
  }

  const cases =
    value.cases as InvestigationCase[];

  const activeCaseId =
    typeof value.activeCaseId ===
      'string' &&
    cases.some(
      (item) =>
        item.id ===
        value.activeCaseId,
    )
      ? value.activeCaseId
      : null;

  return {
    format: 'zerohub-cases',
    schemaVersion: 1,
    activeCaseId,
    cases,
  };
}

export class JsonCasesRepository
implements CasesRepository {
  private getPath(): string {
    return join(
      app.getPath('userData'),
      'cases',
      'cases.v1.json',
    );
  }

  async load():
    Promise<CaseStoreDocument> {
    const target =
      this.getPath();

    try {
      const raw =
        await readFile(
          target,
          'utf8',
        );

      const parsed: unknown =
        JSON.parse(raw);

      return parseDocument(parsed);
    } catch (unknownError) {
      const error =
        unknownError as
          NodeJS.ErrnoException;

      if (error.code === 'ENOENT') {
        return emptyDocument();
      }

      if (
        unknownError instanceof
        SyntaxError
      ) {
        throw new Error(
          'O arquivo local de perfis está corrompido.',
        );
      }

      throw unknownError;
    }
  }

  async save(
    document: CaseStoreDocument,
  ): Promise<void> {
    const target =
      this.getPath();

    const temporary =
      `${target}.tmp`;

    await mkdir(
      dirname(target),
      {
        recursive: true,
        mode: 0o700,
      },
    );

    await writeFile(
      temporary,
      `${JSON.stringify(
        document,
        null,
        2,
      )}\n`,
      {
        encoding: 'utf8',
        mode: 0o600,
      },
    );

    await rm(
      target,
      {
        force: true,
      },
    );

    await rename(
      temporary,
      target,
    );
  }
}
