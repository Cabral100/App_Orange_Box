# Backend de visão do CYF

API FastAPI para executar o modelo YOLO de detecção. O peso é carregado somente
na primeira inferência e as chamadas ao modelo são serializadas por um lock.

## Instalação e execução

Execute a partir da raiz do projeto:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\backend\requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

O arquivo recebido `best.pt.zip` já é o container interno do PyTorch. Copie o
arquivo inteiro, sem extrair seu conteúdo, e renomeie-o para
`backend/models/best.pt`. Para conferir o arquivo no PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\backend\models\best.pt
```

A API espera por padrão o SHA-256
`84FB5A7EDE6CDF6F351866E5FE5C113DEDFB68787AA29012BD84C4EEAAD4AE6A`.
Se a verificação obrigatória estiver ativa e o hash divergir, a inferência
retornará HTTP 503. `GET /api/model?verify_checksum=true` calcula e relata o
hash sem carregar o YOLO.

## Endpoints

- `GET /api/health`: saúde da API, disponibilidade e verificação do peso.
- `GET /api/model`: configuração, classes (após o primeiro carregamento) e hash.
- `POST /api/infer`: multipart com o campo `file`; `conf` pode ser enviado no
  formulário ou na query (padrão `0.5`). Também aceita `confidence` no formulário.
  Para a varredura contínua da câmera, envie `annotated=false` e um limiar baixo,
  por exemplo `?conf=0.05&annotated=false`; as detecções são retornadas da maior
  para a menor confiança. Envie `latitude`, `longitude` e opcionalmente
  `accuracy_m` no formulário para quadros capturados pelo navegador.
- `/docs`: documentação OpenAPI interativa.

JPEG, PNG e WebP são aceitos. O limite padrão é 10 MB e 25 milhões de pixels.
EXIF/GPS é removido; a orientação EXIF é aplicada antes da análise. A resposta
inclui detecções, qualidade técnica, tempos e a imagem anotada como data URL.
Quando `annotated=false`, `annotated_image` é `null`. Se a imagem importada tiver
GPS no EXIF, ele tem precedência sobre as coordenadas do aparelho; quadros de
canvas normalmente não têm EXIF e usam o GPS enviado no formulário. A API não
persiste fotos nem coordenadas: o PWA deve fazer o autosave local somente quando
a maior confiança for pelo menos `0.95`.
Quando existe `../frontend/dist/index.html`, a API serve o build React com
fallback de SPA. Em desenvolvimento, execute o Vite separadamente.

Variáveis úteis: `CITROSCAN_MODEL_PATH`, `CITROSCAN_MODEL_SHA256`,
`CITROSCAN_VERIFY_MODEL_SHA256`, `CITROSCAN_DEFAULT_CONFIDENCE`,
`CITROSCAN_IMAGE_SIZE`, `CITROSCAN_MAX_UPLOAD_MB`,
`CITROSCAN_MAX_IMAGE_PIXELS` e `CITROSCAN_MIN_IMAGE_SIDE`.
`CITROSCAN_CORS_ORIGINS` aceita uma lista de origens separadas por vírgula e já
libera os endereços locais padrão do Vite. Defina explicitamente o IP/origem
usado pelo celular durante desenvolvimento; deixe vazio em produção same-origin.
O arquivo `.env.example` registra todos os padrões; a aplicação também funciona
sem ele, pois os mesmos valores já estão definidos no código. Ao iniciar pelo
PowerShell, exporte apenas os valores que quiser sobrescrever.

Não existe endpoint para enviar ou substituir o modelo. A chave do Roboflow é
necessária apenas no pipeline de dataset/treino e não deve ser incluída no app.

## Testes

```powershell
pip install -r .\backend\requirements-dev.txt
pytest .\backend\tests
```

Os testes usam um modelo falso; nenhum peso YOLO é carregado.
