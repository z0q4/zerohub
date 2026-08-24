# Roadmap de estabilização e evolução do ZeroHub

Este documento acompanha o trabalho iniciado na branch
`feat/ip-geolocation-intelligence`. Ele não substitui
`CONTEXTO_MESTRE_ZEROHUB.md` e deve ser revisado ao final de cada etapa.

## Regras permanentes

- Preservar Electron, React, TypeScript, MapLibre GL e o backend Python.
- Manter `contextIsolation`, `sandbox`, preload e IPC validado.
- Não colocar senhas, tokens ou chaves no renderer, Git ou `localStorage`.
- Não usar scraping nem fontes cartográficas/câmeras sem termos compatíveis.
- Validar cada etapa com TypeScript, ESLint, testes aplicáveis e
  `git diff --check`; ao final, executar `scripts/verify.sh`.

## Fila de implementação

### 1. Acesso local e bloqueio — implementado e validado

- [x] Cadastro local no primeiro uso, sem credencial padrão no código.
- [x] Login obrigatório em cada abertura do aplicativo.
- [x] Senha principal separada da senha curta de desbloqueio da sessão.
- [x] Login inicial por campos, sem listar as contas autorizadas.
- [x] F1 bloqueia somente a janela ativa do ZeroHub.
- [x] Conteúdo fica inacessível e visualmente desfocado enquanto bloqueado.
- [x] Limitação progressiva de tentativas e comparação segura da senha.
- [x] Senha protegida exclusivamente no processo principal.
- [x] Aplicar autorização central a todos os IPCs sensíveis enquanto bloqueado.
- [x] Provisionar as contas case-sensitive `z0x4` e `kona67`.
- [x] Bloquear após 3 minutos e 33 segundos sem atividade.
- [x] Bloquear e permanecer na bandeja ao minimizar ou fechar.
- [x] Fluxos de teclado, foco, semântica para leitor de tela e redução de
  movimento. O fluxo F1 completo foi validado em perfil Electron descartável;
  uma inspeção em leitor de tela nativo ainda é recomendada como auditoria
  externa, mas não há bloqueio funcional conhecido.
- [x] Testes de validação e fluxo Electron de cadastro, login e bloqueio.
- [x] Testes automatizados de rate limit e respostas IPC hostis. Além dos
  testes puros, o smoke Electron confirma rejeição de payload inválido,
  bloqueio após tentativas repetidas e desbloqueio após a espera.
- [x] Exibir a arte ASCII autorizada da Doxbin no cadastro e no bloqueio.

Observação: este bloqueio protege a sessão da interface. Ele não equivale a
criptografia dos arquivos de casos já armazenados em disco.

### 2. Busca geográfica e geocodificação reversa — concluída no escopo atual

- [x] Sugestões, histórico, favoritos, coordenadas e busca na viewport.
- [x] Resultado selecionado no mapa e consulta reversa básica.
- [x] Estados offline, limites do provider e acessibilidade. A busca evita a
  chamada externa quando offline, informa a conectividade, destaca
  correspondências, limita sugestões e mantém foco/teclado no diálogo.
- [x] Persistir preferências sem registrar consultas sensíveis por padrão.

### 3. Ferramentas cartográficas — concluídas no escopo autorizado

- [x] Medidas básicas, importação GeoJSON, comparação e gerenciador de camadas.
- [x] Área/polígono, edição de vértices, desfazer último ponto e limpeza
  previsível.
- [x] Exportação seletiva GeoJSON e CSV de pontos, copiar/download e salvamento
  da medição ou importação como atividade do caso ativo.
- [x] Montagem, desmontagem e isolamento por caso preservados pela estrutura
  existente; o smoke Electron não encontrou source/layer duplicado.

### 4. Timeline e produtividade — parcialmente concluída

- [x] Timeline geográfica, marcadores e persistência por caso.
- [x] Integrar medições/importações à atividade do caso quando solicitado.
- [x] Modo Mapa Limpo com `Shift+F2`, restauração por `Shift+F2` ou `Escape`,
  estado transitório e preservação das interações do mapa.
- [ ] Ampliar atalhos documentados e operações em lote reversíveis. O desfazer
  da medição está concluído; lote permanece uma melhoria futura, não um bloqueio.

### 5. Privacidade, acessibilidade e desempenho — estabilizada

- [x] Configurações claras de histórico, cache e limpeza de sessão.
- [ ] Auditoria final com leitor de tela nativo. Teclado, focus-visible,
  aria-live, dialog/modal e alternativas em painel foram validados.
- [x] Profiling MapLibre executado no Electron de desenvolvimento, sem ocultar
  avisos; os números são diagnósticos e não equivalem a um build empacotado.
- [x] Camadas alteradas verificadas contra listeners, RAFs e sources
  duplicados. A animação dos arcos de IP pausa com a janela oculta e cancela
  RAF/listener no cleanup.

### 6. Câmeras públicas — provider selecionado, aguardando credencial

- [x] Escolher região e provider com termos compatíveis.
- [ ] Obter credencial do usuário quando exigida, sem salvá-la no renderer.
- [ ] Distinguir câmera ao vivo de imagens históricas de rua.
- [ ] Criar source/layer, painel, estado offline e atribuição obrigatória.

