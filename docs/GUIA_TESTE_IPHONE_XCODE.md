# CYF — Guia rápido para testar no iPhone

## É gratuito?

**Sim. Este método não exige pagamento.** O Xcode, a Conta Apple e o **Personal Team** podem ser usados gratuitamente para instalar o CYF pelo cabo em um iPhone de teste.

A limitação da conta gratuita é que a instalação expira depois de **7 dias**. Quando isso acontecer, basta conectar novamente o iPhone ao MacBook, abrir o projeto e clicar em **Run**. TestFlight e distribuição pela App Store são outros processos e exigem inscrição paga, mas não são necessários para este teste.

## Antes de começar

- MacBook com Xcode instalado;
- iPhone com iOS 17 ou superior;
- cabo e internet na primeira instalação;
- uma Conta Apple gratuita do testador.

> A Conta Apple usada no Xcode não precisa ser a mesma do Mac ou do iPhone. Porém, é mais simples usar a mesma conta que já está no iPhone do testador, pois facilita a autenticação em dois fatores.

## Se o MacBook for emprestado

**Não remova nem desconecte a conta do Caio.** A conta, o iCloud, os arquivos e as configurações dele permanecem no Mac. A orientação é somente criar um segundo usuário para o testador e alternar entre as sessões.

Não coloque sua Conta Apple dentro da sessão pessoal do proprietário. Se a janela disser que fotos, contatos e documentos do iCloud serão associados ao Mac, clique em **Cancel**.

Peça ao proprietário do Mac para:

1. Abrir **Ajustes do Sistema > Usuários e Grupos**.
2. Clicar em **Adicionar Usuário** e informar a senha de administrador.
3. Criar um usuário do tipo **Padrão**, por exemplo `Vitor`.
4. Escolher **Finalizar Sessão de Caio** e entrar no novo usuário. Isso não apaga nem remove a conta dele; depois, Caio pode entrar normalmente na própria sessão.

Na sessão nova, o testador pode usar a própria Conta Apple sem misturar seus dados com os do proprietário.

## Primeira instalação

### 1. Ativar gratuitamente a conta de desenvolvedor

1. Na sessão separada do Mac, abra [developer.apple.com/account](https://developer.apple.com/account).
2. Entre com a Conta Apple do testador.
3. Aceite os termos gratuitos da Apple, caso sejam exibidos.
4. No Xcode, abra **Xcode > Settings > Accounts** e adicione a mesma conta.

Ela deverá aparecer no Xcode como **Nome (Personal Team)**.

### 2. Baixar e preparar o CYF

Abra o **Terminal** e execute:

```bash
git clone https://github.com/Cabral100/App_Orange_Box.git
cd App_Orange_Box
bash scripts/setup-native-ios.sh
```

Não pule o último comando: ele prepara o modelo de inteligência artificial, baixa a Ultralytics e abre o projeto no Xcode.

### 3. Configurar a assinatura

1. Abra `ios-native/CYF.xcodeproj`, caso não abra automaticamente.
2. Clique no projeto azul **CYF** > target **CYF** > **Signing & Capabilities**.
3. Marque **Automatically manage signing**.
4. Em **Team**, escolha **Nome (Personal Team)**.
5. Se o Bundle Identifier apresentar erro, use um valor exclusivo, como `br.com.vitor.cyf.teste`.

### 4. Instalar no iPhone

1. Conecte e desbloqueie o iPhone.
2. Toque em **Confiar** se a pergunta aparecer.
3. No topo do Xcode, selecione **CYF** e o iPhone conectado.
4. Clique em **Run** (▶) ou pressione `Command + R`.
5. Autorize câmera e localização no iPhone.

Se solicitado, ative **Ajustes > Privacidade e Segurança > Modo de Desenvolvedor**, reinicie o iPhone e clique em Run novamente.

## Depois da instalação

O CYF abre pelo ícone no iPhone, sem cabo. Para atualizar ou renovar após 7 dias, conecte ao MacBook e clique em **Run** novamente.

### Acesso de demonstração

- Inspeção: `inspecao` / `campo123`
- Administração: `admin` / `admin123`

## Problemas rápidos

- **A conta volta para a mesma tela:** entre primeiro em [developer.apple.com/account](https://developer.apple.com/account) e aceite os termos; depois tente novamente no Xcode.
- **Team continua em Add Account:** abra **Xcode > Settings > Accounts**, confirme que a conta aparece e volte a **Signing & Capabilities**.
- **Bundle Identifier indisponível:** altere para um identificador exclusivo.
- **iPhone não aparece:** desbloqueie, reconecte e toque em Confiar.
- **App parou de abrir:** conecte ao MacBook e clique em Run novamente.

Referências oficiais: [conta gratuita Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account), [execução em aparelho físico](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices) e [usuários separados no Mac](https://support.apple.com/guide/mac-help/add-a-user-or-group-mchl3e281fc9/mac).
