# Setup LAN — Dispositivos Móveis (iOS / Android)

Para acessar o ambiente de desenvolvimento a partir de celulares/tablets na mesma rede Wi-Fi.

**Pré-requisito:** O `docker compose` deve estar rodando na máquina dev.

> **Nota:** O dnsmasq roda na porta 10053 (mDNSResponder ocupa a porta 53 no macOS).
> Dispositivos móveis não suportam DNS em portas customizadas nativamente.
> Use a **Opção A** (DNS relay) para acesso mobile completo, ou a **Opção B** para testes rápidos.

---

## Opção A: DNS Relay no roteador (recomendado)

Se você tem acesso ao roteador da rede, configure-o para encaminhar queries `.test` para a máquina dev:

1. Acesse o painel do roteador (geralmente `192.168.0.1`)
2. Procure por **DNS personalizado** ou **DNS forwarding**
3. Adicione uma regra: `*.test` → `192.168.0.9:10053`

> Nem todos os roteadores suportam isso. Se não suportar, use a Opção B.

## Opção B: Acesso direto por IP

Para testes rápidos sem DNS, acesse diretamente pela URL com IP e host header.
No navegador mobile, isso não funciona diretamente, mas você pode usar o **Caddy** rodando no Mac:

1. Adicione o `/etc/hosts` do celular via app de perfil (iOS) ou edite manualmente (Android root)
2. Ou use um app de DNS local como **DNSCloak** (iOS) ou **Intra** (Android) configurado para usar `192.168.0.9:10053`

## Opção C: Instalar dnsmasq-proxy no Mac (porta 53)

Se precisa de acesso mobile frequente, instale um relay DNS na porta 53 do Mac:

```bash
# Instalar socat para relay
brew install socat

# Relay porta 53 → 10053 (requer sudo por ser porta privilegiada)
sudo socat UDP4-LISTEN:53,fork,reuseaddr UDP4:127.0.0.1:10053 &
sudo socat TCP4-LISTEN:53,fork,reuseaddr TCP4:127.0.0.1:10053 &
```

Depois configure o DNS do dispositivo móvel normalmente:

### iOS (iPhone / iPad)

1. **Ajustes** → **Wi-Fi** → toque no **(i)** da rede conectada
2. **Configurar DNS** → **Manual**
3. Remova os servidores existentes
4. Adicione: `192.168.0.9` (IP da máquina dev)
5. **Salvar**

### Android

1. **Configurações** → **Wi-Fi** → segure na rede conectada → **Modificar rede**
2. **Opções avançadas** → **Configurações de IP** → **Estático**
3. **DNS 1:** `192.168.0.9` (IP da máquina dev)
4. **DNS 2:** `8.8.8.8` (fallback)
5. **Salvar**

---

## 2. Instalar Certificado CA

Sem o certificado CA, o navegador mostrará avisos de SSL.

### iOS

1. Abra o Safari e acesse: `http://cardapio.test/rootCA.pem`
2. Toque em **Permitir** quando perguntar sobre o perfil de configuração
3. Vá em **Ajustes** → **Geral** → **VPN e Gerenciamento de Dispositivo**
4. Toque no perfil **mkcert** → **Instalar** → confirme com a senha do dispositivo
5. Vá em **Ajustes** → **Geral** → **Sobre** → **Certificados Confiáveis**
6. Ative o toggle para o certificado **mkcert**

### Android

1. Abra o Chrome e acesse: `http://cardapio.test/rootCA.pem`
2. O download do certificado inicia automaticamente
3. Vá em **Configurações** → **Segurança** → **Credenciais confiáveis** → **Instalar do armazenamento**
4. Selecione o arquivo `rootCA.pem` baixado
5. Nomeie como `MenuPanda Dev` → **OK**

> Android 7+ pode não confiar em CAs de usuário para apps. Para navegador (Chrome/Firefox) funciona.

---

## 3. Testar

Abra no navegador:

| URL | Descrição |
|-----|-----------|
| `https://supercardapio.test` | Owner |
| `https://pizzariadonamaria.cardapio.test` | Loja A (Professional) |
| `https://burguertop.cardapio.test` | Loja B (Premium) |
| `https://sushiexpress.cardapio.test` | Loja C (Suspensa) |

---

## 4. Reverter (quando não precisar mais)

### iOS
1. **Ajustes** → **Wi-Fi** → **(i)** → **Configurar DNS** → **Automático**
2. **Ajustes** → **Geral** → **VPN e Gerenciamento** → remover perfil mkcert

### Android
1. **Wi-Fi** → Modificar rede → **IP** → **DHCP**
2. **Segurança** → **Credenciais** → remover `MenuPanda Dev`
