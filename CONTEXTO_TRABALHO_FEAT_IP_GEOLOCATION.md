# Contexto de trabalho — feat/ip-geolocation-intelligence

Atualizado em 2026-08-24. Este documento descreve a árvore de trabalho da
branch e não substitui `CONTEXTO_MESTRE_ZEROHUB.md`, que permanece como
referência histórica da main.

## Referência e preservação

- Branch: `feat/ip-geolocation-intelligence`.
- HEAD de referência: `70dcfa137c29598cbb5b60085584d823fc9f5b0e`.
- `origin/main` local na inspeção: o mesmo commit; divergência `0 0`.
- A execução começou com alterações rastreadas e não rastreadas importantes.
  Elas foram preservadas; não houve limpeza, descarte ou operação de histórico.
- Backup externo: `C:\Users\User\Documents\zerohub-backups\zerohub-20260823-235452`.
- O backup contém 2.290 arquivos (incluindo o manifesto), 13.076.008 bytes e
  uma cópia do `.git`; `node_modules`, ambientes, builds, cobertura, caches e
  logs regeneráveis foram excluídos.
- Os hashes SHA-256 de `AGENTS.md`, `CONTEXTO_MESTRE_ZEROHUB.md`,
  `package.json`, `src/main.ts` e `AuthenticationGate.tsx` coincidiram entre
  origem e backup antes das edições.
- Backup adicional da retomada:
  `C:\Users\User\Documents\zerohub-backups\zerohub-20260824-091454`.
  Ele foi criado antes das novas edições, contém 2.314 arquivos,
  13.175.569 bytes, manifesto e cópia do `.git`; os hashes dos mesmos cinco
  arquivos críticos coincidiram com a origem.

## Arquitetura preservada

- Electron no processo principal, preload com `contextIsolation`, sandbox e
  `nodeIntegration: false`.
- Renderer React + TypeScript.
- MapLibre GL com Natural Earth local e OpenFreeMap sob demanda.
- Backend Python sem alteração nesta execução.
- IPC validado para autenticação, busca geográfica e IP Intelligence.

## Estado funcional encontrado

A árvore já continha, entre outras mudanças ainda não commitadas:

- login local obrigatório e bloqueio F1 com senha curta de sessão;
- login e bloqueio minimalistas, accent vermelho puro e partículas apenas no
  login inicial;
- busca universal/geográfica com Photon/OpenStreetMap;
- IP Intelligence dual-stack, filtros e indicador vetorial;
- marcadores geográficos, timeline, casos, perfis e RDAP;
- layouts Tactical, Streets Dark e Streets Light;
- OpenFreeMap urbano com Natural Earth como fallback.

## Alterações desta execução

### Privacidade e busca

- O histórico de locais agora é desabilitado por padrão e somente é carregado
  ou persistido após opt-in explícito. Favoritos continuam separados.
- O estado online/offline é acompanhado com listeners removidos no cleanup.
- Quando offline, uma busca de lugar não chama o IPC externo, preserva a busca
  local e apresenta erro localizado com possibilidade de tentar após reconexão.
- As correspondências do texto digitado são destacadas sem HTML inseguro.
- O resultado ativo acompanha o teclado e é rolado para a área visível.
- O diálogo prende Tab/Shift+Tab, fecha com Escape em qualquer controle e
  restaura o foco que o abriu.

### Autenticação e acessibilidade

- O foco anterior ao bloqueio é capturado e restaurado após desbloqueio sem
  acessar ou modificar credenciais.
- Inputs ativos expõem `aria-invalid` quando há erro e o feedback tem região
  viva atômica.
- A ordem real no Electron foi validada sem preencher dados: Login, Password,
  START e retorno a Login.
- O cálculo de rate limit foi isolado em um módulo puro compartilhado, mantendo
  cinco tentativas sem atraso, atraso exponencial posterior e teto de 30 s.
- Um teste determinístico valida progressão, teto, expiração e preservação do
  restante do estado.

### Cartografia e acabamento

- O status do mapa detalhado ganhou indicador contextual para estado local,
  loading, disponível e indisponível, com cores semânticas.
