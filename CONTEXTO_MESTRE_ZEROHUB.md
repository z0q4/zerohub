# Contexto Mestre do ZeroHub

> As seções 1 a 14 são a fotografia histórica de `main` no PR #20 e podem
> não descrever o código desta branch. As seções 15 e 16 registram a integração
> multi-provider, o HUD e a localização geográfica; as seções 17 e 18 registram
> o refinamento visual e o Signal Lab desenvolvidos na branch de trabalho.

## 1. Referência deste documento

Este documento descreve o estado real da branch `main` após o merge do PR #20.

- Commit de referência: `a46c065433d291e6eeb384178c62dbb3d8ea59bc`
- Versão declarada em `package.json`: `0.1.0`
- Data da fotografia: 15 de julho de 2026
- Arquitetura preservada: Electron + React + TypeScript + backend Python

O conteúdo abaixo foi conferido contra o código, a configuração de CI e o histórico Git. Ele não representa roadmap e não implica funcionalidades ausentes do repositório.

## 2. Arquitetura atual

O ZeroHub é uma aplicação desktop Electron Forge empacotada com Vite.

- `src/main.ts`: cria a janela, registra handlers IPC e controla o ciclo de vida do processo principal.
- `src/preload.ts`: expõe ao renderer uma API limitada por `contextBridge`.
- `src/renderer/`: aplicação React responsável pelo workspace cartográfico, páginas, ferramentas e estado visual.
- `src/shared/`: tipos e registros compartilhados entre main, preload e renderer.
- `src/main/python/python.service.ts`: inicia `python/main.py` sob demanda e troca mensagens JSON por `stdin`/`stdout`, com identificadores de requisição e timeout de 20 segundos.
- `python/`: backend e módulos Python.

A janela mantém as opções de segurança atuais:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- `sandbox: true`.

O empacotamento usa ASAR, inclui a pasta `python` como recurso e possui makers para Linux (`deb`), Windows (Squirrel) e macOS (`zip`). Os fuses desabilitam execução como Node e opções/inspeção por CLI, habilitam criptografia de cookies e exigem integridade e carregamento pelo ASAR.

## 3. Módulos registrados

O registro compartilhado marca como operacionais os seguintes módulos:

- Workspace: Dashboard e Perfis do alvo (`cases`).
- Network: Network e Network Toolkit.
- Intelligence: OSINT, Threat Intelligence, Web Recon, Email Security e IOC Intelligence.
- Analysis: File Analysis, Secret Scanner, File Forensics, Log Analysis e System Audit.
- Data & Dev: Encoding, Utilities, Cryptography e Developer Tools.
- System: Settings.

O registro central fica em `src/shared/modules/module.registry.ts`.

### 3.1 Modos do workspace

Além das seções, cada módulo declara em quais modos do workspace está disponível:

- OSINT: Network, OSINT, Threat Intelligence, Web Recon, Email Security e IOC Intelligence.
- ATTACK: Encoding, Utilities, File Analysis, Secret Scanner, File Forensics, Log Analysis, System Audit, Cryptography, Network Toolkit e Developer Tools.
- Compartilhados: Dashboard, Perfis do alvo e Settings.

O seletor alterna entre OSINT e ATTACK. Se o módulo aberto não pertencer ao novo modo, a aplicação volta ao Dashboard. A command palette e a rail lateral também filtram os módulos conforme o modo ativo.

### 3.2 Workspace cartográfico e perfil visual

`MapWorkspaceShell` envolve a área principal da aplicação. O Dashboard é a visão inicial sobre o globo; as demais páginas são abertas em `ModuleWorkbenchDrawer`, mantendo o mapa ao fundo. A shell inclui rail compacta de módulos, busca, atalhos para perfis e configurações, recentralização do mapa e seletor OSINT/ATTACK.

`WorldGlobeMap` usa MapLibre GL com projeção de globo e dados GeoJSON locais para países, divisões administrativas e cidades. Os dados compactados derivam do Natural Earth, têm atribuição em `src/renderer/assets/map/MAP_DATA_LICENSE.md` e podem ser regenerados por `scripts/prepare-map-data.py`. O mapa oferece zoom, recentralização, rotação automática, respeito a preferência de movimento reduzido e alternância visual em preto e branco.

