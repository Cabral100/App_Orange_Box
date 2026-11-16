# CYF — Guia rápido para testar no iPhone

## Antes de começar

- MacBook com Xcode instalado;
- iPhone com iOS 17 ou superior;
- cabo e internet na primeira instalação;
- Conta Apple adicionada em **Xcode > Settings > Accounts**.

## Primeira instalação

### 1. Baixar e preparar

Abra o **Terminal** no MacBook e execute:

```bash
git clone https://github.com/Cabral100/App_Orange_Box.git
cd App_Orange_Box
bash scripts/setup-native-ios.sh
```

O último comando é necessário em um clone novo: ele prepara o modelo de inteligência artificial, baixa a dependência da Ultralytics e abre o projeto no Xcode.

### 2. Configurar o Xcode

No Xcode:

1. Abra `ios-native/CYF.xcodeproj`, caso não tenha aberto automaticamente.
2. Clique no projeto azul **CYF** > target **CYF** > **Signing & Capabilities**.
3. Marque **Automatically manage signing**.
4. Em **Team**, selecione sua Conta Apple.
5. Se houver erro no Bundle Identifier, troque-o por um identificador único, como `br.com.fazenda.cyf.teste`.

### 3. Instalar no iPhone

1. Conecte o iPhone pelo cabo e desbloqueie-o.
2. No iPhone, toque em **Confiar** se a pergunta aparecer.
3. No topo do Xcode, selecione **CYF** e o iPhone conectado.
4. Clique em **Run** (▶) ou pressione `Command + R`.
5. Autorize câmera e localização no iPhone.

Se o Xcode pedir, ative no iPhone **Ajustes > Privacidade e Segurança > Modo de Desenvolvedor**, reinicie o aparelho e clique em Run novamente.

## Próximas vezes

O CYF abre diretamente pelo ícone no iPhone, sem cabo ou MacBook. Para instalar uma atualização, conecte o cabo, abra o projeto e clique em **Run** novamente.

> Com uma Conta Apple gratuita, a instalação pode precisar ser renovada pelo Xcode após 7 dias.

## Acesso de demonstração

- Inspeção: `inspecao` / `campo123`
- Administração: `admin` / `admin123`

## Se algo der errado

- **iPhone não aparece:** desbloqueie, reconecte o cabo e toque em Confiar.
- **Erro de assinatura:** escolha sua conta em Team e altere o Bundle Identifier.
- **Modelo não encontrado:** execute novamente `bash scripts/setup-native-ios.sh`.
- **App parou de abrir:** conecte ao MacBook e clique em Run novamente.

Referências: [repositório do CYF](https://github.com/Cabral100/App_Orange_Box), [execução em aparelho físico](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices) e [Modo de Desenvolvedor](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
