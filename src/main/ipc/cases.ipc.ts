import {
  ipcMain,
} from 'electron';

import {
  addCaseActivity,
  createCase,
  getActiveCase,
  getCase,
  listCases,
  setActiveCase,
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
