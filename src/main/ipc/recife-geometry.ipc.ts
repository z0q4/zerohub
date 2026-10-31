import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { isAuthUnlocked } from '../services/auth.service';
import { recifeGeometryService } from '../services/recife-geometry.service';
import { parseGeographicRequestId } from './geographic-search.ipc';

function authorize(event: IpcMainInvokeEvent): void {
  if (!isAuthUnlocked() || !event.senderFrame || event.senderFrame !== event.sender.mainFrame) throw new Error('Sessão ou frame não autorizado.');
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !Array.from(value).some((char) => { const code = char.codePointAt(0) ?? 0; return code < 32 || code === 127; });
}
export function registerRecifeGeometryIpcHandlers(): void {
  ipcMain.handle('recife-geometry:neighborhood', async (event, city: unknown, name: unknown, rawId: unknown, savedCode: unknown) => {
    authorize(event); const id = parseGeographicRequestId(rawId);
    if (city !== '2611606' || !text(name, 160) || !id || (savedCode !== undefined && !text(savedCode, 8))) throw new Error('Solicitação de bairro inválida.');
    return recifeGeometryService.neighborhood(city, name, id, typeof savedCode === 'string' ? savedCode : undefined);
  });
  ipcMain.handle('recife-geometry:street', async (event, city: unknown, neighborhood: unknown, name: unknown, rawId: unknown, savedCode: unknown) => {
    authorize(event); const id = parseGeographicRequestId(rawId);
    if (city !== '2611606' || !text(neighborhood, 8) || !text(name, 200) || !id || (savedCode !== undefined && !text(savedCode, 8))) throw new Error('Solicitação de via inválida.');
    return recifeGeometryService.street(city, neighborhood, name, id, typeof savedCode === 'string' ? savedCode : undefined);
  });
  ipcMain.handle('recife-geometry:cancel', (event, rawId: unknown) => {
    authorize(event); const id = parseGeographicRequestId(rawId); return id ? recifeGeometryService.cancel(id) : false;
  });
}
