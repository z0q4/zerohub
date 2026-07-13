import {
  ipcMain,
} from 'electron';

import {
  addCaseActivity,
  addCaseTarget,
  createCase,
  getActiveCase,
  getCase,
  listCases,
  removeCaseTarget,
  setActiveCase,
  setPrimaryCaseTarget,
  updateCase,
  updateCaseStatus,
} from '../services/cases.service';

export function registerCasesIpcHandlers():
  void {
  ipcMain.handle(
    'cases:list',
    () =>
      listCases(),
  );

  ipcMain.handle(
    'cases:get',
    (
      _event,
      caseId: unknown,
    ) =>
      getCase(caseId),
  );

  ipcMain.handle(
    'cases:get-active',
    () =>
      getActiveCase(),
  );

  ipcMain.handle(
    'cases:create',
    (
      _event,
      input: unknown,
    ) =>
      createCase(input),
  );

  ipcMain.handle(
    'cases:set-active',
    (
      _event,
      caseId: unknown,
    ) =>
      setActiveCase(caseId),
  );

  ipcMain.handle(
    'cases:add-activity',
    (
      _event,
      input: unknown,
    ) =>
      addCaseActivity(input),
  );

  ipcMain.handle(
    'cases:update',
    (
      _event,
      input: unknown,
    ) =>
      updateCase(input),
  );

  ipcMain.handle(
    'cases:add-target',
    (
      _event,
      input: unknown,
    ) =>
      addCaseTarget(input),
  );

  ipcMain.handle(
    'cases:remove-target',
    (
      _event,
      input: unknown,
    ) =>
      removeCaseTarget(input),
  );

  ipcMain.handle(
    'cases:set-primary-target',
    (
      _event,
      input: unknown,
    ) =>
      setPrimaryCaseTarget(
        input,
      ),
  );

  ipcMain.handle(
    'cases:update-status',
    (
      _event,
      caseId: unknown,
      status: unknown,
    ) =>
      updateCaseStatus(
        caseId,
        status,
      ),
  );
}