O mapa ainda não projeta alvos dos perfis: `MapWorkspaceShell` fornece `markerCount={0}`, portanto a interface informa que não há coordenadas cadastradas independentemente dos alvos existentes.

As configurações persistentes agora também incluem `visualProfile`, com valores `default` e `monochrome`. O valor padrão continua usando a identidade escura com accent color; o perfil monocromático aplica a variante Black & White.

## 4. Sistema persistente de perfis e casos

### 4.1 Persistência

Os perfis são armazenados pelo processo main em:

```text
userData/cases/cases.v1.json
```

O documento persistido possui:

- marcador de formato `zerohub-cases`;
- `schemaVersion: 1`;
- `activeCaseId`, que aponta para o perfil ativo ou contém `null`;
- lista de casos completos.

Cada caso possui identificador UUID, nome, descrição, status, tags, alvos, atividades e timestamps de criação/atualização. Os status aceitos são `active`, `paused` e `archived`.

O repositório JSON valida o documento ao carregar. As gravações criam um arquivo temporário e depois o renomeiam para o destino. A fila de mutações do serviço serializa alterações concorrentes. O arquivo de casos usa permissões restritas quando criado em plataformas que respeitam esses modos.

### 4.2 Interface e operações existentes

O renderer usa `CaseWorkspaceProvider` e `useCaseWorkspace` como ponto central para:

- listar resumos dos perfis;
- obter e selecionar o perfil ativo;
- criar perfis com alvo principal opcional;
- editar nome, descrição e tags;
- alterar status;
- adicionar atividades;
- adicionar e remover alvos;
- escolher o alvo principal.

A shell exibe o perfil ativo no topo e na barra de status. A página Settings também permite selecionar ou desativar o perfil ativo. Não existe handler de exclusão de perfil no contrato atual de casos.

## 5. Gerenciamento avançado de alvos

Os tipos aceitos são:

- domínio;
- IP;
- e-mail;
- URL;
- hash;
- arquivo;
- outro.

O serviço normaliza e valida valores conforme o tipo. Domínios, e-mails, URLs, IPs e hashes possuem validações específicas; hashes aceitam comprimentos conhecidos. Um alvo pode ter uma identificação opcional e recebe UUID e timestamp.

Regras atuais:

- o primeiro item da lista é o alvo principal;
- alvos duplicados no mesmo perfil são rejeitados por identidade `tipo + valor` normalizado;
- qualquer alvo secundário pode ser promovido a principal;
- ao remover o principal, o próximo alvo da lista assume essa posição;
- a remoção exige confirmação na interface;
- adicionar, remover ou trocar o alvo principal gera uma atividade automática.

## 6. Timeline

As atividades ficam dentro do próprio perfil e são persistidas em ordem mais recente primeiro. Cada atividade contém:

- UUID e identificador do caso;
- módulo e ação;
- título e status (`success`, `error`, `cancelled` ou `info`);
- entrada e saída serializáveis;
- nota;
- duração opcional;
- timestamp.

A timeline recebe atividades de duas formas:

1. Automática, para alterações de perfil, mudanças de status, adição/remoção de alvo e troca do alvo principal.
2. Solicitada pelo usuário, para notas manuais e resultados de ferramentas integradas.

A criação inicial do perfil não adiciona, por si só, uma atividade à timeline.

## 7. Integrações RDAP, DNS e Ping com perfis

As três ferramentas permitem registrar um resultado bem-sucedido no perfil ativo:

- RDAP (`osint` / `rdap-domain-lookup`): registra domínio, resultado completo, resumo de status/nameservers e duração.
- DNS (`network` / `dns-lookup`): registra domínio, tipo consultado, registros retornados e duração. Os tipos disponíveis são A, AAAA, MX, TXT, NS e CNAME.
- Ping (`network` / `ping`): registra alvo, quantidade de pacotes, timeout, resultado e duração. O botão de registro só fica disponível para resultado considerado bem-sucedido, sem timeout e com código de saída zero.

A execução da ferramenta não grava automaticamente na timeline. Após um resultado válido, o usuário aciona o registro. É necessário haver um perfil ativo.

