# IHC aplicada ao CYF

Este documento registra a leitura dos 31 materiais de `Aulas_IHC.zip` e a rastreabilidade entre os conceitos estudados, a interface implementada e o que ainda precisa ser validado com pessoas reais.

> Uma interface coerente com as aulas não prova usabilidade. Eficácia, eficiência, satisfação, acessibilidade e comunicabilidade precisam ser medidas em inspeções e testes no contexto do pomar.

## Materiais percorridos

| Material | Conceito central usado no CYF |
|---|---|
| `CC8122-Abordagens Teoricas.pdf` e cópia `(1)` | Hick-Hyman, Fitts, processamento humano, memória, Gestalt e agrupamento visual |
| `CC8122-Processos-Parte1.pdf` | ciclo análise–síntese–avaliação e processos de Nielsen/Mayhew |
| `CC8122-Processos-Parte2.pdf` | metas qualitativas/quantitativas, iteração e design baseado em cenários |
| `CC8122-Personas.pdf` | persona primária de campo, gestor secundário, contexto e jornada |
| `CC8122-Identificacao Necessidades-A.pdf` | perfil, consequência de erros e princípios éticos |
| `CC8122-Identificacao Necessidades-B.pdf` | pesquisa contextual, entrevista, questionário e card sorting |
| `CC8122-Cenario Analise Problema.pdf` | ambiente, atores, objetivos, ações, eventos e avaliação |
| `CC8122-Refinamento Cenario Analise Problema.pdf` | precondições, alternativas, falhas, recuperação e evidência de conclusão |
| `CC8122-HTA.pdf` | decomposição hierárquica da inspeção |
| `CC8122-GOMS-CTT.pdf` | métodos alternativos, seleção e tarefas concorrentes/interrompíveis |
| `CC8122-Molic-ParteA/B/C.pdf` | interação como conversa, cenas, transições e tratamento de rupturas |
| `CC8122-Esquema-Conceitual_Signos.pdf` | origem, restrição, expressão e recuperação de cada signo |
| `CC8122-ProjetoIHC-ModelosConceituais.pdf.pdf` | metamensagem, cenários de interação e mapa de objetivos |
| `Principios Diretrizes Design.pdf` | simplicidade, consistência, estado visível, liberdade, prevenção e recuperação |
| `CC8122-Qualidade de Uso.pdf` | eficácia, eficiência, satisfação, segurança, aprendizagem e acessibilidade |
| `Avaliacao Usabilidade Inspecoes.pdf` | heurísticas de Nielsen, inspeção e severidade 0–4 |
| `Planejamento Avaliacao IHC.pdf` | DECIDE, avaliação formativa/somativa, piloto e validade ecológica |
| `Plano Execução atividade.pdf` | preparação, teste, pós-teste e amostra de 5–10 pessoas |
| `Teste Usabilidade Observacao Usuario.pdf` | sucesso, erros, tempo, ajuda, satisfação e observação neutra |
| `ManualdeUsabilidadeGESPFinal.pdf` | direcionamento, transação, desfecho, credibilidade e retorno ao serviço |
| `Evaluation_Competition_Report_ihc2012.pdf` | triangulação, privacidade, acessibilidade e risco de falsa conclusão |
| `IHC2010_Est_CGR_01.pdf` | linguagem compreensível e teste contextualizado com pessoas surdas |
| `IHC2010_Est_CGR_02.pdf` | conformidade técnica não substitui teste com tecnologias assistivas |
| `tcle-1496983779.pdf` | objetivo, riscos, confidencialidade, voluntariedade e retirada |
| `Termo de Consentimento Livre e Esclarecido usabilidade.pdf` | esclarecimento, ausência de penalidade, contatos e cópia do termo |
| `Modelo 01 Relatorio Heuristica.doc` | evidência visual da aplicação das heurísticas |
| `Modelo 02 Avaliacao Heuristica.doc` | protocolo e severidade de problemas |
| `Modelo 03 Avaliacao Heuristica.xls` | checklist de cor, conteúdo, imagens, instrução e navegação |
| `Modelo 04 Avaliacao Heuristica.xlsx` | registro conciso de problema e recomendação por heurística |

Os dois PDFs “Abordagens Teóricas” são cópias byte a byte. Os formatos legados `.doc` e `.xls` foram tratados como modelos metodológicos; regras antigas não substituem padrões atuais de acessibilidade.

## Personas e contexto assumidos — hipóteses a validar

### Persona primária

Operador/técnico no pomar, possivelmente com uma mão ocupada, sob luz forte, com pressa, conectividade variável, GPS impreciso e diferentes níveis de experiência digital. Seu objetivo é registrar evidência e local correto sem interpretar uma interface complexa.

### Persona secundária

Agrônomo ou gestor que seleciona períodos, compara talhões, encontra aumento/redução e exporta dados para revisão e decisão.

### Jornada modelada

