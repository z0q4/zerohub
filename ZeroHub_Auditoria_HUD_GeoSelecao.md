# ZeroHub --- Auditoria, redesign do HUD e seleção geográfica hierárquica

> Documento histórico de especificação: preserva as instruções originais e
> pode conter propostas ou cores que foram posteriormente ajustadas. Para o
> estado implementado nesta branch, consulte `CONTEXTO_MESTRE_ZEROHUB.md`.

**Tipo:** especificação de implementação para Codex\
**Repositório:** `z0q4/zerohub`\
**Branch esperada:** `feat/map-providers-google-embed`\
**Escopo:** auditoria da integração multi-provider já implementada,
correção estrutural do HUD/workspace cartográfico e implementação de
seleção geográfica hierárquica com destaque no mapa/globo.

------------------------------------------------------------------------

# PROMPT PRINCIPAL PARA O CODEX

Quero continuar a evolução real do ZeroHub. O Google Maps Embed e o
Street View 360° já foram integrados e **foram visualmente confirmados
funcionando no Electron**. A captura de tela anexada ao pedido mostra o
Street View carregado corretamente em uma localização real.

Agora precisamos fazer três trabalhos relacionados:

1.  Auditar funcionalmente e em segurança a implementação multi-provider
    existente.
2.  Corrigir e redesenhar estruturalmente o HUD/front-end do workspace
    cartográfico, que está com elementos sobrepostos e hierarquia visual
    ruim.
3.  Criar um painel de seleção geográfica hierárquica --- país, estado,
    cidade, bairro, rua e local exato --- que destaque progressivamente
    as geometrias selecionadas no globo/mapa, usando a cor de destaque
    azul/ciano já existente no tema do ZeroHub.

**Não quero somente recomendações, mockups ou documentação. Quero
implementação real, integrada ao código existente, testada e sem
regressões.**

## 0. Regras de segurança e preservação do repositório

Antes de editar:

1.  Confirme `pwd`, `git status --short --branch`, branch atual,
    `git rev-parse HEAD`, `git rev-parse origin/main` e
    `git rev-list --left-right --count HEAD...origin/main`.
2.  A branch esperada é `feat/map-providers-google-embed`. Continue nela
    se estiver correta.
3.  Se estiver em outra branch, não troque automaticamente se houver
    alterações locais. Informe o estado e preserve tudo.
4.  Não execute `git reset`, `git clean`, `checkout --`, `restore`,
    rebase destrutivo ou qualquer comando que descarte alterações.
5.  Preserve arquivos não rastreados do usuário, especialmente
    `ZeroHub_Plano_Integracao_Mapas.md`.
6.  Não faça commit, push, merge ou alteração em `main` sem autorização
    explícita.
7.  Leia `AGENTS.md`, `CONTEXTO_MESTRE_ZEROHUB.md`, `ROADMAP_ZEROHUB.md`
    e `ZeroHub_Plano_Integracao_Mapas.md`, se estiverem presentes.
8.  Inspecione o código real antes de decidir onde alterar. Os nomes de
    arquivos citados nesta especificação são pistas, não substituem a
    inspeção.
9.  Não sobrescreva alterações preexistentes. Se houver conflito entre a
    implementação atual e esta especificação, explique a diferença e
    preserve a arquitetura funcional.
10. Não solicite nem imprima chaves API, senhas, tokens ou credenciais.

Faça uma linha de base dos testes antes das mudanças e registre os
resultados.

------------------------------------------------------------------------

# PARTE A --- AUDITORIA FUNCIONAL E DE SEGURANÇA

## 1. Auditoria dos provedores

Audite a implementação atual de:

-   OpenFreeMap / MapLibre.
-   Google Maps Embed 2D.
-   Google Street View 360°.
-   Seletor de provedores.
-   Persistência da câmera, coordenadas e estado de workspace/case.
-   Configuração, armazenamento, rotação e remoção da chave Google.
-   IPC entre renderer, preload e main.
-   Content Security Policy (CSP).
-   Estados de loading, erro, timeout, retry e ausência de chave.

### Testes funcionais obrigatórios

Verifique no Electron real, se houver ambiente gráfico:

1.  OpenFreeMap → Google Maps → Street View → OpenFreeMap.
2.  Faça a alternância pelo menos 10 vezes e observe listeners, iframes,
    timers e memória.
3.  Selecione uma coordenada, alterne os provedores e confirme que a
    localização selecionada permanece coerente.
4.  Teste coordenadas negativas, casas decimais, limites de
    latitude/longitude e entradas inválidas.