## 8. `useCaseResultRegistration`

O hook compartilhado fica em:

```text
src/renderer/features/cases/useCaseResultRegistration.ts
```

RDAP, DNS e Ping usam esse hook para evitar lógica duplicada. Ele:

- obtém perfil ativo e operação `addActivity` pelo contexto;
- bloqueia registro sem perfil, durante carregamento/mutação ou enquanto outro registro está em voo;
- captura o perfil alvo antes da operação assíncrona;
- impede registrar o mesmo resultado mais de uma vez no mesmo perfil;
- permite registrar o mesmo resultado em perfis diferentes;
- invalida o estado de registro quando a ferramenta gera ou limpa um resultado;
- evita atualizações de estado após desmontagem ou depois de uma nova geração de resultado;
- expõe mensagens, estado de progresso e último perfil registrado para a interface.

## 9. Opção “Salvar sessão ao fechar”

A configuração permanente `saveSessionOnClose` fica em `AppSettings` e é armazenada junto das demais configurações em `userData/settings.json`.

O valor padrão é `true`. A normalização usa esse padrão quando o campo não existe, preservando o comportamento de instalações anteriores ao PR #19.

### 9.1 Opção ligada

O renderer salva e restaura:

- página ativa;
- favoritos;
- módulos recentes;
- modo do workspace (`osint` ou `attack`).

O ponteiro `activeCaseId` também pode restaurar o perfil ativo.

### 9.2 Opção desligada

Ao salvar a opção desligada:

- as quatro chaves transitórias de página ativa, favoritos, recentes e modo do workspace são removidas imediatamente do `localStorage`;
- novas gravações do snapshot ficam suspensas;
- `activeCaseId` é definido como `null` sem remover qualquer perfil ou atividade;
- uma limpeza defensiva do perfil ativo ocorre no `before-quit`;
- na próxima inicialização, o contexto consulta a configuração e limpa o perfil ativo antes de tentar restaurá-lo.

Assim, mesmo quando um encerramento abrupto impede a execução do hook de saída, a inicialização seguinte não restaura o ponteiro antigo.

### 9.3 Limites e dados preservados

O estado atual não persiste busca, filtros, posição/zoom do globo, rotação do mapa ou o botão P/B local do mapa. Quando a opção está ligada, a página ativa e o modo do workspace podem ser restaurados; caso contrário, a aplicação usa Dashboard e modo OSINT.

A opção não remove:

- perfis, alvos ou timeline;
- outras configurações;
- chaves do VirusTotal;
- secrets de IOC Intelligence;
- qualquer outro dado permanente.

## 10. Validação local

O script oficial é:

```bash
scripts/verify.sh
```

Ele executa, com falha imediata:

1. `npm run check` (`tsc --noEmit`);
2. `npm run lint` (`eslint --ext .ts,.tsx .`);
3. compilação das fontes Python com `compileall`;
4. testes Python com `pytest` e `PYTHONPATH=python`;
5. `git diff --check`.

O script usa `.venv/bin/python` quando disponível; caso contrário, usa `python3`.

## 11. CI atual

O workflow `.github/workflows/ci.yml` chama-se `CI` e roda em:

- pull requests para `main`;
- pushes em `main`;
- execução manual (`workflow_dispatch`).

Ele usa permissão somente de leitura para conteúdo e cancela uma execução anterior do mesmo grupo/ref quando uma nova começa.

Jobs atuais:

- `TypeScript and ESLint`: Ubuntu, Node.js 22, `npm ci`, `npm run check` e `npm run lint`, timeout de 15 minutos.
- `Python`: Ubuntu, Python 3.13, instalação de `requirements-dev.txt`, `compileall` e `pytest`, timeout de 10 minutos.

O workflow usa `actions/checkout@v7`, `actions/setup-node@v6` e `actions/setup-python@v6`. Atualmente existe um arquivo de testes Python, `python/tests/test_file_cracker.py`; isso não deve ser interpretado como cobertura completa do produto.

## 12. Histórico de Pull Requests até o #20