- O foco do retry usa o accent global em vez do azul legado.
- A busca passou a usar superfícies neutras do tema e realce vermelho discreto,
  sem transformar cores geográficas semânticas em vermelho.
- O texto auxiliar acessível do seletor de layout recebeu a classe utilitária
  `srOnly` efetiva; isso removeu o texto “Layout do mapa” que aparecia sobre o
  globo sem retirar o nome acessível.
- O HUD operacional inicia recolhido e, quando expandido, reposiciona o cartão
  inicial conforme o tamanho da janela para evitar sobreposição.
- A medição agora inclui área/polígono, perímetro, unidades métricas/imperiais,
  desfazer último ponto, edição e remoção de vértices e exportação GeoJSON.
- A ferramenta GeoJSON permite exportação seletiva de marcadores, IP, busca e
  importações, download/cópia GeoJSON e CSV para pontos.
- Medições e importações podem ser registradas como atividade do caso ativo,
  preservando o repositório e a timeline de atividades existentes.

### Robustez e desempenho

- Payloads de autenticação precisam ter propriedades próprias e não aceitam
  campos herdados pela cadeia de protótipos.
- A tela de autenticação expõe semântica de diálogo modal e mantém feedback
  vivo de erro sem revelar stack trace ao renderer.
- As partículas respeitam `prefers-reduced-motion`; nesse modo exibem apenas
  um campo estático. O RAF e os listeners são cancelados no cleanup e a
  animação pausa quando a janela fica oculta.
- A animação dos arcos do IP Intelligence também pausa com o documento oculto
  e remove RAF/listener ao desmontar.
- Foi adicionado `scripts/electron-smoke.mjs`, usando apenas Node e CDP já
  disponíveis, para testar uma instância Electron com perfil descartável.

### Modo Mapa Limpo

- `Shift+F2` alterna um modo transitório que oculta rail, busca, controles do
  topo, cartão inicial, drawer, seletor de modo e HUDs internos, sem fechar ou
  reinicializar seus estados.
- O canvas MapLibre, as camadas geográficas, marcadores, CTRL+clique, seleção e
  popover continuam funcionais. A atribuição obrigatória permanece visível.
- `Shift+F2` novamente ou `Escape` restaura a interface e o foco anterior; o
  mapa recebe `resize()` depois da troca.
- O atalho usa captura para ter prioridade sobre painéis que tratam `Escape`,
  funciona somente com a janela focada e é ignorado enquanto a autenticação
  mantém o conteúdo protegido como `inert`.
- Uma mensagem curta anuncia ativação/restauração e respeita
  `prefers-reduced-motion`. O modo não é persistido entre inicializações.

## Baseline e desempenho

Baseline do login em Electron/Vite, janela 1264 × 755 e DPR 1:

- inicialização aproximada: 12 s;
- 28 elementos DOM visíveis no documento e 147 listeners reportados pelo CDP;
- heap usado inicial aproximado: 24,4 MB;
- após HMR e validação: aproximadamente 28,2 MB usados;
- nenhuma animação Web Animations; partículas usam um único canvas com DPR
  limitado e requestAnimationFrame próprio;
- nenhuma exceção, Promise rejeitada ou erro do renderer observado.

Os eventos de console encontrados foram Vite/HMR, a recomendação do React
DevTools e o aviso esperado de CSP no ambiente Vite. Em produção, `src/main.ts`
aplica CSP sem `unsafe-eval`, restringe `connect-src` e permite o worker/blob
necessário ao MapLibre.

No cenário de estresse em desenvolvimento, após alternar layouts, simular
fallback/retry e trabalhar com dez marcadores, os processos Electron do perfil
descartável somaram aproximadamente 731 MB de working set. Esse número inclui
renderer, GPU e utility processes do Electron/Vite e não tem baseline
empacotado equivalente; portanto, serve somente como referência diagnóstica.
Não houve loop React, exceção do renderer ou atualização duplicada de canvas.

## Arquivos afetados nesta execução