5.  Teste sem chave configurada.
6.  Teste chave inválida/restrita, indisponibilidade de rede, timeout e
    retry.
7.  Teste a remoção e a substituição da chave.
8.  Confirme que o estado de cases, timeline, marcadores, camadas e
    ferramentas não é apagado ao alternar o provedor.
9.  Verifique se desmontar/remontar o Google iframe cria recursos
    duplicados.
10. Inspecione o console do Electron e logs sem expor credenciais.

### Limitações de observabilidade

Um iframe cross-origin do Google não permite que o renderer leia
livremente o conteúdo interno. Não tente contornar a política de mesma
origem. O evento `load` não prova, por si só, que o mapa foi carregado
sem erro. Não apresente um erro de chave, cota ou cobertura como
detectado com certeza se a API não fornecer um sinal confiável.

Se não for tecnicamente possível distinguir determinados erros do
iframe, mostre uma mensagem honesta e uma ação de retry/abrir no Google
Maps, em vez de inventar um diagnóstico.

## 2. Auditoria da chave Google

Verifique especialmente este ponto:

-   `safeStorage` protege a chave em repouso no computador.
-   Para montar o `src` do iframe da Maps Embed API, a chave precisa ser
    enviada ao Google e fica visível na URL/requisição do iframe para o
    próprio cliente local.
-   Portanto, **não prometa que a chave é secreta contra o próprio
    usuário ou contra alguém com acesso ao processo/DevTools**.
-   Não registre a URL completa do iframe, a chave, parâmetros sensíveis
    ou respostas contendo credenciais em logs.
-   Não coloque a chave em `settings.json`, `localStorage`,
    `sessionStorage`, arquivos versionados, testes, snapshots ou
    mensagens de erro.
-   Restrinja a chave no Google Cloud exclusivamente à Maps Embed API.
-   Avalie as restrições de origem/referer no Electron real. Não presuma
    que uma política de HTTP referrer funciona com `file://` ou com um
    protocolo customizado sem validar.
-   Não crie proxy próprio apenas para fingir esconder uma chave que
    precisa ser usada pelo Google. Não adicione APIs faturáveis.
-   Preserve `contextIsolation`, `nodeIntegration: false`, `webSecurity`
    e as demais proteções existentes.
-   Mantenha a CSP limitada aos domínios estritamente necessários. Não
    use `*` em `frame-src`, `connect-src` ou `script-src`.
-   Bloqueie popups/navegação externa não autorizada e abra links
    externos por um fluxo explícito e validado.

A integração Google atual usa Maps Embed. Não migre para Maps JavaScript
API, Maps Tiles API ou outro produto faturável sem autorização
explícita.

## 3. Auditoria de ciclo de vida e desempenho

Verifique:

-   `useEffect` com cleanup completo.
-   `AbortController` para consultas canceláveis.
-   Timers e `requestAnimationFrame` cancelados ao desmontar.
-   Event listeners removidos com a mesma referência usada no registro.
-   `map.on` / `map.off` e criação/remoção de fontes e camadas.
-   Evitar recriar mapa/iframe em renders sem necessidade.
-   Evitar duas instâncias MapLibre ativas simultaneamente.
-   Não manter o mapa ativo e interativo por trás do Google Embed se
    isso gerar custo de CPU/GPU ou eventos duplicados.
-   Não destruir estado de câmera/case apenas para ocultar uma camada.
-   Não armazenar geometrias grandes desnecessariamente no estado React.
-   Cache e cancelamento de geocodificação/limites administrativos.

Corrija somente problemas reproduzíveis ou claramente demonstrados. Não
faça refatoração ampla sem benefício técnico verificável.

------------------------------------------------------------------------

# PARTE B --- REDESIGN ESTRUTURAL DO HUD / FRONT-END

## 4. Problemas visuais identificados na captura

Use a captura anexada pelo usuário como referência visual. Se ela não
estiver disponível no contexto do Codex, considere esta descrição:

-   O painel de boas-vindas "ZeroHub" fica flutuando sobre o mapa e
    cobre conteúdo útil.
-   O painel de coordenadas e informações geográficas fica parcialmente
    encoberto pelo HUD.
-   Busca global e seletor de provedor disputam a mesma região superior.
-   Botões de case, módulos, configurações e perfil parecem soltos no
    topo.
-   A barra lateral é estreita, com abreviações difíceis de interpretar.
-   Os controles do mapa e os controles nativos do Google podem competir
    pelo mesmo espaço.
