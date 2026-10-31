import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { isAuthUnlocked } from '../services/auth.service';
import { ibgeBoundaryService } from '../services/ibge-boundaries.service';
import { isIbgeMunicipalityCode, isIbgeStateCode } from '../../shared/municipal-boundaries/municipal-boundaries.types';
import { parseGeographicRequestId } from './geographic-search.ipc';

function authorize(event: IpcMainInvokeEvent): void {
  if (!isAuthUnlocked() || !event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error('Sessão ou frame não autorizado.');
}
export function registerIbgeBoundariesIpcHandlers(): void {
  ipcMain.handle('ibge-boundaries:list', async (event, state: unknown, rawId: unknown) => {
    authorize(event); const id = parseGeographicRequestId(rawId);
    if (!isIbgeStateCode(state) || !id) throw new Error('Solicitação IBGE inválida.');
    return ibgeBoundaryService.list(state, id);
  });
  ipcMain.handle('ibge-boundaries:geometry', async (event, state: unknown, code: unknown, rawId: unknown) => {
    authorize(event); const id = parseGeographicRequestId(rawId);
    if (!isIbgeStateCode(state) || !isIbgeMunicipalityCode(code, state) || !id) throw new Error('Solicitação IBGE inválida.');
    return ibgeBoundaryService.boundary(state, code, id);
  });
  ipcMain.handle('ibge-boundaries:cancel', (event, rawId: unknown) => {
    authorize(event); const id = parseGeographicRequestId(rawId); return id ? ibgeBoundaryService.cancel(id) : false;
  });
}
