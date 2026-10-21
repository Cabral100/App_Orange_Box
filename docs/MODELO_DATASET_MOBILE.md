# Dataset e modelo no app mobile

## O que vai para o celular

O dataset do Roboflow é usado somente para treinar e validar. Ele não deve ser
empacotado no aplicativo. O celular recebe apenas o modelo exportado:

- checkpoint de origem: `backend/models/best.pt`;
- modelo móvel: `mobile/assets/models/best.onnx`;
- metadados e métricas: `mobile/assets/models/model-metadata.json`.

O checkpoint atual é um YOLO26n de detecção com uma classe (`Acaro`). O ONNX é
exportado com entrada `1 × 3 × 640 × 640` e NMS embutido, produzindo até 300
linhas no formato `[x1, y1, x2, y2, confiança, classe]`.

## Atualizar o modelo

1. Treine no Colab/Roboflow e mantenha um conjunto de teste independente.
2. Baixe o `best.pt` resultante para `backend/models/best.pt`.
3. Instale as dependências de treinamento em um ambiente virtual.
4. Exporte o checkpoint:

```powershell
.\.venv\Scripts\python.exe scripts\export_mobile.py `
  --model backend\models\best.pt `
  --format onnx `
  --imgsz 640
```

5. Copie `backend/models/best.onnx` para
   `mobile/assets/models/best.onnx` e atualize o SHA-256 em
   `mobile/assets/models/model-metadata.json`.
6. Gere um Development Build ou aplicativo assinado e valide com fotos que não
   participaram do treino.

## Expo Go e modelo real

O Expo Go não inclui o módulo nativo `onnxruntime-react-native`. Por isso,
`AppExpoGo.tsx` usa detecção demonstrativa. O modelo real é carregado por
`App.tsx` quando `EXPO_PUBLIC_CYF_NATIVE_MODEL=1`, configuração já presente nos
perfis EAS de development, preview e production.

Para Android:

```powershell
cd mobile
npx eas-cli build --platform android --profile preview
```

Para iPhone, o mesmo processo exige credenciais válidas do Apple Developer
Program:

```powershell
cd mobile
npx eas-cli build --platform ios --profile preview
```

## Interpretação das métricas

As métricas informadas (`precision 0,9299`, `recall 0,9580`, `F1 0,9437` e
`mAP@0.5 0,9510`) descrevem o conjunto de teste utilizado no notebook. A
latência de `10,8 ms` e `92,6 FPS` foi medida numa GPU Colab T4 e não prevê a
latência em um telefone.

O limiar de 95% do app é uma regra operacional aplicada à confiança de cada
detecção. Ele não é o mesmo que `mAP@0.5 = 95,10%` e não transforma a saída em
certeza agronômica. Calibre esse limiar com negativos reais, diferentes
aparelhos, distâncias, iluminação e estágios da praga.

## Segurança do notebook

Não grave a chave do Roboflow dentro do `.ipynb`. Revogue a chave exposta e use
uma variável de ambiente:

```python
import os
from roboflow import Roboflow

rf = Roboflow(api_key=os.environ["ROBOFLOW_API_KEY"])
```