-   A barra inferior OSINT/ATTACK e a atribuição do provedor disputam
    espaço.
-   Os elementos parecem posicionados como overlays independentes, sem
    uma estrutura de layout consistente.
-   O mapa deveria ser o foco, mas há cartões flutuantes e controles sem
    hierarquia clara.

**Não resolva isso apenas aumentando `z-index`, adicionando margens
aleatórias ou escondendo elementos.** Corrija a estrutura de layout e a
responsabilidade de cada região.

## 5. Direção visual

Quero uma interface com aparência de estação de trabalho
geoespacial/OSINT profissional:

-   Dark UI, limpa, técnica e minimalista.
-   Preservar a identidade visual, o tema escuro e o acento azul/ciano
    já usados pelo ZeroHub.
-   Não transformar o aplicativo em um dashboard genérico.
-   Não remover funcionalidades existentes só para simplificar a tela.
-   Priorizar legibilidade, densidade de informação controlada e uso
    eficiente da área do mapa.
-   Evitar cartões grandes de boas-vindas permanentes sobre o mapa.
-   Usar ícones consistentes, tooltips e rótulos compreensíveis.
-   Preservar acessibilidade: foco visível, navegação por teclado,
    aria-labels e contraste.

## 6. Estrutura de layout desejada

Adapte a estrutura ao código existente, mas busque uma composição
semelhante a esta:

``` text
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: marca | busca global | provedor/modo | case | módulos | perfil  │
├──────┬──────────────────────┬──────────────────────────────┬─────────────┤
│      │                      │                              │             │
│ NAV  │ PAINEL CONTEXTUAL    │                              │ FERRAMENTAS │
│ RAIL │                      │          MAPA / GLOBO         │ DO MAPA     │
│      │ Localização          │                              │             │
│      │ Camadas              │                              │             │
│      │ Marcadores           │                              │             │
│      │ Investigação         │                              │             │
│      │                      │                              │             │
├──────┴──────────────────────┴──────────────────────────────┴─────────────┤
│ STATUS / COORDENADAS / PROVIDER / ATTRIBUTION / OSINT-ATTACK             │
└──────────────────────────────────────────────────────────────────────────┘
```

### Regras de layout

1.  Topbar com altura estável e áreas claramente separadas.
2.  Busca global em região própria, sem sobrepor o seletor de provedor.
3.  Seletor OpenFreeMap / Google Maps / Street View em controle próprio,
    visualmente associado ao mapa.
4.  Barra lateral de navegação com grupos claros e tooltips. Se
    possível, permitir expandir/recolher.
5.  Painel contextual encaixado no layout, não solto sobre o mapa. Ele
    pode ter abas:
    -   Localização
    -   Camadas
    -   Marcadores
    -   Investigação
6.  Área central do mapa deve ocupar todo o espaço restante.
7.  Ferramentas de mapa ficam em um dock lateral direito, com grupos e
    espaçamento consistentes.
8.  Barra inferior deve separar status, coordenadas, modo OSINT/ATTACK e
    atribuição do provedor.
9.  O painel inicial/welcome deve ser removível, recolhível ou
    substituído por um estado vazio discreto. Não deve cobrir o mapa por
    padrão.
10. Não sobreponha controles próprios ao Street View quando eles
    competirem com controles nativos do Google.
11. No modo Google Embed, deixe o iframe e a atribuição do Google
    utilizarem sua própria área. Não desenhe botões do ZeroHub em cima
    de controles nativos do Google.
12. Use CSS Grid/Flexbox e áreas de layout. Evite posicionamento
    absoluto para os principais painéis.
13. Overlays sobre o mapa devem ser poucos, intencionais e ancorados em
    regiões definidas.
14. Use tokens de espaçamento, cores, bordas, raios, sombras e z-index.
    Não espalhe valores arbitrários por dezenas de seletores.
15. Em telas menores, recolha automaticamente o painel contextual e
    reduza docks, sem deixar controles inacessíveis.

### Dimensões de validação visual

Teste, no mínimo, os tamanhos:

-   1920 × 1080.
-   1648 × 920 (aproximadamente a captura atual).
-   1366 × 768.
-   1280 × 720.
-   Uma largura menor, se o aplicativo suportar.

Em cada tamanho, confirme:

-   Nenhum elemento interativo encoberto.
-   Nenhum texto cortado.
-   Busca, seletor, case e módulos não se sobrepõem.
-   O painel de localização não cobre os campos.
-   O mapa permanece utilizável.
-   A atribuição do provedor permanece visível.
-   No Google Street View, os controles nativos continuam acessíveis.

