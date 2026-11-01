# GEOINT Signal Lab — MVP

Ferramenta experimental de análise de medições fornecidas pelo usuário; não coleta sinais nem identifica pessoas. As estações ficam somente na memória da sessão e não alteram cases. O botão GEO abre o painel no MapLibre; a visualização Google não recebe os overlays.

- **Trilateração:** distâncias em metros até o alvo.
- **Triangulação:** azimutes verdadeiros, em graus a partir do norte, no sentido horário.
- Cada estação tem uma incerteza 1σ editável. Os valores iniciais de 50 m e 2° são apenas exemplos, não precisão garantida. Informe valores compatíveis com a medição.
- O ajuste usa distâncias e azimutes geodésicos esféricos e mínimos quadrados ponderados, numa parametrização local. O resultado é recusado se os dados forem inválidos, a geometria for mal condicionada, o ajuste não convergir ou o resíduo normalizado RMS ultrapassar 3.
- O círculo de incerteza é conservador: usa o maior eixo da covariância linearizada e o fator bidimensional de 95%. A interpretação probabilística depende de erros independentes aproximadamente normais e das incertezas informadas; ela não garante a localização real.
- São necessárias pelo menos três estações; o painel aceita até oito. O MVP limita a primeira estação, as demais e a solução a uma região local de 100 km e aceita latitudes até 85°. Geometrias que cruzam o antimeridiano são omitidas do desenho e o painel avisa. Não há correção elipsoidal, propagação de sinal, calibração automática ou cobertura global.
- A demonstração contém dados sintéticos. A animação revela as medições calculadas; ela não representa atualização em tempo real. A preferência do sistema por movimento reduzido desativa a animação.
- As estações A–H podem ser selecionadas pelo marcador ou pelo card. A posição é alterada explicitamente nos campos de latitude e longitude; a navegação do mapa não move estações. O botão Enquadrar ajusta a câmera às estações e, quando disponível, à estimativa. A ferramenta de medição deve estar desativada para adicionar uma estação no mapa.
- A validação individual confirma somente os intervalos e campos obrigatórios. O ajuste pode ser recusado mesmo com todas as estações individualmente válidas. Os resíduos exibidos são a medição prevista menos a informada; o RMS normalizado indica compatibilidade com as incertezas declaradas, sem comprovar a posição.
- Uma estimativa aceita pelo ajuste também recebe o aviso de região ampla quando seu raio de incerteza é igual ou maior que a distância mediana entre a estimativa e as estações. Esse critério geométrico é informativo, não uma garantia de qualidade.
