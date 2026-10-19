# Checklist para finalizar a versão de produção

O aplicativo já usa câmera, inferência, mapa, GPS/EXIF e armazenamento local reais. Apenas a conta é demonstrativa. Os itens abaixo dependem de dados, validação ou infraestrutura ainda não fornecidos.

## Talhões e cartografia

- [ ] Importar GeoJSON/KML real da propriedade, em WGS84/EPSG:4326, com nomes e IDs oficiais.
- [ ] Definir o provedor/licença de imagem de satélite e a chave de produção, se exigida.
- [ ] Decidir se mapas offline são necessários; o cache atual cobre a interface, não todas as imagens de satélite.
- [x] Permitir correção manual de talhão para ponto fora da área ou próximo da divisa.
- [ ] Definir o limiar de baixa precisão que obrigará confirmação do operador em produção.
- [ ] Se houver identificação por árvore, fornecer inventário das linhas/árvores e adotar posicionamento mais preciso que GPS comum.

## Modelo e dataset

- [ ] Revogar e rotacionar a chave Roboflow exposta; usar apenas `ROBOFLOW_API_KEY` no ambiente do pipeline.
- [ ] Coletar/curar imagens de espécimes reais de `Brevipalpus`, negativos reais e condições variadas de pomar.
- [ ] Usar dois anotadores e revisão cruzada das bounding boxes.
- [ ] Dividir treino/validação/teste por sessão ou vídeo, não aleatoriamente por frame.
- [ ] Validar e calibrar o limiar de salvamento de `0.95` em um teste biologicamente independente.
- [ ] Medir precisão, recall, F1, mAP, calibração e latência nos celulares-alvo.
- [ ] Exportar e validar TFLite/ONNX caso a inferência precise funcionar inteiramente no aparelho.
- [ ] Documentar resolução, normalização, classes e pós-processamento da versão embarcada.

## Operação mobile

- [ ] Disponibilizar frontend e API em HTTPS, ou empacotar o React com runtime nativo.
- [ ] Validar câmera macro, foco, exposição, lanterna e orientação em Chrome Android e Safari iOS.
- [ ] Confirmar intervalo de análise e consumo de bateria/dados em uso prolongado.
- [ ] Definir política de deduplicação, limite de armazenamento e retenção de fotos.
- [x] Permitir correção manual do talhão quando o GPS estiver impreciso.

## Backend e contas

- [ ] Trocar o login demonstrativo por autenticação real e autorização por perfil.
- [ ] Escolher banco, armazenamento de imagens e fila de sincronização.
- [ ] Implementar sincronização offline, conflitos, retentativas e indicação clara de estado.
- [ ] Implementar trilha de auditoria para captura, validação humana e decisão.
- [ ] Adicionar backup, observabilidade e política segura de atualização do modelo.

## Ética e validação

- [ ] Transformar o aviso atual em consentimento institucional aprovado para câmera e localização.
- [ ] Definir minimização, retenção, exportação e exclusão de fotos/GPS.
- [ ] Não apresentar a confiança do modelo como probabilidade biológica ou diagnóstico.
- [ ] Não recomendar aplicação autônoma de defensivo; manter revisão agronômica.
- [ ] Conduzir testes de usabilidade no campo, incluindo leitura ao sol e operação com uma mão.
- [ ] Fazer inspeção heurística independente com 3–5 avaliadores e teste com 5–10 usuários representativos.
- [ ] Avaliar obrigações da licença Ultralytics/AGPL-3.0 antes da distribuição comercial.