Se houver ferramenta de screenshot/E2E já instalada, use-a. Não adicione
uma dependência grande apenas para tirar screenshots sem justificar.

## 7. Painel de localização hierárquica

Crie uma seção chamada **Localização** no painel contextual.

Ela deve permitir preencher e selecionar estes níveis:

1.  País.
2.  Estado / província / região administrativa.
3.  Cidade / município.
4.  Bairro / distrito / subdivisão local.
5.  Rua / via.
6.  Local exato.

Cada campo deve possuir:

-   Autocomplete com resultados reais.
-   Nome legível e, quando possível, nome oficial.
-   Código/identificador geográfico quando existir.
-   Estado de carregamento.
-   Estado sem resultados.
-   Mensagem de erro/rede.
-   Ação para limpar o campo.
-   Navegação por teclado.
-   Indicação visual de item selecionado.
-   Origem dos dados e grau de precisão quando relevante.

### Comportamento hierárquico

-   Cada campo depende dos níveis anteriores.
-   Ao selecionar um país, carregue opções compatíveis de estados.
-   Ao selecionar um estado, restrinja cidades a esse estado.
-   Ao selecionar uma cidade, restrinja bairros.
-   Ao selecionar um bairro, restrinja ruas.
-   A rua pode oferecer número, cruzamento ou ponto de interesse como
    refinamento.
-   O local exato pode ser um endereço, coordenada digitada ou ponto
    selecionado diretamente no mapa.
-   Quando um campo pai mudar, limpe os campos filhos incompatíveis. Não
    deixe cidade/bairro/rua antigos associados a outro país/estado.
-   Permita selecionar apenas níveis parciais. País sem estado, cidade
    sem bairro etc. são estados válidos.
-   Exiba a hierarquia selecionada como breadcrumb, por exemplo:
    `Brasil > Pernambuco > Recife > Boa Viagem > Avenida Boa Viagem > 1234`.
-   Permita clicar em um nível do breadcrumb para voltar/editar aquele
    nível.
-   Adicione uma ação "Limpar localização".
-   Adicione uma ação "Aproximar seleção" ou um toggle "Aproximar
    automaticamente".
-   Evite que a seleção de um campo provoque vários zooms conflitantes
    durante o preenchimento.

### Pesquisa e geocodificação

Antes de adicionar um serviço novo, inspecione o serviço de
busca/geocodificação já existente no ZeroHub e reutilize-o quando
possível.

Crie interfaces independentes, por exemplo:

-   `GeocodingProvider`
-   `AdministrativeBoundaryProvider`
-   `LocationSelection`
-   `SelectedGeographicFeature`

A nomenclatura pode seguir os padrões reais do projeto.

Não acople a UI diretamente a um único serviço externo.

Não presuma que todo país usa a mesma divisão administrativa. Os níveis
administrativos variam de país para país. Um nível `ADM2`, por exemplo,
não significa necessariamente "cidade" em todos os países.

Quando houver lacunas nos dados:

-   Não invente resultados.
-   Não desenhe polígonos aproximados como se fossem limites oficiais.
-   Mostre "geometria indisponível para este nível".
-   Mantenha o nome/localização selecionado.
-   Permita continuar para o próximo nível, se os dados permitirem.
-   Informe a fonte, data/versão e licença dos limites usados.

### Fontes de dados e licenciamento

Priorize fontes já presentes no projeto.

Se precisar adicionar fontes:

1.  Para limites administrativos globais, avalie `geoBoundaries`
    (release `gbOpen`), verificando metadados, nível, ano, fonte e
    licença de cada geometria. A coleção `gbOpen` informa licença CC BY
    4.0 e exige atribuição.
2.  Para nomes de locais, endereços e ruas, avalie o geocoder já usado
    pelo projeto e, se apropriado, Nominatim/OSM.
3.  Para vias, use geometrias LineString/MultiLineString reais quando
    disponíveis.
4.  Não trate Nominatim público como serviço irrestrito para alto
    volume. Respeite a política de uso, limite de taxa, identificação do
    cliente e cache. Se o projeto não puder cumprir a política, use um
    provider configurável ou uma instância/serviço apropriado.
5.  Para dados OSM, preserve a atribuição e os requisitos da licença
    ODbL.
6.  Não introduza APIs pagas, chaves novas ou faturamento sem aprovação
    explícita.
7.  Registre a origem e licença dos dados em uma área de
    atribuição/"Sobre os dados".