`entrar → entender permissões → abrir câmera → enquadrar → analisar → ver confirmação → decidir se inclui no mapa → delimitar/confirmar talhão → comparar período → exportar dashboard`

Essas personas ainda são hipóteses acadêmicas. Entrevistas e observação contextual no pomar devem confirmá-las ou corrigi-las.

## HTA do fluxo crítico

Objetivo 0: registrar e localizar uma possível ocorrência.

1. Preparar o aparelho.
   1.1 Entrar na conta demonstrativa.
   1.2 Ler o aviso de câmera/localização.
   1.3 Conceder ou negar permissões.
2. Obter uma imagem.
   2.1 Usar câmera ao vivo; ou
   2.2 escolher uma foto da galeria.
3. Analisar.
   3.1 Ver estado “analisando”.
   3.2 Ver caixas e confiança do modelo.
   3.3 Melhorar luz/foco ou repetir em caso inconclusivo.
4. Salvar.
   4.1 No fluxo automático, salvar apenas se a confiança for igual ou maior que 95%.
   4.2 No botão manual, permitir registrar também uma vistoria com zero detecções, sem criar ocorrência falsa.
   4.3 Persistir foto, detecções confirmadas, data e localização.
   4.4 Confirmar com tela verde, check grande e texto inequívoco.
5. Associar ao talhão.
   5.1 Usar GPS do aparelho na câmera ou EXIF na galeria.
   5.2 Permitir escolher entre somente guardar o registro ou incluí-lo no mapa.
   5.3 Testar o ponto contra os polígonos sem inferir um limite completo a partir de uma única coordenada.
   5.3 permitir correção manual.
6. Avaliar o resultado.
   6.1 Ver ponto e contagem no mapa.
   6.2 filtrar período.
   6.3 comparar e exportar.

Plano: executar 1–6 em sequência; 2.1 e 2.2 são alternativas; câmera, GPS e inferência possuem processos concorrentes; falhas permitem retomada sem descartar registros anteriores.

## GOMS/CTT e decisões de eficiência

- A navegação global foi reduzida a quatro escolhas estáveis: `Mapa`, `Câmera`, `Relatórios`, `Conta`.
- Câmera e galeria são métodos alternativos para o mesmo objetivo.
- GPS e inferência ocorrem em paralelo; a câmera continua visível durante o processamento.
- O obturador é grande e próximo à área natural do polegar, conforme Fitts.
- Métricas avançadas não competem com o enquadramento: ficam em `Relatórios`, reduzindo decisões na câmera.
- Filtros permanecem visíveis no mapa/relatório e não precisam ser memorizados.

## Cenas MoLIC implementadas

| Cena | Fala do sistema | Ação/saída do usuário | Ruptura e recuperação |
|---|---|---|---|
| Acesso | conta explicitamente demonstrativa | entrar ou criar conta local | campos rotulados e validação nativa |
| Pré-permissão | explica foto, GPS/EXIF e limiar | continuar ou navegar para outra aba | permissão do SO pode ser recusada |
| Preparação | abrindo câmera / obtendo GPS | aguardar, usar galeria ou tentar de novo | mensagem explica HTTPS/permissão |
| Inspeção | procurando/analisando, caixas e confiança | aproximar, estabilizar, capturar | luz/foco, timeout e backend indisponível têm mensagem |
| Salvamento | salvo no talhão / com localização / sem localização | prosseguir para outra inspeção | abaixo de 95% informa “não salva” |
| Mapa | cores, rótulos, contagens e período | selecionar talhão ou ajustar período | ausência de limite orienta importar/desenhar |
| Correção | origem, precisão e associação atual | automático, talhão escolhido ou sem talhão | decisão manual é preservada |
| Relatório | atual, anterior, variação e metodologia | filtrar, exportar dashboard PDF, CSV ou GeoJSON | período vazio não cria dados falsos |

## Esquema de signos

| Signo | Origem | Restrição | Expressão | Recuperação |
|---|---|---|---|---|
| Confiança | saída do YOLO | 0–100%; não é probabilidade biológica | barra, número e rótulo “do modelo” | instrução para repetir/melhorar imagem |
| Praga | quantidade de bounding boxes ≥95% | somente fotos salvas ≥95% | contagem textual | detalhe da foto e definição no relatório |
| Talhão | polígono GeoJSON/desenhado | WGS84 e ponto contido | nome, contagem e polígono | correção manual |
| Localização | GPS ao vivo ou EXIF | pode faltar/ser imprecisa | origem, coordenada e precisão | “sem talhão” e escolha manual |
| Nível | soma por talhão e período | 0, 1–20, >20 | cor + número + texto | legenda permanente |
| Variação | atual menos anterior equivalente | divisão por zero não permitida | valor absoluto, percentual ou “novo” | metodologia textual e CSV |
| Salvamento | persistência IndexedDB concluída | confiança ≥95% | confirmação textual | exclusão posterior com confirmação |

