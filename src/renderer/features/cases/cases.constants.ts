import type {
  CaseStatus,
  CaseTargetKind,
} from '../../../shared/cases/cases.types';

export const TARGET_LABELS:
  Record<CaseTargetKind, string> = {
    domain: 'Domínio',
    ip: 'Endereço IP',
    email: 'E-mail',
    url: 'URL',
    hash: 'Hash',
    file: 'Arquivo',
    other: 'Outro',
  };

export const TARGET_PLACEHOLDERS:
  Record<CaseTargetKind, string> = {
    domain: 'example.com',
    ip: '192.0.2.1',
    email: 'analista@example.com',
    url: 'https://example.com/recurso',
    hash: 'd41d8cd98f00b204e9800998ecf8427e',
    file: '/home/usuario/arquivo.bin',
    other: 'Identificador ou valor do alvo',
  };

export const STATUS_LABELS:
  Record<CaseStatus, string> = {
    active: 'Ativo',
    paused: 'Pausado',
    archived: 'Arquivado',
  };