Implemente cache com limites e TTL apropriados. Use debounce,
cancelamento de requisições antigas e tratamento de rate limit. Não
dispare uma requisição a cada tecla sem controle.

------------------------------------------------------------------------

# PARTE C --- DESTAQUE GEOGRÁFICO NO MAPA E NO GLOBO

## 8. Visualização do destaque

Esta é uma funcionalidade central.

Sempre que um nível for selecionado, o mapa/globo deve destacar a
geometria correspondente usando o azul/ciano já existente no tema do
ZeroHub.

O objetivo visual é:

-   Contorno externo nítido e luminoso.
-   Preenchimento interno translúcido.
-   Níveis filhos com tonalidade/opacidade ligeiramente diferente.
-   Hierarquia visual clara sem esconder ruas, rótulos ou marcadores.
-   O destaque deve parecer parte nativa do mapa, não um polígono
    genérico jogado sobre ele.

### Semântica por tipo de geometria

Não force todos os níveis a serem polígonos:

  -----------------------------------------------------------------------
  Nível                   Geometria esperada      Visualização
  ----------------------- ----------------------- -----------------------
  País                    Polygon / MultiPolygon  Preenchimento
                                                  translúcido + contorno

  Estado / região         Polygon / MultiPolygon  Preenchimento próprio +
                                                  contorno

  Cidade / município      Polygon / MultiPolygon, Preenchimento +
                          se disponível           contorno

  Bairro / distrito       Polygon / MultiPolygon, Preenchimento +
                          se disponível           contorno

  Rua                     LineString /            Linha azul/ciano com
                          MultiLineString         casing/halo

  Local exato             Point; polígono de      Marcador com halo/ring;
                          edifício somente se a   opcionalmente contorno
                          fonte trouxer geometria real do edifício
                          real
  -----------------------------------------------------------------------

### Estilo visual

-   Use o token de accent/primary já existente no tema.
-   Não invente uma segunda identidade de cor.
-   Use variações de opacidade e luminosidade do azul/ciano atual.
-   Contorno externo mais forte que o preenchimento.
-   Para ruas, use uma linha externa escura mais larga e uma linha
    interna azul/ciano mais estreita para contraste.
-   Para o local exato, use marcador com halo e foco visual claro.
-   Se vários níveis estiverem selecionados, preserve os contornos dos
    pais e destaque o filho com maior intensidade.
-   Não deixe o preenchimento ocultar os dados cartográficos.
-   Adicione uma legenda compacta dos níveis selecionados, se isso
    melhorar a leitura.

Os valores exatos devem ser derivados dos tokens do tema existente, e
não espalhados como hexadecimais hardcoded.

### Atualização incremental

-   Use uma fonte GeoJSON própria para os destaques.
-   Atualize os dados com `GeoJSONSource.setData()` quando a seleção
    mudar, se compatível com a implementação atual.
-   Crie layers de fill, line e point separados ou uma arquitetura
    equivalente.
-   Garanta IDs estáveis para fontes/layers.
-   Registre fontes/layers de forma idempotente.
-   Adicione/recrie layers após `style.load` ou troca de basemap, porque
    a troca de estilo pode remover fontes/layers adicionados pela
    aplicação.
-   Não crie fontes/layers duplicados.
-   Remova listeners e recursos quando necessário.
-   Trate MultiPolygon, geometria inválida, antimeridiano e limites do
    globo.
-   Mantenha os dados de seleção separados da instância MapLibre para
    que a seleção sobreviva à troca de estilo/provedor.

### Zoom e câmera

-   Ao selecionar um país/estado/cidade/bairro, ofereça ajuste de câmera
    para os bounds da geometria.
-   Ao selecionar rua, ajuste para os bounds da linha com padding.
-   Ao selecionar local exato, use zoom apropriado sem exagerar.
-   Use animação curta e respeite `prefers-reduced-motion`.
-   Não faça a câmera saltar a cada atualização de autocomplete. Só
    aproxime após seleção confirmada.
-   Permita desativar "Aproximar automaticamente".
-   Ao limpar a seleção, não resete a câmera arbitrariamente.

## 9. Compatibilidade com os provedores Google

**Limitação fundamental:** a implementação atual usa Google Maps Embed
em iframe. Não presuma que é possível desenhar camadas GeoJSON
customizadas, polígonos, contornos ou marcadores próprios dentro desse
iframe.

Portanto:

-   Os destaques GeoJSON são renderizados no MapLibre/OpenFreeMap,
    inclusive no globo, quando suportado.
