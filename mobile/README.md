# CYF Mobile — execução offline no campo

Este diretório contém o aplicativo **React Native + Expo**, separado da versão web legada. Câmera, GPS, registros, talhões, relatórios e o modelo `best.onnx` ficam no próprio aparelho. Nenhum backend é necessário para analisar uma foto.

## Compatibilidade com o Expo Go no iPhone

O aplicativo está atualizado para o **SDK 57**, exigido pelo Expo Go 57.0.9. O Expo Snack ainda não disponibiliza um runtime nativo SDK 57, portanto o projeto hospedado abaixo serve para consultar o código, mas ainda não pode executar nessa versão do Expo Go:

<https://snack.expo.dev/@lucas-cabral/cyf-%E2%80%94-clean-your-farm>

Para testar gratuitamente no iPhone, use o servidor LAN descrito abaixo. O [`CYF_EXPO_GO_QR.png`](./CYF_EXPO_GO_QR.png) aponta para o endereço LAN atual `exp://192.168.15.110:8082` e funciona enquanto o servidor estiver ativo e os dois aparelhos estiverem na mesma rede.

## Teste gratuito no iPhone com Expo Go

Para apresentar a interface sem pagar o Apple Developer Program, instale **Expo Go** pela App Store e execute:

```powershell
cd D:\Downloads\App_Orange_Box\mobile
npm install
npm run start:go
```

Deixe o computador e o iPhone na mesma rede Wi-Fi e leia com a câmera do iPhone o QR Code exibido no terminal. O Expo Go abre automaticamente um modo de demonstração: câmera, GPS, Apple Maps, talhões, histórico, armazenamento local, dashboard e PDF funcionam, mas a detecção exibida após tocar no obturador é simulada e aparece identificada como tal.

O comando usa o modo offline/LAN para não depender da autenticação nem da consulta HTTPS do Expo. Se o iPhone não alcançar o computador, permita o Node.js no Firewall do Windows para redes privadas e confirme que ambos estão no mesmo Wi-Fi, sem VPN.

O modo de demonstração não substitui o APK/IPA nativo: o reconhecimento ONNX real continua disponível somente no Development Build ou aplicativo assinado.

## O que funciona sem internet

- captura pela câmera e importação da galeria;
- inferência local com ONNX Runtime;
- salvamento automático quando a confiança é maior ou igual a 95%;
- salvamento manual de inspeções sem praga, para registrar talhões verdes;
- GPS da câmera e leitura de coordenadas EXIF da galeria;
- associação do ponto a um polígono de talhão;
- histórico, filtros, métricas, gráfico de pizza e PDF;
- persistência local de conta demonstrativa, fotos, registros e GeoJSON.

O fundo de satélite do mapa não pode ser garantido offline sem um pacote de mapas licenciado previamente baixado. Sem sinal, o CYF continua mostrando e atualizando os polígonos e registros já armazenados; áreas do satélite que nunca foram carregadas podem ficar sem imagem.

## Por que o modelo real não abre no Expo Go

O modelo usa `onnxruntime-react-native`, uma biblioteca nativa que não existe no Expo Go. Por isso, o modo gratuito demonstra a experiência com resultado explicitamente simulado. Para analisar de verdade, o teste precisa usar um **Development Build** ou uma instalação assinada. O modelo já está empacotado em `assets/models/best.onnx`.

## Configuração inicial

Requisitos: Node.js 22.13 ou mais recente, Android Studio com Android SDK para compilação local, ou uma conta Expo para usar o EAS Build.

```powershell
cd D:\Downloads\App_Orange_Box\mobile
npm install
Copy-Item .env.example .env
```

Edite `.env` e informe uma chave do Google Maps para Android:

```text
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=SUA_CHAVE_ANDROID
```

A chave serve somente para carregar a imagem-base do mapa. A câmera e a inferência offline funcionam sem ela.

## Android conectado ao computador

Ative as opções de desenvolvedor e a depuração USB no telefone, conecte-o e execute:

```powershell
npx expo prebuild --clean
npx expo run:android --device
```

Depois da primeira instalação, inicie o servidor de desenvolvimento quando quiser testar alterações:

```powershell
npm start -- --dev-client
```

O computador e o celular precisam estar na mesma rede apenas durante o desenvolvimento. Para provar o uso totalmente offline, gere e instale o APK `preview` abaixo.

## APK instalável com EAS

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Baixe o APK indicado ao fim da compilação e instale-o no Android. Esse APK inclui JavaScript, fontes e o modelo; depois de instalado, a análise não depende do computador nem de conexão.

Para um Development Build com atualização rápida durante o desenvolvimento:

```powershell
npx eas-cli build --platform android --profile development
npm start -- --dev-client
```

## iPhone

Uma compilação iOS exige macOS/Xcode localmente ou EAS Build com conta Apple. O código é compartilhado, mas a instalação em iPhone precisa da assinatura da Apple.

## Verificação rápida

Na raiz do projeto:

```powershell
.\scripts\check-mobile.ps1
```

O script confere o hash do modelo empacotado e executa a checagem TypeScript. O checkpoint convertido esperado é:

```text
5DAA66FEE49524C5F0F0ED1D8945EA1BE858347970A508EEC73C85DE5DD7A962
```

## Limite importante do protótipo

O aplicativo executa o modelo recebido de forma local, mas isso não comprova que ele reconhecerá corretamente qualquer laranja no pomar. Para afirmar desempenho real ainda é necessário testar o dataset independente, negativos reais, diferentes aparelhos, iluminação, distância e foco. O limiar de 95% é uma regra de salvamento, não uma garantia agronômica.