## Heurísticas e princípios aplicados

1. **Visibilidade do estado:** abrindo, analisando, GPS/EXIF, porcentagem, salvo/não salvo e exportação confirmada.
2. **Correspondência com o mundo real:** “foto”, “talhão”, “GPS”, “período” e “confiança do modelo”.
3. **Controle e liberdade:** voltar da galeria, repetir, excluir e corrigir talhão.
4. **Consistência:** mesmos limiares, nomes e cores em mapa e relatório.
5. **Prevenção de erros:** foto da galeria sem EXIF nunca herda o GPS atual; datas inválidas são ajustadas; exclusão pede confirmação.
6. **Reconhecimento em vez de memorização:** legenda e filtros permanecem visíveis.
7. **Flexibilidade:** câmera ou galeria; guardar ou incluir no mapa; desenho ou importação de limite; dashboard PDF, CSV ou GeoJSON.
8. **Design minimalista:** identidade no login/conta, não sobre a câmera; controles operacionais textuais.
9. **Recuperação de erros:** mensagens dizem consequência e próxima ação.
10. **Ajuda/transparência:** conta e README explicam armazenamento, modelo e limitações.

Gestalt foi usada para agrupar período, legenda, resumo e ações. Verde/amarelo/vermelho nunca aparecem sozinhos: há número e rótulo, reduzindo a barreira para daltonismo.

## Metas mensuráveis propostas

Ainda precisam ser medidas:

- pelo menos 90% dos operadores concluem captura, confirmação de salvamento e identificação do talhão sem ajuda;
- pelo menos 90% distinguem “95% de confiança do modelo” de certeza biológica;
- pelo menos 90% identificam corretamente o significado de 0, 1–20 e >20;
- pelo menos 85% corrigem uma associação propositalmente errada de talhão sem ajuda;
- pelo menos 90% extraem o CSV correto no intervalo solicitado;
- nenhum problema de severidade 4 permanece antes de piloto operacional;
- registrar tempo, toques, erros, pedidos de ajuda, abandono e satisfação por tarefa.

Os números são metas propostas para o estudo, não resultados alcançados.

## Plano de avaliação

### Inspeção

- 3–5 avaliadores independentes;
- duas passagens pela interface;
- heurística, local, justificativa, recomendação e severidade 0–4;
- consolidação sem apagar divergências.

### Teste de campo

- piloto antes da coleta principal;
- 5–10 participantes representativos;
- Android/iPhone, sol forte, luvas, conexão ruim, GPS impreciso e permissão negada;
- cenários dizem o objetivo, sem ensinar o caminho;
- avaliador neutro registra sucesso real, tempo, erros e falsas conclusões;
- entrevista/questionário pós-tarefa e nova rodada após problemas graves.

Tarefas: entrar; negar/recuperar permissão; interpretar confiança; distinguir foto não salva; salvar ≥95%; importar com/sem EXIF; corrigir talhão; ler mapa; filtrar datas; identificar maior mudança; exportar; localizar as limitações.

## Ética e privacidade

Para uma pesquisa real, preparar TCLE específico do CYF, em linguagem adequada, contendo:

- o teste avalia o aplicativo, não o trabalhador;
- objetivo, procedimentos, riscos e benefícios;
- participação voluntária e retirada sem penalidade;
- consentimento separado para vídeo, áudio, imagem ou divulgação;
- fotos, data/hora, EXIF, GPS, precisão, talhão e logs coletados;
- finalidade, acesso, transporte, retenção, exportação e eliminação;
- anonimização/minimização de rostos, placas, documentos e endereço da fazenda;
- contato dos pesquisadores e entrega de uma cópia;
- nenhuma recomendação automática de defensivo e confirmação agronômica obrigatória.

O aviso no app apoia transparência, mas não substitui TCLE institucional, análise ética ou legislação vigente.

## Estado da aplicação dos conceitos

### Implementado no protótipo

- fluxo principal curto, navegação textual e alvos grandes;
- feedback e recuperação para câmera, GPS, modelo e salvamento;
- GPS/EXIF transparentes e associação corrigível;
- mapa com cor + texto + número e período explícito;
- relatório sem dados fictícios e sem percentual infinito;
- identidade CYF fora da área operacional da câmera;
- conta demonstrativa rotulada e dados locais explicados.

### Ainda depende de pessoas/dados/infraestrutura

- validar personas, linguagem e jornada no pomar;
- executar inspeção heurística formal e testes com usuários;
- medir as metas quantitativas;
- validar acessibilidade com leitores de tela, ampliação e diferentes formas de daltonismo;
- aprovar TCLE e política de dados;
- validar biologicamente o modelo e calibrar 95%;
- decidir regra institucional para GPS de baixa precisão e ponto na divisa;
- implementar autenticação, sincronização e inferência offline reais.