-   No modo Google Maps Embed e Street View, preserve a seleção
    hierárquica e as coordenadas na interface, mas não desenhe overlays
    próprios por cima do conteúdo Google.
-   Não misture visualmente uma camada MapLibre sobre Google Maps/Street
    View.
-   Ofereça uma ação clara: "Ver destaque no mapa ZeroHub" ou "Abrir no
    OpenFreeMap".
-   Ao voltar para MapLibre, restaure a seleção e renderize os
    destaques.
-   Se futuramente for desejado overlay customizado sobre mapa Google,
    isso exige avaliar outro produto Google e seus termos/custos. Não
    implemente isso agora.

------------------------------------------------------------------------

# PARTE D --- PERSISTÊNCIA E INTEGRAÇÃO COM INVESTIGAÇÕES

## 10. Estado da seleção

Integre a seleção geográfica ao modelo de estado já existente.

-   Se houver case ativo, a localização selecionada deve poder ser
    associada ao case.
-   Sem case ativo, mantenha a seleção no workspace atual, conforme o
    padrão existente.
-   Não duplique estado em múltiplos componentes sem necessidade.
-   Preserve a seleção ao alternar MapLibre/Google/Street View.
-   Preserve a seleção ao trocar Tactical / Streets Dark / Streets
    Light.
-   Se o usuário selecionar uma localização e criar um marcador,
    reutilize a mesma coordenada/entidade, sem duplicar geocodificação.
-   Avalie se mudanças importantes na seleção devem gerar atividade na
    timeline, mas não polua a timeline a cada tecla. Registre apenas
    seleção confirmada ou ação explícita.
-   Persista somente os dados necessários: nomes, identificadores,
    coordenadas, fonte, precisão e referências de geometria/cache. Evite
    persistir GeoJSON enorme no estado do case se puder armazenar uma
    referência recuperável.
-   Faça migração de schema compatível, se realmente necessária, e teste
    dados antigos.

------------------------------------------------------------------------

# PARTE E --- TESTES, ENTREGA E CRITÉRIOS DE ACEITAÇÃO

## 11. Testes automatizados

Adicione testes para:

### Hierarquia

-   Selecionar país.
-   Selecionar estado dentro do país.
-   Selecionar cidade dentro do estado.
-   Selecionar bairro dentro da cidade.
-   Selecionar rua dentro do bairro.
-   Selecionar local exato.
-   Trocar país e confirmar limpeza de filhos incompatíveis.
-   Limpar cada nível.
-   Aceitar hierarquias parciais.
-   Rejeitar resultados sem relação com o pai selecionado.

### Geometrias

-   Polygon.
-   MultiPolygon.
-   LineString.
-   MultiLineString.
-   Point.
-   Geometria ausente.
-   Geometria inválida.
-   Bounds e câmera.
-   Dados que cruzam o antimeridiano, se suportados pelo mapa.

### MapLibre

-   Fonte criada uma única vez.
-   Layers criadas uma única vez.
-   `setData` atualiza seleção sem duplicar recursos.
-   Troca de estilo recria os destaques.
-   Troca de provedor não perde a seleção.
-   Desmontagem remove listeners e timers.

### UI

-   Nenhum painel se sobrepõe em viewports de teste.
-   Campos continuam acessíveis com painel aberto/recolhido.
-   Autocomplete funciona com teclado.
-   Loading, vazio e erro possuem estados visuais.
-   Seleção hierárquica tem breadcrumb correto.
-   Google Embed não recebe overlays MapLibre.

### Segurança

-   Chave ausente.
-   Chave removida.
-   Chave nunca aparece em logs.
-   Nenhuma chave em `settings.json`, `localStorage`, snapshots ou
    arquivos versionados.
-   CSP continua restrita.
-   Não há permissões Electron desnecessárias.

## 12. Verificações do projeto

Execute os scripts existentes e não invente scripts que não existam:

-   `npm run check`
-   `npm run lint`
-   `npm run test:map-providers`
-   Testes existentes de auth, session, geo, IP e outros relevantes.
-   `scripts/verify.sh`, com o ambiente Python correto quando
    necessário.
-   `git diff --check`
-   Build/empacotamento Electron para a plataforma disponível.
-   Teste visual no Electron real, se houver display.

Não esconda testes que falharam. Separe claramente: - aprovado; -
falhou; - não executável no ambiente; - depende de chave/rede/ambiente
gráfico.

## 13. Critérios de aceitação

A tarefa só pode ser considerada concluída quando:

