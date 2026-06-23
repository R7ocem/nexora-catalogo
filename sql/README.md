# Rotina de banco

Use esta ordem em toda alteracao que tiver arquivo SQL novo:

1. Fazer backup do banco.
2. Rodar o SQL novo no Postgres.
3. Fazer deploy no EasyPanel.
4. Testar painel e catalogo.

## Entrar no banco

```bash
docker exec -it edaacb5cf5cb psql -U nexora -d nexora
```

Se o ID do container mudar, rode `docker ps` e use o container do Postgres.

## Backup rapido

```bash
mkdir -p /root/backups-nexora
docker exec edaacb5cf5cb pg_dump -U nexora -d nexora > /root/backups-nexora/nexora-$(date +%Y-%m-%d-%H%M).sql
```

## Restaurar um backup

Use restauracao apenas quando tiver certeza de que precisa voltar o banco.

```bash
docker exec -i edaacb5cf5cb psql -U nexora -d nexora < /root/backups-nexora/arquivo-do-backup.sql
```

## Conferencia depois do SQL

Depois de colar um SQL no `psql`, confira se apareceram mensagens como `ALTER TABLE` e `CREATE INDEX`.
Se aparecer `ERROR`, pare e revise antes do deploy.

## Vendedor n8n multiempresa

O arquivo `016_n8n_multiempresa_base.sql` prepara cada empresa para ter seu proprio
atendimento no WhatsApp: instancia, mensagem inicial, menu, Pix, numero da loja e
numeracao sequencial de pedidos a partir de 77.

Ele tambem cria a base de solicitacoes de orcamento para itens marcados como "sob consulta".
Rode este arquivo antes do deploy que adicionar a area **Atendimento automatico** no painel.