- `src/main/services/auth.service.ts`
- `src/shared/auth/auth-rate-limit.ts`
- `src/renderer/components/auth/AuthenticationGate.tsx`
- `src/renderer/components/layout/CommandPalette.tsx`
- `src/renderer/components/workspace/useUniversalSearch.ts`
- `src/renderer/components/workspace/WorldGlobeMap.tsx`
- `src/renderer/components/workspace/MapMeasurementTools.tsx`
- `src/renderer/components/workspace/MapGeoJsonTools.tsx`
- `src/renderer/components/workspace/IpGeolocationMapLayer.tsx`
- `src/renderer/components/workspace/geo-measurement.ts`
- `src/renderer/components/workspace/map-workspace.types.ts`
- `src/renderer/styles/auth-lock.css`
- `src/renderer/styles/interface-v3.css`
- `src/renderer/styles/map-workspace.css`
- `tests/auth-validation.test.ts`
- `tests/geographic-search.test.ts`
- `scripts/electron-smoke.mjs`
- `ROADMAP_ZEROHUB.md`
- este documento.

## Validação executada até este checkpoint

- `npm run check`: passou.
- `npm run lint`: passou.
- `npm run test:auth`: 8/8 passaram no checkpoint mais recente.
- `npm run test:geo`: 11/11 passaram no checkpoint mais recente.
- `npm run test:ip`: 9/9 passaram.
- `npm run test:session`: 4/4 passaram.
- compilação Python: passou.
- `pytest python/tests`: 1/1 passou.
- `scripts/verify.sh`: passou integralmente na primeira execução final.
- `git diff --check`: passou; somente avisos de conversão LF/CRLF do Git.
- Electron real: login minimalista, centralização, partículas, accent e ordem
  de teclado confirmados sem preencher credenciais.
- Electron/CDP com perfil descartável: cinco marcadores, erro máximo de
  ancoragem de 0,0003 px, escala monotônica, um único canvas nos três layouts,
  fallback offline/retry online, F1 completo, payload hostil, rate limit e
  desbloqueio passaram sem erro do renderer.
- Modo Mapa Limpo no Electron: chrome totalmente oculto, um canvas preservado,
  atribuição visível, popover interativo, restauração pelas duas teclas e
  bloqueio do atalho durante F1; nenhuma exceção no renderer.
- O fluxo real “Meu IP público”, restrito aos domínios autorizados, confirmou
  IPv4 `***.***.***.***` e IPv6 `****:****:…` como resultados separados. Os
  filtros retornaram 2/1/1 itens em Todos/IPv4/IPv6 e IP privado foi rejeitado.
  O perfil descartável foi removido; nenhum endereço real foi documentado.

## Pendências e limitações confirmadas

- O workspace autenticado, o bloqueio F1 e os layouts foram testados sem
  contornar autenticação, usando perfil isolado e credenciais fictícias.
- O in-app Browser não controla a janela Electron; por isso, a inspeção do
  Electron foi feita pela porta de diagnóstico temporária e será encerrada.
- A indicação `navigator.onLine` é preventiva, não prova disponibilidade do
  Photon; timeouts e erros do provider continuam tratados pelo main process.
- O rate limit foi validado no Electron real com armazenamento do perfil
  descartável. Não houve acesso ao `userData` real.
- Câmeras e modo rua continuam bloqueados por credencial/provider e não foram
  implementados.
- Não foi possível executar um leitor de tela nativo; a semântica e o teclado
  foram auditados, mas essa verificação humana continua recomendada.
- A métrica de memória disponível é de desenvolvimento e depois de estresse;
  falta um comparativo confiável em build empacotado para afirmar ganho
  percentual de memória.

## Próximos passos seguros

1. Auditar o fluxo completo com leitor de tela nativo.
2. Medir um build empacotado em repouso e após estresse para formar baseline
   comparável de memória/CPU/GPU.
3. Implementar câmeras somente depois de o usuário fornecer uma chave gratuita
   e aceitar os termos do provider escolhido.
4. Decidir entre manter o overzoom do OpenFreeMap (`maxzoom` 14) ou adotar
   PMTiles/provider com credencial e custo operacional explicitamente aceitos.
5. Ampliar atalhos e operações em lote reversíveis em uma etapa independente.

Nenhuma senha, IP público, coordenada real, token ou caminho de credencial foi
incluído neste contexto.