1.  OpenFreeMap, Google Maps e Street View continuam funcionando.
2.  A auditoria não encontrar vulnerabilidade crítica não tratada.
3.  O HUD estiver estruturalmente organizado e sem sobreposições nos
    tamanhos definidos.
4.  Busca e seletor de provedor estiverem em regiões distintas.
5.  Painel de localização hierárquica estiver funcional.
6.  Selecionar país/estado/cidade/bairro destacar a geometria disponível
    no MapLibre/globo.
7.  Rua for representada como linha e local exato como ponto/geometry
    real, não como polígonos inventados.
8.  A seleção sobreviver a troca de provedor e estilo.
9.  Dados sem geometria não forem apresentados como se tivessem limite
    confirmado.
10. Google Embed permanecer sem overlays customizados incompatíveis.
11. Testes e build passarem, ou limitações estiverem documentadas com
    precisão.
12. Nenhum commit, push ou merge for feito sem autorização.

## 14. Forma de trabalho

Trabalhe nesta ordem:

**Fase 1 --- Baseline e auditoria** - Inspecionar Git, documentos,
arquitetura e testes. - Rodar testes antes das mudanças. - Revisar
integração Google e ciclo de vida. - Corrigir problemas de
segurança/funcionamento comprovados.

**Fase 2 --- Redesign do workspace** - Mapear os componentes e CSS que
causam sobreposição. - Propor uma estrutura de layout concreta com base
no código atual. - Implementar a reorganização estrutural. - Testar nos
viewports definidos. - Não remover ferramentas existentes.

**Fase 3 --- Localização hierárquica** - Modelos e interfaces. -
Providers de geocodificação e limites administrativos. - Painel com
autocomplete e dependências hierárquicas. - Persistência no estado do
workspace/case.

**Fase 4 --- Destaques geográficos** - Fonte GeoJSON. - Layers de
fill/line/point. - Estilos usando tokens do tema. - Fit bounds e
câmera. - Reidratação após troca de estilo. - Integração com o estado de
seleção.

**Fase 5 --- Validação** - Testes unitários, integração, segurança, UI e
build. - Teste funcional real no Electron. - Relatório final.

Não pare após produzir um plano. Implemente as fases na medida em que o
ambiente permitir. Se uma fase depender de uma fonte de dados,
credencial, licença, rede ou decisão não disponível, conclua as partes
independentes, deixe a interface em estado honesto e documente
precisamente o bloqueio.

Ao final, apresente: - Arquivos criados/modificados. - Problemas
encontrados na auditoria. - Correções de segurança e ciclo de vida. -
Mudanças visuais do HUD. - Como usar o painel hierárquico. - Fontes
geográficas, licenças e limitações de cobertura. - Testes executados e
resultados. - Itens pendentes. - Próxima etapa recomendada.

**Não faça commit, push ou merge.**

------------------------------------------------------------------------

# NOTAS TÉCNICAS PARA IMPLEMENTAÇÃO

## A. Fontes e camadas GeoJSON no MapLibre

A implementação deve aproveitar o mecanismo de fontes e layers do
MapLibre. Uma fonte GeoJSON pode ser atualizada com `setData()` e
utilizada por layers diferentes:

-   `fill` para Polygon/MultiPolygon.
-   `line` para limites e ruas.
-   `circle` ou `symbol` para Point.

Consulte: -
https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/ -
https://maplibre.org/maplibre-gl-js/docs/examples/

## B. Limites administrativos

O geoBoundaries disponibiliza metadados e geometrias por nível
administrativo. O release `gbOpen` informa licença CC BY 4.0, com
atribuição. Os níveis administrativos variam por país e precisam ser
mapeados com base nos metadados, não por suposição.

Consulte: - https://www.geoboundaries.org/api.html

## C. Geocodificação estruturada

O Nominatim documenta campos estruturados como `country`, `state`,
`city` e `street`, além de opções de tipo de resultado. O serviço
público tem política de uso e não deve ser tratado como API irrestrita
para consultas em massa.

Consulte: - https://nominatim.org/release-docs/latest/api/Search/ -
https://operations.osmfoundation.org/policies/nominatim/

## D. Google Maps Embed

O Google Maps Embed funciona por iframe e oferece modos de mapa e Street
View. O iframe não deve ser tratado como um canvas controlável pelo
ZeroHub para desenhar GeoJSON próprio. Preserve a separação entre o modo
Google e o modo MapLibre.

Consulte: -
https://developers.google.com/maps/documentation/embed/get-started -
https://developers.google.com/maps/documentation/embed/embedding-map -
https://developers.google.com/maps/api-security-best-practices

