import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { isAuthUnlocked } from '../services/auth.service';
import { intelligenceProvider } from '../services/intelligence-overpass.service';
import { parseGeographicRequestId } from './geographic-search.ipc';
import type { IntelligenceQuery } from '../../shared/intelligence-layers/intelligence-types';
function authorize(event: IpcMainInvokeEvent): void {
  if (!isAuthUnlocked() || !event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error('Sessão ou frame não autorizado.');
}
export function registerIntelligenceLayersIpcHandlers(): void {
  ipcMain.handle('intelligence-layers:query', (event, value: unknown) => {
    authorize(event);
    if (typeof value !== 'object' || value === null || Array.isArray(value) || !parseGeographicRequestId((value as { requestId?: unknown }).requestId)) throw new Error('Consulta territorial inválida.');
    return intelligenceProvider.query(value as IntelligenceQuery);
  });
  ipcMain.handle('intelligence-layers:cancel', (event, value: unknown) => { authorize(event); const id = parseGeographicRequestId(value); return id ? intelligenceProvider.cancel(id) : false; });
}