Provider selecionado: Windy Webcams API v3, no plano gratuito. A API exige
chave no header `x-windy-api-key`; as URLs de imagem do plano gratuito são
temporárias e precisam ser renovadas. O catálogo aberto da CTTU informa a
localização de equipamentos, mas não documenta feeds públicos de vídeo. Ele
não será tratado como fonte de transmissão, e nenhum stream operacional será
obtido por scraping. Mapillary fornece imagens históricas de rua, não CCTV ao
vivo, e não atende ao requisito principal.

Escopo escolhido: Brasil, Pernambuco, Recife e Jaboatão dos Guararapes;
priorizar fontes ao vivo gratuitas de trânsito, turismo, clima e segurança,
aceitando imagens periódicas como fallback.

### 7. Layouts do mapa — implementado e validado

- [x] Abstração de estilo que preserve camadas operacionais.
- [x] Layout ZeroHub Tactical.
- [x] Layout Streets Dark.
- [x] Layout Streets Light.
- [x] Alternância sem recriar o mapa nem perder seleção/caso/timeline.
- [x] Natural Earth e OpenFreeMap permanecem como fallback.
- [x] Atribuição, contraste, zoom real, falha de tiles, fallback e retry
  validados em Electron/CDP sem recriar o canvas MapLibre.

O estado do provider detalhado distingue carregamento, disponibilidade,
fallback e indisponibilidade, mantendo atribuição e retry. OpenFreeMap declara
`maxzoom` 14 no TileJSON atual; o zoom de câmera acima disso é overzoom e não
resolução adicional do source.

## Checkpoint 2026-08-24

- [x] Backup externo completo e verificado antes das edições desta execução.
- [x] Login minimalista confirmado no Electron real sem preencher credenciais.
- [x] Ordem de teclado do login confirmada: Login → Password → START → Login.
- [x] Console do renderer inspecionado; sem exceção ou Promise rejeitada.
- [x] Aviso de CSP confirmado como exclusivo do Vite em desenvolvimento; a
  aplicação empacotada aplica CSP própria sem `unsafe-eval`.
- [x] Histórico geográfico passou a ser opt-in.
- [x] Busca offline, realce das sugestões e foco modal implementados.
- [x] Rate limit extraído para cálculo puro e coberto por teste determinístico.
- [x] Validação final: TypeScript, ESLint, auth, geo, IP, sessão, Python e
  `scripts/verify.sh` passaram.
- [x] Fluxos internos foram exercitados em perfil descartável, com duas contas
  e senhas fictícias geradas apenas em memória, sem tocar nas credenciais reais.

## Checkpoint ampliado 2026-08-24

- [x] Segundo backup externo completo e verificado antes da retomada.
- [x] Cinco marcadores CTRL+clique validados com tolerância máxima de
  0,0003 px entre o centro DOM e a projeção aplicada pelo MapLibre.
- [x] Escala monotônica validada: 0,597 afastado, 0,613 inicial e 0,658
  aproximado no cenário limpo.
- [x] Tactical, Streets Dark e Streets Light mantiveram um único canvas.
- [x] OpenFreeMap bloqueado no teste produziu fallback Natural Earth; retry
  após restaurar a rede retornou ao estado disponível.
- [x] F1 exibiu somente logo, ZeroHub, Password e START, sem partículas, com
  conteúdo protegido inerte.
- [x] “Meu IP público” confirmou dual-stack real sem registrar os endereços:
  IPv4 e IPv6 separados, filtros 2/1/1 e rejeição de IP privado.
- [x] Área/polígono, edição de vértices, exportação seletiva e salvar em caso
  foram incorporados sem dependência nova.
- [x] HUD deixou de abrir sobre o cartão inicial e o texto auxiliar do seletor
  de layout voltou a ficar corretamente oculto visualmente.

Os layouts podem se inspirar na ergonomia de mapas modernos, mas não devem
copiar marca, assets ou serviços do Google sem licença, chave e billing.

## Dependências aguardando o usuário

1. Para câmeras: eventual conta/chave gratuita do provider selecionado.
2. Aprovação separada antes de qualquer serviço com token; cobrança não foi
   autorizada.

## Estimativa revisada

- GPT-5.6 Sol Medium: aproximadamente 70–110 horas de trabalho verificável.
- GPT-5.6 Sol High: aproximadamente 60–95 horas, recomendado para segurança,
  IPC, migrações de estado e integrações externas.

As estimativas variam conforme provider de câmeras, credenciais, cobertura de
testes manuais e falhas descobertas no Electron real. Medium continua adequado
para CSS, documentação e alterações mecânicas já bem especificadas.

## Checkup final de cada etapa

- [x] Alterações preexistentes preservadas.
- [x] Causa e escopo documentados.
- [x] Fluxo real reproduzido no Electron.
- [x] Console do renderer e logs do main inspecionados.
- [x] `npm run check`.
- [x] `npm run lint`.
- [x] Testes aplicáveis.
- [x] Testes Python sem alteração do código Python.
- [x] `git diff --check`.
- [x] Estado e diff final registrados no contexto da branch e na entrega.