| PR | Commit em `main` | Título confirmado |
| --- | --- | --- |
| #1 | `b2ad457` | `refactor: migrate module logic to Python` |
| #2 | `478a758` | `feat: add file analysis and VirusTotal scanner` |
| #3 | `c174382` | `feat: add security analysis toolkit` |
| #4 | `d7db139` | `feat: expand modules and redesign ZeroHub interface` |
| #5 | `41368c8` | `chore: add CI and validation baseline` |
| #6 | `b6b41f8` | `refactor: centralize renderer styles entrypoint` |
| #7 | `d0bdf6b` | `fix: complete renderer CSS entrypoint` |
| #8 | `6ba7a3c` | `refactor: remove duplicated VirusTotal styles` |
| #9 | `ef82982` | `refactor: remove remaining exact CSS duplicates` |
| #10 | `787ce6c` | `refactor: remove redundant structural CSS declarations` |
| #11 | `a5678ce` | `refactor: remove redundant component CSS declarations` |
| #12 | `13e1674` | `feat: add persistent case workspace core` |
| #13 | `573bb83` | `feat: add case workspace interface` |
| #14 | `e07d497` | `feat: add advanced case management` |
| #15 | `cfec344` | `feat: integrate RDAP results with case timeline` |
| #16 | `95cd77d` | `refactor: centralize case result registration` |
| #17 | `1d6f968` | `feat: integrate DNS results with case timeline` |
| #18 | `e7f08bd` | `feat: integrate Ping results with case timeline` |
| #19 | `335be32` | `feat: add session persistence setting` |
| #20 | `a46c065` | `Codex/dashboard earth 3d` |

Os PRs #1, #2 e #20 aparecem como merge commits no histórico. Do PR #3 ao #19, os commits listados acima são os commits resultantes presentes linearmente em `main`. O PR #20 preserva dentro do merge os commits `ba35885` e `8347859`.

## 13. Outros commits presentes no histórico de `main`

Além dos commits de merge/squash relacionados na tabela, o histórico contém estes commits anteriores ou internos aos primeiros merges:

| Commit | Assunto no Git |
| --- | --- |
| `d7e4a57` | `feat: initial ZeroHub desktop version` |
| `9732958` | `refactor: migrate module logic to Python` |
| `efaa058` | `feature: initial README file` |
| `bece7d7` | `feat: add file analysis and VirusTotal scanner` |
| `e7f3792` | `hotfix: Fixed issue on threat_intelligence for http, https auto-input` |
| `0e0f266` | `changes: how install and start get added` |
| `d7800de` | `feat: Zip_cracker added with wordlists;` |
| `ba8a269` | `feat: Zip_cracker added with wordlists included` |
| `2f96979` | `feat: zip_cracker added with wordlist` |
| `ba35885` | `feat: add globe workspace and monochrome profile` |
| `8347859` | `Merge remote-tracking branch 'origin/main' into codex/dashboard-earth-3d` |

## 14. Regras operacionais do repositório

O arquivo `AGENTS.md` determina:

- antes de qualquer alteração, ler integralmente este contexto mestre e confirmar branch, working tree, sincronização com `origin/main` e estrutura relevante;
- preservar Electron + React + TypeScript + backend Python;
- nunca trabalhar diretamente em `main`;
- confirmar a estrutura real antes de agir;
- usar caminhos completos ao mencionar ou operar arquivos;
- trabalhar uma etapa por vez;
- não fazer commit nem push sem autorização explícita;
- antes de concluir alterações, executar TypeScript, ESLint, testes Python e `git diff --check`.

## 15. Integração cartográfica multi-provider (branch de trabalho)

Na branch `feat/map-providers-google-embed`, a primeira etapa da arquitetura multi-provider adiciona, sem substituir o mapa principal:

- domínio compartilhado em `src/shared/map-providers/`, com provedores, modalidades, capacidades e validação estrita;
- chave da Google Maps Embed API armazenada fora de `settings.json`, criptografada por `electron.safeStorage`, com arquivo restrito, rotação e remoção;
- IPC autenticado para consultar o estado da chave e criar sessões Embed validadas, sem endpoint que devolva a chave isoladamente;
- seletor entre OpenFreeMap, Google Maps 2D e Google Street View 360°;
- vista Google exclusiva, com entrada validada de coordenadas, timeout, retry e mensagens sobre cobertura, cota, faturamento e restrições;
- preservação do `WorldGlobeMap` montado e inativo enquanto a vista Google está aberta, mantendo casos, timeline, câmera, marcadores transitórios e camadas;
- CSP de produção limitada a frames em `https://www.google.com`, bloqueio de novas janelas e negação de permissões web não solicitadas;
- seção de credenciais em Settings que nunca repopula nem exibe a chave salva e documenta a necessidade de restrições da API e alertas de orçamento.

