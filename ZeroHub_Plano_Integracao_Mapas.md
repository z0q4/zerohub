# ZeroHub — Plano técnico de integração cartográfica

> Plano histórico: registra propostas anteriores à implementação e não é um
> retrato do comportamento atual. Consulte `CONTEXTO_MESTRE_ZEROHUB.md` para
> a arquitetura e as limitações efetivamente implementadas nesta branch.

**Base verificada:** `z0q4/zerohub`, branch `main`, commit `d1af611ff3b935f69043bfc3ae98023835d0c46b` (24/08/2026).<br>
**Referência:** `bilawalsidhu/gods-eye-view` (GitHub).<br>
**Natureza:** proposta técnica, **sem alterações, commits ou deploy**.

## 1. Diagnóstico

- ZeroHub já possui Electron + React + TypeScript, MapLibre GL, backend Python, workspace OSINT/ATTACK, casos/timeline, IP geolocation, camadas, medições, GeoJSON, três layouts e fallback Natural Earth/OpenFreeMap.
- O mapa principal está concentrado em `src/renderer/components/workspace/WorldGlobeMap.tsx` (~104 KB), o que torna integração de vários renderizadores mais arriscada sem uma abstração de provedores.
- Configurações genéricas são normalizadas por `src/main/services/settings.service.ts` e salvas em JSON. Chaves **não** devem ser adicionadas a esse JSON.
- `src/main/services/virustotal-secret.service.ts` demonstra o uso de `electron.safeStorage` para secrets. Aproveitar o padrão, mantendo o status público separado do valor.
- A CSP de produção em `src/main.ts` permite conexão com `https://tiles.openfreemap.org`, mas não permite por padrão frames e recursos do Google. Qualquer ampliação precisa ser mínima, específica e testada.
- `AGENTS.md` exige branch separada, leitura de contexto, nenhuma alteração direta na `main`, aprovação explícita para commit/push e execução dos checks.
- A documentação `CONTEXTO_MESTRE_ZEROHUB.md` descreve um checkpoint anterior (PR #20), enquanto o código atual está no PR #26; atualizar o documento junto com mudanças relevantes.

## 2. Experiência desejada

Na seção **Fontes do mapa**:

| Fonte | Modo | Interações | Chave | Observação |
|---|---|---|---|---|
| OpenFreeMap + Natural Earth | Globo/mapa gratuito | Marcadores, zoom, estilos e ferramentas atuais | Não | Padrão e fallback |
| Google Maps Embed | Visualização Google 2D | Navegação no próprio iframe | Sim | Gratuito para o Embed API, mas exige conta de faturamento; não oferece sincronização bidirecional completa da câmera |
| Google Street View Embed | Panorama 360° independente | Olhar ao redor e navegar por panoramas disponíveis | Sim | Abrir em visualização isolada; verificar restrições de termos |
| Google Maps JavaScript | Mapa Google interativo integrado | Controle da câmera, marcadores e overlays próprios | Sim | Cobrança por SKUs; requer gerenciamento de key/billing |
| Google Photorealistic 3D Tiles | Globo/cidades 3D realistas | Navegação 3D avançada | Sim | Map Tiles API + renderizador compatível (ex.: CesiumJS), fase posterior |
| Mapillary / Panoramax | Imagens de rua alternativas | Exploração de cobertura e imagens históricas | Possivelmente | Conforme disponibilidade e condições do provedor |

**Não misturar Street View e mapas não-Google na mesma tela.** Os termos atuais do Google também restringem alguns usos dentro da mesma aplicação, então a segregação visual não substitui uma revisão dos termos aplicáveis antes de distribuição.

## 3. Arquitetura sugerida

**Camada de domínio**

- Criar `src/shared/map-providers/` com IDs, capacidades, estados (`unconfigured`, `ready`, `loading`, `error`, `quota`, `disabled`) e tipos de solicitações, sem secrets.
- Manter separadas as duas escolhas: **provedor** (`openfreemap`, `google`) e **modalidade** (`globe`, `map-2d`, `street-360`, `photorealistic-3d`). Alguns pares não serão suportados; a UI deve indicar isso.
- Adicionar metadados de capacidade (`supportsMarkers`, `supportsCameraSync`, `supportsStreetView`, `supports3D`, `requiresBilling`) para evitar abstrações falsas (por exemplo, iframe não permite ler sua câmera pelo JavaScript do host).

**Processo principal Electron**

- Criar `src/main/services/map-provider-keys.service.ts` com `safeStorage`, permissões restritas e operação de remover/rotacionar credenciais.
- Criar `src/main/ipc/map-providers.ipc.ts` com validação rigorosa dos parâmetros e checagem da sessão autenticada.
- Registrar handlers em `src/main.ts` e expor métodos estritos em `src/preload.ts`.
- Nunca enviar chaves de serviços REST ao renderer. Para APIs que obrigatoriamente funcionam no navegador, uma chave de navegador será exposta ao cliente durante o uso: restringir seu escopo à API permitida e criar limites/alertas de faturamento. O Electron não assegura segredo absoluto para chaves de cliente.
- Ajustar CSP conforme o mecanismo escolhido (origens de frame, script, connect, img), sem desativar `sandbox`, `contextIsolation` nem `nodeIntegration: false`.

**Interface e renderização**

- Extrair uma camada de apresentação de provedores e uma interface de viewport comum de `WorldGlobeMap.tsx` de forma incremental, preservando fontes e overlays do MapLibre existentes.
- Criar `src/renderer/components/workspace/MapProviderSelector.tsx` para selecionar provedor/modalidade, exibir estado, cobertura, custo e botão de configuração.
- Criar um host de renderizadores que desmonte a visualização anterior e monte a próxima, restaurando coordenadas/zoom/rumo quando a API permitir. Não prometer sincronização bidirecional para iframes externos.
- Adicionar `GoogleEmbedView.tsx` como MVP isolado, seguido por `GoogleMapView.tsx` mais avançado, somente após validar termos, chaves e testes.
- Criar uma seção de credenciais em `src/renderer/features/settings/pages/SettingsPage.tsx`, exibindo estado mascarado, teste, remover e instruções de custo. Nunca persistir chaves em `AppSettings` ou `localStorage`.
- Preservar marcadores, seleções e caso ativo ao mudar de renderizador, mas exibir indisponibilidade de overlays não suportados em determinado modo.

## 4. Recursos úteis do God's Eye View por prioridade

| Prioridade | Recurso | Abordagem ZeroHub |
|---|---|---|
| P0 | Gerenciador multi-API e modo de mapa | Base para qualquer integração futura |
| P0 | Street View e imagens de rua | Modos próprios; Mapillary/Panoramax como alternativas |
| P1 | Terremotos USGS | Feed público, atualização periódica, timestamps, marcador e filtros |
| P1 | Rastreamento ADS-B de aeronaves | Fonte pública permitida, metadados com timestamps e limites de cobertura |
| P1 | Órbitas e satélites | Elementos orbitais CelesTrak, sem declarar observações inferidas como ao vivo |
| P1 | Câmeras públicas | Aproveitar a pesquisa já documentada no roadmap sobre Windy Webcams; jamais presumir CCTV ao vivo sem feed real |
| P2 | Incêndios NASA FIRMS | Com licenças, chave e atualização de dados claramente indicadas |
| P2 | Rastreamento marítimo AIS | API autorizada, acesso e custos conforme o fornecedor |
| P2 | Cenas/links compartilháveis | Serialização de câmera, filtros e camadas, mas **não** de secrets nem dados privados de casos por padrão |
| P3 | 3D fotorealista, FLIR, cockpit e IA | Só depois de validar estabilidade, consumo, precisão e custos |

**Não copiar** nomes, imagens, modelos, datasets ou feeds de terceiros sob a suposição de que o MIT do repositório de referência os cobre. A licença do projeto distingue código-fonte e dados/ativos externos.

## 5. Primeira entrega (MVP) — critérios de aceite

1. Padrão OpenFreeMap continua funcionando sem chave nem conexão (com fallback Natural Earth).
2. Configurações permitem cadastrar/remover chave de Google Maps Embed, com indicador de proteção e sem valor visível após salvamento.
3. Seletor permite abrir uma vista exclusiva de Google Maps 2D ou Street View em coordenadas informadas, com mensagens claras para chave ausente, falta de cobertura ou falha de carregamento.
4. Transição de provedor não apaga caso ativo, timeline, marcadores nem preferências já existentes.
5. View Google não é colocada lado a lado ou sobre OpenFreeMap; attributions e termos respeitados.
6. O aplicativo não tenta obter tiles do Google por scraping nem combina conteúdo de Places/Google com mapas OSM em condições proibidas.
7. Segurança: IPC validado, CSP mínima, sem credenciais no Git, logs, parâmetros de debug ou armazenamento genérico.
8. Validar `npm run check`, `npm run lint`, testes Python e `git diff --check`; smoke no Electron Linux/Windows quando disponível.
9. Controles de custo, restrições de API e alertas de orçamento são documentados antes de ativar qualquer API cobrada.
10. O projeto de integração só pode ser publicado por branch/PR após autorização explícita e testes.

## 6. Referências oficiais

- Maps Embed API: https://developers.google.com/maps/documentation/embed/quickstart
- Embed modes (including Street View): https://developers.google.com/maps/documentation/embed/embedding-map
- Map Tiles API: https://developers.google.com/maps/documentation/tile/overview
- Google's security guidance: https://developers.google.com/maps/api-security-best-practices
- Terms: https://cloud.google.com/maps-platform/terms
- License do God’s Eye View: https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE
