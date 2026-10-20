# CYF — Clean Your Farm

> **Aplicativo principal atual:** a versão 100% mobile e offline está em [`mobile/`](mobile/README.md). Ela usa React Native + Expo Development Build/APK, câmera nativa e o modelo ONNX embarcado; não é uma tela web e não depende do backend para inferência. O conteúdo abaixo documenta a PWA anterior, preservada apenas como legado e apoio de desenvolvimento.

Aplicativo React/PWA mobile para triagem experimental de ácaros em citros. O CYF analisa a câmera com o checkpoint `best.pt`, salva fotos com **confiança do modelo ≥ 95%**, registra GPS/EXIF, associa cada ocorrência ao polígono de um talhão e colore o mapa conforme a quantidade de detecções no período.

A interface usa padrões de câmera orientada à tarefa e mapa operacional em tela cheia inspirados em Plantix, Climate FieldView e OneSoil, sem copiar marcas ou ativos proprietários.

> **Importante:** confiança do modelo não é probabilidade biológica nem diagnóstico agronômico. O material recebido registra validação com um objeto-proxy de grafite de 0,3 mm, e não uma validação independente com ácaros reais em pomar.

## O que funciona agora

- login e criação de conta demonstrativos; nenhum usuário é enviado a um servidor;
- câmera traseira, análise sequencial e caixas de detecção sobre a imagem;
- barra com confiança real do `best.pt` e quantidade de caixas detectadas;
- salvamento automático somente a partir de 95% de confiança;
- captura manual de vistoria com zero detecções, sem criar uma praga falsa;
- confirmação em tela verde e escolha entre incluir no mapa ou somente guardar o registro;
- foto e metadados persistidos em IndexedDB neste navegador;
- GPS no instante da captura ao vivo;
- leitura de GPS EXIF em fotos importadas, sem usar a posição atual como substituta;
- mapa Leaflet com imagem de satélite, posição e precisão do aparelho;
- importação de GeoJSON WGS84 ou desenho de talhões por toque;
- associação automática foto–talhão e correção manual quando o GPS estiver impreciso;
- talhões verdes com 0 detecções, amarelos com 1–20 e vermelhos com mais de 20;
- legenda textual e contagem no polígono, sem comunicar o estado apenas por cor;
- relatório por intervalo de datas, comparação com o período anterior de mesma duração, maior aumento/redução e dashboard visual exportável em PDF, CSV ou GeoJSON;
- PWA instalável; interface disponível em cache, mas mapa e inferência ainda dependem de conexão com seus serviços.

Não existem talhões, fazendas, ocorrências ou métricas fictícias pré-carregadas. Somente a conta é mockada.

## Executar no computador

Pré-requisitos: Python 3.12/3.13 e Node.js 20+.

```powershell
.\scripts\setup.ps1
.\run.ps1
```

Abra `http://127.0.0.1:8000`. A documentação da API fica em `http://127.0.0.1:8000/docs`.

Conta demonstrativa:

- e-mail: `operador@cyf.app`;
- senha: `demo2026`.

O launcher recompila o frontend se os fontes estiverem mais novos que `frontend/dist`. Um modelo retreinado pode ser selecionado sem editar o script:

```powershell
.\run.ps1 -ModelPath "D:\modelos\best-novo.pt" -ExpectedModelSha256 "SHA256_DO_ARQUIVO"
```

## Executar no celular com câmera e GPS

Abrir `http://IP-DO-PC:8000` no telefone não é suficiente: navegadores móveis normalmente exigem **HTTPS** para câmera e geolocalização. Para um teste local rápido:

```powershell
winget install Cloudflare.cloudflared
.\scripts\run-mobile.ps1 -AllowedEmail "seu-email@exemplo.com"
```

O terminal mostrará um endereço temporário `https://...trycloudflare.com`:

1. mantenha o computador e o terminal ligados;
2. abra esse endereço no Chrome/Safari do celular;
3. entre com a conta demonstrativa;
4. leia o aviso e permita câmera/localização;
5. opcionalmente use “Adicionar à tela inicial” para instalar a PWA.

O parâmetro `-AllowedEmail` adiciona um PIN por e-mail. Se ele for omitido, quem tiver o endereço temporário poderá alcançar a aplicação enquanto o túnel estiver ativo. O túnel rápido é apenas para teste; para campo/produção, use hospedagem HTTPS, autenticação real e política de acesso.

## Se eu apontar para uma laranja, já funciona?

**Tecnicamente, sim:** a câmera envia quadros ao backend, o `best.pt` faz inferência e o app mostra a classe, as caixas e a confiança. Se a maior confiança alcançar 95%, a foto é salva e o GPS é registrado.

**Agronomicamente, ainda não há evidência suficiente para prometer reconhecimento confiável do ácaro real.** O checkpoint executa sem o dataset, mas o dataset real e um teste independente continuam necessários para:

- comprovar desempenho com espécimes reais e negativos reais;
- calibrar se 95% é um limiar adequado;
- medir falsos positivos, falsos negativos e variação entre celulares/luz;
- decidir se o sistema pode apoiar uma operação de campo.

Portanto, o app já executa o modelo fornecido, mas o resultado deve ser tratado como triagem experimental e confirmado por profissional.

## Regras do mapa e dos relatórios

Para o intervalo selecionado:

- **verde:** 0 caixas detectadas;
- **amarelo:** 1 a 20 caixas detectadas;
- **vermelho:** 21 ou mais caixas detectadas.

A métrica é a soma das caixas com confiança do modelo ≥95% nas fotos salvas, não área infestada e não número de árvores. “0” significa **sem registro no período**, não “talhão livre de pragas”.

O relatório compara o intervalo escolhido com o intervalo imediatamente anterior de mesma duração. Ele exporta:

- total atual e anterior;
- diferença absoluta;
- variação percentual quando existe base anterior;
- nível e contagem por talhão;
- maior aumento e maior redução absolutos;
- fotos e ocorrências sem talhão confirmado.

Quando o período anterior é zero, o app informa “novo no período” e não produz percentual infinito.

## Localização e talhões

- **Câmera ao vivo:** quadros de `canvas` não preservam EXIF; o app registra a Geolocation API no instante da captura.
- **Foto da galeria:** a API usa somente GPS já existente no EXIF. Uma foto antiga sem EXIF não recebe o GPS atual do operador.
- **Privacidade:** a API lê as coordenadas e remove os metadados da cópia usada na inferência.
- **Associação:** a coordenada é testada contra os polígonos dos talhões. Fora deles, o registro permanece sem talhão.
- **Correção:** no detalhe de uma foto, o operador pode escolher outro talhão ou deixá-la sem associação.
- **Escolha após a captura:** “Salvar e ver no mapa” habilita o ponto e sua associação; “Só guardar o registro” mantém a evidência nos relatórios sem alterar o mapa.
- **Vistoria sem praga:** ao usar o botão de captura manual, um resultado com zero detecções pode ser salvo e associado a um talhão já delimitado; ele não soma pragas e o talhão permanece verde.

O app não inventa limites de propriedade. Importe GeoJSON `Polygon`/`MultiPolygon` em WGS84/EPSG:4326 ou desenhe o contorno sobre o mapa.

### Como cadastrar os limites

Na tela **Mapa**, abra **Talhões** e toque em **Como adicionar e usar os limites?**. Há dois caminhos:

1. **Desenhar:** aproxime a imagem de satélite, toque em pelo menos três cantos seguindo a borda do talhão, conclua e dê um nome à área.
2. **Importar:** exporte do sistema de origem um `.geojson` ou `.json` em WGS84/EPSG:4326. O CYF aceita `Polygon`, `MultiPolygon`, `Feature` e `FeatureCollection`; cada posição precisa seguir `[longitude, latitude]`.

O app valida CRS declarado, faixas de latitude/longitude e contornos antes de salvar. Uma única foto fornece apenas um ponto GPS/EXIF e, por isso, não é usada para inventar o desenho completo de um talhão.

## Modelo integrado

- arquivo: `backend/models/best.pt`;
- SHA-256: `84FB5A7EDE6CDF6F351866E5FE5C113DEDFB68787AA29012BD84C4EEAAD4AE6A`;
- arquitetura registrada: YOLO26n;
- tarefa: detecção;
- classe: `Acaro`;
- entrada: 640 px;
- tamanho: aproximadamente 5,46 MB.

O arquivo `best.pt.zip` recebido era o contêiner ZIP interno do checkpoint PyTorch; ele foi usado como `best.pt`, sem descompactar seus membros.

O token Roboflow deve existir somente no ambiente do pipeline:

```powershell
$env:ROBOFLOW_API_KEY="UMA_NOVA_CHAVE"
python .\scripts\download_dataset.py
python .\scripts\prepare_dataset.py --dataset .\datasets\tcc-datasetreal-9
python .\scripts\train_model.py --data .\datasets\tcc-datasetreal-9\data.yaml
```

A chave exibida anteriormente deve ser revogada e rotacionada; ela não foi persistida no projeto.

## Conceitos de IHC aplicados

Os 31 materiais de `Aulas_IHC.zip` foram percorridos. A implementação aplicou redução de carga decisória, alvos grandes, feedback de estado, prevenção/recuperação de erros, consistência de vocabulário, não dependência exclusiva de cor, transparência de GPS/EXIF e divulgação progressiva dos relatórios.

A matriz completa entre aulas, HTA/GOMS/CTT, MoLIC, heurísticas, ética e telas está em [`docs/IHC_APLICADA.md`](docs/IHC_APLICADA.md). Alterar a interface não comprova usabilidade: inspeção heurística e teste no pomar ainda são necessários.

## Verificação

```powershell
cd .\frontend
npm run check
npm run build

cd ..
.\.venv\Scripts\python.exe -m pytest .\backend\tests -q
Get-FileHash -Algorithm SHA256 .\backend\models\best.pt
```

## Estrutura

```text
frontend/src/                React mobile: login, câmera, mapa, relatórios e conta
frontend/dist/               build servido pelo FastAPI
backend/app/                 API, EXIF, qualidade e inferência YOLO
backend/models/best.pt       checkpoint fornecido
backend/tests/               testes de API e processamento
scripts/run-mobile.ps1       servidor local + túnel HTTPS para o celular
scripts/                     instalação, dataset, treino e exportação
docs/IHC_APLICADA.md         rastreabilidade dos conceitos de IHC
docs/PENDENCIAS.md           itens para uma versão de produção
```

## O que falta para uso 100% em campo

- limites GeoJSON reais, nomes e IDs oficiais da propriedade;
- dataset real biologicamente validado e teste independente do limiar de 95%;
- teste em celulares-alvo, sob sol, com conectividade e GPS reais;
- provedor/licença de satélite compatível com o uso em produção;
- HTTPS/hospedagem definitivos ou empacotamento nativo;
- modelo on-device validado se a inferência precisar funcionar sem internet;
- autenticação, sincronização, backup e controle de acesso reais;
- política institucional de consentimento, retenção, exclusão e revisão humana.

Consulte [`docs/PENDENCIAS.md`](docs/PENDENCIAS.md).

## Segurança e licença

Checkpoints PyTorch usam serialização baseada em pickle. A API carrega apenas o arquivo local configurado, verifica o SHA-256 e não aceita upload/substituição de modelos. O checkpoint registra Ultralytics/AGPL-3.0; avalie as obrigações aplicáveis antes de distribuir um produto fechado.