O Google Maps Embed é uma integração de navegador: durante o uso, a chave restrita aparece no URL do frame. Ela não deve ser tratada como segredo absoluto; deve ser limitada à Maps Embed API no Google Cloud, com cotas, faturamento e alertas apropriados. O conteúdo Google não é combinado com tiles ou overlays do OpenFreeMap, e a câmera do iframe não é apresentada como sincronizada com o mapa principal.

## 16. HUD e localização geográfica (branch de trabalho)

Na branch `feat/map-providers-google-embed`, o workspace cartográfico usa uma
estrutura Grid/Flex com navegação e busca superiores, rail lateral, área de
mapa, painéis encaixados, dock de ferramentas e barra de estado. O painel de
localização permite selecionar país, estado, cidade, bairro, rua e local
exato, com autocomplete, dependências entre níveis e limpeza de descendentes.
Coordenadas digitadas pelo usuário são identificadas como tal; sua relação com
os níveis anteriores não é verificada.

Os destaques no MapLibre utilizam GeoJSON e camadas de preenchimento, contorno,
linhas e pontos. Países e estados usam limites locais simplificados do Natural
Earth. Municípios brasileiros são identificados por código e UF no catálogo
IBGE; suas malhas simplificadas são obtidas sob demanda. Para o município de
Recife (IBGE 2611606), o aplicativo pode obter limites oficiais de bairros e
geometrias de vias da Prefeitura do Recife, com associação por código ao
bairro selecionado. A geometria da via representa a via completa e pode
atravessar outros bairros. Fora dessa cobertura, a seleção é preservada e a
ausência de geometria é indicada. Fontes, licenças e limitações estão em
`src/renderer/assets/map/MAP_DATA_LICENSE.md`.

Os destaques usam a accent color escolhida pelo usuário e são mantidos na
troca de estilo. A seleção permanece ao alternar para Google Maps ou Street
View, mas os overlays do ZeroHub são renderizados somente no MapLibre. A
localização pode ser salva explicitamente no case ativo, restaurada sem
duplicar atividades e reutilizada para criar marcador. O zoom automático é
opcional; a restauração recupera as geometrias disponíveis sob demanda.

As consultas usam debounce, cancelamento e caches com prazo de até 24 horas.
O primeiro carregamento da base de vias do Recife pode baixar cerca de 14 MB;
os dados públicos de vias também são guardados em cache comprimido na pasta
de dados do aplicativo, sem gravar geometrias nos cases. A seleção e o cache
não eliminam a necessidade de rede para as consultas oficiais não armazenadas.

Foram exercitados no Electron Linux o fluxo de Recife com os seis níveis,
restauração de case e zoom, estilos cartográficos e alternância de provedores
sem chave Google. A visualização de conteúdo Google com chave válida e um
perfilamento prolongado de memória permanecem sem validação. Os documentos
`ZeroHub_Auditoria_HUD_GeoSelecao.md` e `ZeroHub_Plano_Integracao_Mapas.md`
preservam especificações e propostas históricas, não o estado corrente.

## 17. Visual Excellence e workspace cartográfico

Na branch `feat/visual-polish-aftergeo`, o HUD mantém a estrutura Grid/Flex
existente e usa superfícies e estados de interação compartilhados, com a cor
de destaque configurada pelo usuário. O gerenciador de camadas oferece busca,
categorias, contagens, visibilidade e legenda; seleção geográfica e GeoJSON
importado também permitem ajustar opacidade, ordem relativa e enquadramento
quando seus dados possuem limites. Esses ajustes visuais são da sessão e não
alteram os dados originais.