------------------------------------------------------------------------

# RESUMO DO RESULTADO ESPERADO

O ZeroHub deve evoluir para uma estação de trabalho geoespacial em que:

-   O mapa é o elemento central e não fica encoberto por cartões
    desnecessários.
-   O HUD tem regiões fixas, hierarquia e comportamento responsivo.
-   O usuário consegue preencher uma localização do país até o ponto
    exato.
-   Cada nível selecionado ganha um destaque geográfico coerente, com
    contorno e preenchimento azul/ciano.
-   Ruas são linhas; locais exatos são pontos ou geometrias reais.
-   A seleção permanece consistente ao alternar provedores.
-   Google Maps/Street View continuam funcionando, sem overlays
    customizados incompatíveis.
-   O sistema é modular, testável, seguro e preparado para novos
    provedores e camadas OSINT.

**Prioridade máxima: qualidade estrutural, precisão geográfica,
segurança e ausência de regressões.**

# REFERÊNCIA VISUAL PRINCIPAL — AFTERGEO EXPLORER

Referência: https://aftergeo.com/explorer

A captura de tela anexada mostra a interface do Aftergeo Explorer. Utilize-a como principal referência de direção visual para o redesign do ZeroHub.

IMPORTANTE: não quero copiar literalmente o Aftergeo, seus assets, código, marca ou identidade. Quero reproduzir o nível de qualidade visual, organização, hierarquia e experiência de uso, adaptando tudo à identidade própria do ZeroHub.

## Direção de design

O ZeroHub deve ter aparência de uma plataforma profissional de Geospatial Intelligence.

### Layout

- Barra superior horizontal com navegação organizada por módulos.
- Painel esquerdo compacto para Objects, Layers, buscas e filtros.
- Painel direito contextual para estatísticas, propriedades e informações de inteligência.
- Mapa ocupando a maior parte da tela.
- Ferramentas cartográficas em uma barra vertical compacta.
- Barra inferior discreta com coordenadas, escala, provedor e status.

### Painel esquerdo

Inspirar-se na organização do Aftergeo:

- Seções expansíveis.
- Pesquisa de objetos e camadas.
- Categorias com indicadores coloridos.
- Contadores de elementos.
- Controles de visibilidade.
- Reordenação de camadas.
- Rolagem independente.
- Possibilidade de recolher completamente o painel.

### Painel direito

Deve funcionar como um inspector contextual:

- Estatísticas da seleção.
- Propriedades geográficas.
- Informações dos objetos.
- Dados da investigação ativa.
- Indicadores e gráficos quando houver dados reais.
- Seções expansíveis e recolhíveis.

Não exibir estatísticas fictícias ou dados de demonstração na aplicação de produção.

### Cartografia

A qualidade visual do mapa é tão importante quanto a interface.

Quero:
- Basemap dark de alta legibilidade.
- Ruas e edifícios com contraste equilibrado.
- Labels discretos.
- Limites administrativos bem definidos.
- Polígonos com preenchimento translúcido.
- Contornos nítidos.
- Marcadores com cores consistentes.
- Camadas que não escondam desnecessariamente o mapa.

Avalie o estilo cartográfico atual do MapLibre/OpenFreeMap e proponha melhorias reais sem substituir fontes de dados ou violar licenças.

### Identidade visual

Preservar a identidade do ZeroHub:

- Dark mode.
- Azul/ciano como accent principal.
- Tipografia compacta e moderna.
- Superfícies grafite.
- Bordas discretas.
- Ícones consistentes.
- Animações sutis.

Não importar a cor verde predominante do Aftergeo como nova cor principal. O azul/ciano atual do ZeroHub deve permanecer como identidade.

### Integração com a seleção geográfica

O painel esquerdo deve possuir uma seção dedicada à localização hierárquica:

País → Estado → Cidade → Bairro → Rua → Local exato.

Ao selecionar uma localização, o painel direito deve apresentar suas informações geográficas e administrativas, enquanto o mapa destaca a geometria correspondente.

### Critério de qualidade

Não considero o redesign concluído apenas porque os componentes estão alinhados.

A interface final deve alcançar um nível de acabamento visual comparável ao Aftergeo Explorer, mantendo ou superando sua organização e adaptando-a às funcionalidades mais amplas do ZeroHub.

Utilize a captura anexada como referência visual durante a implementação.

Implemente a mudança na estrutura real dos componentes React e CSS, não apenas em um protótipo ou imagem estática.
