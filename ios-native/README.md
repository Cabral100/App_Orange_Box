# CYF iOS nativo

Este é o aplicativo principal do CYF para iPhone. Ele é 100% SwiftUI e usa:

- `UltralyticsYOLO` via Swift Package Manager;
- `best.mlpackage`/Core ML para inferência offline;
- MapKit para satélite, polígonos e desenho de talhões;
- Core Location e EXIF para coordenadas;
- Swift Charts para dashboards;
- `UIGraphicsPDFRenderer` para o relatório completo;
- armazenamento JSON e imagens no próprio aparelho.

Não há Expo, React Native, Node, Metro ou CocoaPods no fluxo deste aplicativo.

## Preparar no Mac

Na raiz do repositório:

```bash
git switch feat/ultralytics-native-camera
bash scripts/setup-native-ios.sh
```

O script reaproveita `mobile/assets/models/best.mlpackage`, se ele já foi exportado. Caso contrário, exporta `backend/models/best.pt`, copia o modelo para `ios-native/CYF/Models/`, resolve o pacote da Ultralytics e abre o projeto.

## Executar no iPhone

1. Abra `ios-native/CYF.xcodeproj` (não use `.xcworkspace`).
2. Selecione o target e o scheme `CYF`.
3. Em **Signing & Capabilities**, escolha seu **Team**.
4. Selecione o iPhone físico.
5. Pressione **Run**.

O aplicativo instalado é independente e não precisa de Terminal ou servidor para abrir novamente.

## Contas demonstrativas

- inspeção: `inspecao` / `campo123`;
- administrador: `admin` / `admin123`.

## Modelo

`best.mlpackage` não é versionado porque é um diretório gerado. O projeto espera o arquivo em:

```text
ios-native/CYF/Models/best.mlpackage
```

Execute novamente `bash scripts/setup-native-ios.sh` se o modelo for removido ou retreinado.

## Compatibilidade

- iOS 17 ou superior;
- Xcode compatível com o SDK instalado no iPhone;
- câmera e localização exigem aparelho físico;
- o mapa de satélite depende de internet, mas registros, modelo e histórico são locais.

O SDK da Ultralytics é AGPL-3.0. Revise as obrigações de licença antes de distribuir comercialmente um aplicativo fechado.