O inspector apresenta dados disponíveis do marcador ou localização, fonte,
precisão e coordenadas, com cópia por ação explícita. A barra inferior mostra
o centro do ZeroHub e, no MapLibre, coordenadas do cursor em DD ou DMS, com
cópia da última posição e precisão original. As vistas Google têm câmera
independente e não exibem coordenadas do cursor simuladas. A escala métrica
nativa do MapLibre acompanha a câmera; os três estilos preservam seus dados e
atribuições existentes. Fontes e camadas importadas e de seleção podem ser
restauradas quando o estilo MapLibre é substituído.

## 18. GEOINT Signal Lab

O botão GEO abre o Signal Lab no mapa existente. O módulo aceita de três a
oito estações para trilateração por distâncias ou triangulação por azimutes,
com incerteza 1σ informada para cada medição. Estações A–H são selecionáveis
no mapa e nos cards; coordenadas e medições podem ser editadas explicitamente.
O painel mostra validação, resíduos, consistência, resultado, região de
incerteza e aviso de região ampla; também permite enquadrar as estações.
Medições permanecem somente na memória da sessão e não alteram cases.

Os cálculos usam geodésia esférica e ajuste local ponderado. A região aproximada
de 95% depende das incertezas informadas, da aproximação linear e das hipóteses
de erros independentes normais; não comprova uma posição. O MVP limita o alcance
local a 100 km e as latitudes a 85°; geometrias que cruzam o antimeridiano são
omitidas do desenho com aviso. O modo demonstrativo usa dados sintéticos e
revela as geometrias progressivamente, respeitando movimento reduzido. As
hipóteses e limitações estão em `src/renderer/components/workspace/signal-lab/README.md`.

Foram exercitados no Electron com perfil temporário os dois métodos, seleção e
edição de estação, pausa e reinício, remoção e recriação de camadas, troca de
estilos e layouts de 1920×1080 e 1280×720. Os testes com perfil temporário sem
chave não demonstram o estado ou o funcionamento da chave no perfil habitual.

## 19. Intelligence Layers v1

Na branch `feat/intelligence-layers`, o workspace contém o painel Intelligence
Layers para consultar pontos públicos do OpenStreetMap dentro da menor região
hierárquica selecionada que possua geometria. O painel oferece categorias de
saúde, educação, transporte e infraestrutura/serviços, busca por nome,
contagens reais, estado de carregamento, filtros e atribuição ODbL. O resultado
é renderizado na instância MapLibre existente com fonte GeoJSON, clustering,
seleção, inspector, criação explícita de marcador e registro confirmado no case
ativo sem duplicar a atividade do mesmo identificador OSM.

O processo principal usa o provider modular Overpass com endpoint fixo da
Private.coffee, IPC autenticado e validações de entrada. As consultas enviam
somente a caixa envolvente e categorias permitidas; o renderer filtra os pontos
pela geometria Polygon/MultiPolygon selecionada, incluindo buracos. Há uma
consulta por vez, cancelamento, timeout, cache em memória de 30 minutos,
limites de área, volume e objetos, intervalo mínimo e espera progressiva para
timeout, falha de conexão ou HTTP 5xx. HTTP 429/406 respeita `Retry-After` e
impõe espera mínima. Para ways e relations, o centro retornado pelo Overpass é
explicitamente indicado como aproximado; não há alegação de interseção exata
da geometria completa. Registros com `access=private` ou `access=no` são
descartados e as tags expostas são restritas.

O funcionamento visual, a limpeza das camadas e listeners, o clustering, os
filtros, o inspector, a criação de marcador, o registro em case fictício e a
restauração após troca de estilo foram exercitados no Electron com dados
sintéticos claramente identificados. A validação com pontos reais de Recife
permanece pendente: DNS e TLS da Private.coffee responderam, mas uma consulta
pequena expirou sem resposta HTTP; a consulta equivalente na `overpass-api.de`
retornou HTTP 502 por capacidade esgotada. A segunda instância não foi adotada
como fallback devido à política de uso de suas instâncias públicas. A cobertura
OSM não é completa, e uso frequente ou de grande escala requer extratos locais
ou infraestrutura própria. As limitações e atribuições constam em
`src/renderer/components/workspace/intelligence-layers/README.md`.
